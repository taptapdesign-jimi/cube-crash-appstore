import XCTest
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceLevelEndCallerFlowTests:XCTestCase {
    func testSynchronousSignatureMemoizationMatchesOriginalExactJSONAcrossFreshStates() {
        var originalEncodingCalls=0
        func original(_ signature:NativeSourceMeterEndgameSignature)->String {
            func quote(_ value:String?)->String {
                guard let value else{return "null"}
                originalEncodingCalls+=1
                let bytes=try? JSONSerialization.data(withJSONObject:[value],options:[.fragmentsAllowed,.withoutEscapingSlashes])
                guard let bytes,let string=String(data:bytes,encoding:.utf8) else{return "null"}
                return String(string.dropFirst().dropLast())
            }
            return "["+signature.entries.map {e in "{\"v\":\(e.value),\"s\":\(quote(e.special)),\"l\":\(e.locked),\"d\":\(e.depth),\"x\":\(e.x.map(String.init) ?? "null"),\"y\":\(e.y.map(String.init) ?? "null"),\"e\":\(quote(e.eventMode))}"}.joined(separator:",")+"]"
        }
        let first=NativeSourceMeterEndgameSignature(activeEntries:(0..<36).map{index in
            .init(value:index%6+1,special:index%3==0 ? "magnet":nil,locked:false,depth:0,x:index%6,y:index/6,eventMode:"static")
        })
        let next=NativeSourceMeterEndgameSignature(activeEntries:[
            .init(value:2,special:"honey\"\\/\n🍯",locked:false,depth:3,x:1,y:2,eventMode:"quoted\"\\/\t\u{0001} hrvatski ž 世界"),
            .init(value:6,special:nil,locked:true,depth:0,x:nil,y:nil,eventMode:nil),
            .init(value:3,special:"honey\"\\/\n🍯",locked:false,depth:2,x:2,y:2,eventMode:"quoted\"\\/\t\u{0001} hrvatski ž 世界")
        ])
        let measured=NativeBoardScene.sourceLevelEndSignatureFormatting(first)
        XCTAssertEqual(first.entries.count,36)
        XCTAssertEqual(measured.encodedStringCount,2,"Only the two distinct strings invoke Foundation JSON encoding")
        XCTAssertEqual(measured.key,original(first))
        XCTAssertEqual(originalEncodingCalls,48)
        for signature in [first,next,first,NativeSourceMeterEndgameSignature(activeEntries:[])] {
            XCTAssertEqual(NativeBoardScene.sourceLevelEndSignatureKey(signature),original(signature))
        }
        XCTAssertNotEqual(NativeBoardScene.sourceLevelEndSignatureKey(first),NativeBoardScene.sourceLevelEndSignatureKey(next))
    }
    @MainActor final class Fixture {
        var current=true,signature="physical",trace:[String]=[],waits:[(Int,()->Void)]=[]
        var tutorial:((Bool?)->Void)?,finalTutorial:((Bool?)->Void)?
        var decision=NativeSourceLevelEndCallerFlow.Decision.stuck("stuck")
        var finalGate=NativeSourceLevelEndCallerFlow.Gate.ready
        lazy var flow=NativeSourceLevelEndCallerFlow(hooks:.init(current:{self.current},wait:{ms,done,_ in self.waits.append((ms,done));return {}},preflight:{self.trace.append("guards");return .ready},tutorialSingleTile:{self.tutorial=$0},physicalSignature:{self.trace.append("physical");return self.signature},writeSignature:{_ in self.trace.append("Date");return true},resolve:{self.trace.append("resolve");return self.decision},stableRecheck:{.ready},stuckAdmission:{_ in .ready},tutorialFinalChance:{_,reply in self.finalTutorial=reply},finalAdmission:{self.finalGate},clean:{_,reply in self.trace.append("clean");reply()},noMoves:{reply in self.trace.append("NO MOVES");reply()},continued:{self.trace.append("save")}))
        func fire(){let next=waits.removeFirst();next.1()}
    }
    func testActualRepairAwaitPrecedesDateAndBothStableRechecksPrecedeFinalAwait(){
        let f=Fixture();f.flow.check();XCTAssertEqual(f.waits.map(\.0),[500]);f.fire();XCTAssertEqual(f.trace,["guards"])
        f.tutorial?(false);XCTAssertEqual(f.trace,["guards","physical","Date","resolve"]);XCTAssertEqual(f.waits.map(\.0),[250])
        f.fire();f.fire();XCTAssertFalse(f.trace.contains("NO MOVES"));XCTAssertNil(f.flow.confirmedSignature)
        f.finalTutorial?(false);XCTAssertEqual(f.trace.last,"NO MOVES");XCTAssertEqual(f.flow.confirmedSignature,"physical")
    }
    func testReplacementDuringTutorialCannotWriteDateOrFail(){let f=Fixture();f.flow.check();f.fire();f.current=false;f.tutorial?(false);XCTAssertEqual(f.trace,["guards"]);XCTAssertTrue(f.waits.isEmpty)}
    func testChangedPhysicalSignatureRestartsWithoutFail(){let f=Fixture();f.flow.check();f.fire();f.tutorial?(false);f.signature="changed";f.fire();XCTAssertNil(f.finalTutorial);XCTAssertFalse(f.trace.contains("NO MOVES"));XCTAssertEqual(f.waits.map(\.0),[250]);f.fire();XCTAssertEqual(f.waits.map(\.0),[500])}
    func testUnknownTutorialRefusesDateAndTerminalDecision(){let f=Fixture();f.flow.check();f.fire();f.tutorial?(nil);XCTAssertEqual(f.trace,["guards"])}
    func testContinueWritesSaveAfterAwaitedSignature(){let f=Fixture();f.decision = .continued;f.flow.check();f.fire();f.tutorial?(false);XCTAssertEqual(f.trace,["guards","physical","Date","resolve","save"])}
    func testBusyAfterFinalTutorialAwaitCannotPublishConfirmedPreflight(){
        let f=Fixture();f.flow.check();f.fire();f.tutorial?(false);f.fire();f.fire()
        f.finalGate = .retry(350,"busy-ending-during-stuck");f.finalTutorial?(false)
        XCTAssertNil(f.flow.confirmedSignature);XCTAssertFalse(f.trace.contains("NO MOVES"));XCTAssertEqual(f.waits.map(\.0),[350])
        f.fire();XCTAssertEqual(f.waits.map(\.0),[500])
    }

    func testStuckWildDateCapAndRealContinuationReset() {
        var policy=NativeSourceStuckWildDeferral()
        XCTAssertEqual(policy.decide(pending:true,now:1000),.deferFail)
        XCTAssertEqual(policy.startedAt,1000)
        XCTAssertEqual(policy.decide(pending:true,now:3199),.deferFail)
        XCTAssertEqual(policy.decide(pending:true,now:3200),.forceFail)
        XCTAssertEqual(policy.decide(pending:false,now:3201),.continueFail)
        XCTAssertNil(policy.startedAt)
        XCTAssertEqual(policy.decide(pending:true,now:4000),.deferFail)
        policy.reset();XCTAssertNil(policy.startedAt)
        XCTAssertNil(policy.decide(pending:true,now:.nan));XCTAssertNil(policy.startedAt)
    }

}
