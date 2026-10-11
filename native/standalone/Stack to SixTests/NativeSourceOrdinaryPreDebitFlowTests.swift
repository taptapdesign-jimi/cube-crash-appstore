import XCTest
import Foundation
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceOrdinaryPreDebitFlowTests:XCTestCase {
    @MainActor final class Fixture {
        let core:NativeSourcePreDebitTestEngine
        let source=NSObject(),destination=NSObject(),other=NSObject()
        var flow:NativeSourceOrdinaryPreDebitFlow!
        var trace:[[Any]]=[],waits:[(()->Void,()->Void)]=[],returns:[NativeSourceOrdinaryPreDebitFlow.ReturnReason]=[]
        var invalid=false,lateBusy=false,reply:(()->Void)?
        var input:[String:Any]
        var callback:((String)->Void)?
        init(_ input:[String:Any])throws {self.input=input;core=try NativeSourcePreDebitTestEngine()}
        func flag(_ key:String)->Bool {input[key] as? Bool == true}
        func number(_ key:String,_ fallback:Int)->Int {input[key] as? Int ?? fallback}
        func tile(_ object:NSObject,id:String,value:Int,depth:Int)->NativeSourcePostcheckTile {.init(object:object,id:id,value:value,depth:depth,locked:false,destroyed:false,isWildLike:false,active:true)}
        func roster()->NativeSourcePostcheckRoster {
            var tiles=[tile(destination,id:"d",value:number("value",4),depth:number("depth",1))]
            if flag("other") {tiles.append(tile(other,id:"other",value:5,depth:1))}
            return .init(tiles:tiles,moves:20,complete:true)
        }
        func install() {
            flow=NativeSourceOrdinaryPreDebitFlow(hooks:.init(current:{[weak self] receipt in self?.invalid==false && self?.core.engine.sourceOrdinaryPreDebitIsCurrent(receipt)==true},mainCapture:{[weak self] _ in
                guard let self else{return nil};return .init(source:self.source,destination:self.destination,sourceID:"s",destinationID:"d",effectiveSum:self.number("value",4),sourceValue:1,destinationValue:self.number("value",4),sourceSpecial:self.flag("special") ? "wild":nil,destinationSpecial:nil,sourceDepth:self.number("sourceDepth",1),destinationDepth:self.number("depth",1),visibleBefore:self.number("visibleBefore",4),physicalBefore:self.number("physicalBefore",4),bothCapturedActive:true)
            },busyEnding:{[weak self] in self?.lateBusy},wait:{[weak self] _,_,ms,elapsed,cancelled in self?.trace.append(["wall",ms]);self?.waits.append((elapsed,cancelled));return {}},stateRoster:{[weak self] in self?.callback?("roster");return self?.roster()},reread:{[weak self] held in self?.callback?("reread");return held},fresh:{[weak self] request in
                guard let self else{return nil};let kind=request.kind == .active ? "active":"STATE";self.trace.append(["fresh",kind,request.roster.moves,request.forceRefresh]);self.callback?("fresh");let value=request.kind == .active ? "continue":self.input["full"] as? String ?? "stuck";return .init(value=="stuck" ? .fail:.continue,reason:"controlled-original-checker-boundary")
            },clearEndGameCache:{[weak self] in self?.trace.append(["clear-cache"]);self?.callback?("clear")},resetHint:{[weak self] in self?.trace.append(["hint"]);self?.callback?("hint")},deferStackWild:{[weak self] reason in self?.trace.append(["wild",reason]);self?.callback?("wild");return self?.flag("wild")},ensureTutorialSingleTile:{[weak self] reason,done in self?.trace.append(["ensure",reason]);self?.callback?("ensure");done(self?.flag("ensure"))},tutorialFinalChance:{[weak self] reason,done in self?.trace.append(["tutorial",reason]);self?.callback?("tutorial");if self?.flag("lateBusy")==true {self?.lateBusy=true};done(self?.flag("tutorial"))},beginNoMoves:{[weak self] receipt,trigger,reply in
                guard let self else{return};var options:[String:Any]=["reason":trigger.rawValue,"resetHint":false];if trigger == .singleRegular {options["waitMs"]=500};self.trace.append(["noMoves",options]);self.reply=reply
                XCTAssertNotNil(self.core.engine.prepareSourceOrdinaryPreDebitNoMoves(receipt,trigger:trigger))
            },finished:{[weak self] _,reason in self?.returns.append(reason);if reason == .continueToDebit {self?.trace.append(["surviving-debit"])} }))
        }
        func dispose(){flow?.dispose();core.dispose()}
    }
    func testAll42LiteralOriginalPreDebitPathsAndCallerPromiseRemainIndependentOfFinalCleanup()throws {
        let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"SourceOrdinaryPreDebitOracle",withExtension:"json")),json=try JSONSerialization.jsonObject(with:Data(contentsOf:url)) as? [String:Any]
        let rows=try XCTUnwrap(json?["rows"] as? [[String:Any]]);XCTAssertEqual(rows.count,42)
        for (index,row) in rows.enumerated() {
            let input=try XCTUnwrap(row["input"] as? [String:Any]),f=try Fixture(input);defer{f.dispose()};f.install();XCTAssertTrue(f.flow.start(f.core.receipt));let wait=try XCTUnwrap(f.waits.first)
            if f.flag("cancel") {wait.1()}else{wait.0()}
            XCTAssertEqual(f.trace as NSArray,try XCTUnwrap(row["trace"] as? NSArray),"original row \(index)")
            if f.reply != nil {XCTAssertTrue(f.returns.isEmpty);XCTAssertEqual(f.flow.pendingCount,1);f.reply?();XCTAssertEqual(f.returns,[.earlyReturn]);XCTAssertEqual(f.core.engine.state.moves,20)}
            else {XCTAssertEqual(f.returns.count,1);XCTAssertEqual(f.flow.pendingCount,0)}
            XCTAssertFalse(f.flow.start(f.core.receipt))
        }
    }
    func testEveryExternalPredicateReentryDisposalPreventsLaterChecksOrDebit()throws {
        for point in ["roster","fresh","clear","reread","ensure","hint","wild","tutorial"] {
            let f=try Fixture(["value":4,"depth":1,"visibleBefore":4,"physicalBefore":4,"other":point != "reread" && point != "ensure"]);defer{f.dispose()};f.install()
            f.callback={name in if name==point {f.flow.dispose();f.invalid=true}}
            XCTAssertTrue(f.flow.start(f.core.receipt));try XCTUnwrap(f.waits.first).0()
            XCTAssertTrue(f.returns.isEmpty,point);XCTAssertNil(f.reply,point);XCTAssertEqual(f.core.engine.state.moves,20,point);XCTAssertEqual(f.flow.pendingCount,0,point)
        }
    }
    func testRetiredActualWaitCannotRestartOrPublishAfterLateElapsedAndCancel()throws {
        let f=try Fixture(["value":4,"depth":1,"visibleBefore":4,"physicalBefore":4,"other":true]);defer{f.dispose()};f.install();XCTAssertTrue(f.flow.start(f.core.receipt));let wait=try XCTUnwrap(f.waits.first)
        f.flow.dispose();f.invalid=true;wait.0();wait.1();XCTAssertEqual(f.trace as NSArray,[["wall",100]] as NSArray);XCTAssertTrue(f.returns.isEmpty);XCTAssertEqual(f.core.engine.state.moves,20)
    }
}
