import XCTest
@testable import StackToSixGameplay

final class NativeComboBoundaryTests:XCTestCase {
    private func die(_ id:String,_ value:Int,_ x:Int,wild:NativeWildArchetype?=nil)->NativeTile {
        .init(id:id,cell:.init(column:x,row:0),value:value,archetype:wild)
    }
    func testOrdinaryAndEveryDirectWildContinueBeyond99()throws {
        for previous in [99,119,999] {
            for archetype in [nil,NativeWildArchetype.star,.juice,.magnet,.tnt] {
                let source=die("s",archetype == nil ? 3:6,0,wild:archetype)
                let target=die("d",archetype == nil ? 3:1,1)
                let engine=NativeGameplayEngine(state:.init(tiles:[source,target],longestCombo:previous,combo:previous))
                engine.stagedDirectWildMoves=archetype != nil
                XCTAssertTrue(engine.beginDrag(tileID:"s"))
                XCTAssertTrue(engine.drop(target:target.cell,now:1).accepted)
                if let plan=engine.pendingDirectWild {XCTAssertTrue(engine.commitDirectWildGameplay(transactionID:plan.id).accepted)}
                XCTAssertEqual(engine.state.combo,previous+1,"\(String(describing:archetype))")
                XCTAssertEqual(engine.state.longestCombo,previous+1)
                XCTAssertTrue(engine.state.validationIssues().isEmpty)
                XCTAssertEqual(try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(engine.state)),engine.state)
            }
        }
    }
    func testStagedOrdinarySixAndOrdinaryStackContinueBeyond99()throws {
        for previous in [99,119,999] {
            for stagedSix in [false,true] {
                let target=die("d",stagedSix ? 3:2,1)
                let engine=NativeGameplayEngine(state:.init(tiles:[die("s",stagedSix ? 3:1,0),target,die("a",1,2)],longestCombo:previous,combo:previous))
                engine.stagedOrdinaryMoves=stagedSix
                XCTAssertTrue(engine.beginDrag(tileID:"s"))
                XCTAssertTrue(engine.drop(target:target.cell,now:1).accepted)
                if stagedSix {
                    let plan=try XCTUnwrap(engine.pendingOrdinarySix)
                    XCTAssertTrue(engine.commitOrdinarySix(receiptID:plan.id,generation:plan.generation).accepted)
                    XCTAssertFalse(engine.commitOrdinarySix(receiptID:plan.id,generation:plan.generation).accepted)
                }
                XCTAssertEqual(engine.state.combo,previous+1)
                XCTAssertEqual(engine.state.longestCombo,previous+1)
            }
        }
    }
    func testStagedTntActivationAndMagnetPullContinueBeyond99()throws {
        for archetype in [NativeWildArchetype.tnt,.magnet] {
            let engine=NativeGameplayEngine(state:.init(tiles:[die("s",6,0,wild:archetype),die("d",2,1),die("a",1,2),die("b",3,3)],longestCombo:99,combo:99),recordedRandomChoices:Array(repeating:0.999999,count:200))
            XCTAssertTrue(engine.beginDrag(tileID:"s"))
            XCTAssertTrue(engine.drop(target:.init(column:1,row:0),now:1).accepted)
            let plan=try XCTUnwrap(engine.pendingSpecial)
            if archetype == .tnt {
                XCTAssertTrue(engine.commitSpecialActivation(transactionID:plan.id).accepted)
                XCTAssertEqual(engine.state.combo,100)
                XCTAssertFalse(engine.commitSpecialActivation(transactionID:plan.id).accepted)
                XCTAssertTrue(engine.releaseTntReservation(transactionID:plan.id).accepted)
                for target in plan.targets {XCTAssertTrue(engine.commitSpecialImpact(transactionID:plan.id,tileID:target.id).accepted)}
            }
            XCTAssertTrue(engine.commitSpecialBoard(transactionID:plan.id).accepted)
            XCTAssertEqual(engine.state.combo,archetype == .magnet ? 100+plan.targets.count:100)
            XCTAssertEqual(engine.state.longestCombo,engine.state.combo)
        }
    }
    func testGroupedScoreAndComboPresentationRetainsExactIntegerValues() {
        for (value,text) in [(0,"0"),(99,"99"),(100,"100"),(120,"120"),(999,"999"),(1000,"1.000"),(1200,"1.200"),(1299,"1.299"),(10000,"10.000")] {
            XCTAssertEqual(NativeComboDisplay.text(value),text)
            XCTAssertEqual(NativeScoreDisplay.text(value),text)
        }
        XCTAssertEqual(NativeScoreDisplay.text(7113),"7.113")
        XCTAssertEqual(NativeScoreDisplay.text(1234567),"1.234.567")
        XCTAssertEqual(NativeScoreDisplay.text(-1234),"-1.234")
        XCTAssertFalse(NativeBoardState(tiles:[],combo:-1).validationIssues().isEmpty)
    }
}
