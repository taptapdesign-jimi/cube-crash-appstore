import XCTest
@testable import StackToSixGameplay

final class NativeEndgameIdleHintEligibilityTests:XCTestCase {
    private func tile(_ id:String,_ value:Int,_ column:Int=0)->NativeTile {
        .init(id:id,cell:.init(column:column,row:0),value:value)
    }
    func testPhysicalMergeablePairMatchesPWAAndTerminalBoardsAreExcluded() {
        let pair=[tile("a",2),tile("b",4,1)]
        XCTAssertTrue(NativeSourceEndgameChecker.idleHintEligible(state:.init(tiles:pair),runtime:[:]))
        XCTAssertFalse(NativeSourceEndgameChecker.idleHintEligible(state:.init(tiles:[]),runtime:[:]))
        XCTAssertFalse(NativeSourceEndgameChecker.idleHintEligible(state:.init(tiles:[tile("a",6)]),runtime:[:]))
        XCTAssertFalse(NativeSourceEndgameChecker.idleHintEligible(state:.init(tiles:[tile("a",4),tile("b",3,1)]),runtime:[:]))
        var terminal=NativeBoardState(tiles:pair);terminal.terminal = .init(.complete,reason:"final")
        XCTAssertFalse(NativeSourceEndgameChecker.idleHintEligible(state:terminal,runtime:[:]))
        var final=NativeNoMovesTileRuntime();final.explicitFinal=true
        XCTAssertFalse(NativeSourceEndgameChecker.idleHintEligible(state:.init(tiles:pair),runtime:["a":final]))
    }
    func testPhysicalCleanupAndWildClassificationDoNotUseStaleCanonicalRoster() {
        let pair=[tile("a",2),tile("b",4,1)]
        var removed=NativeNoMovesTileRuntime();removed.beingRemoved=true
        XCTAssertFalse(NativeSourceEndgameChecker.idleHintEligible(state:.init(tiles:pair),runtime:["b":removed]))
        var wild=tile("wild",1,2);wild.archetype = .star
        XCTAssertFalse(NativeSourceEndgameChecker.idleHintEligible(state:.init(tiles:pair+[wild]),runtime:[:]))
        var ghost=tile("ghost",0,3);ghost.locked=true
        XCTAssertTrue(NativeSourceEndgameChecker.idleHintEligible(state:.init(tiles:pair+[ghost]),runtime:[:]))
        var destroyed=NativeNoMovesTileRuntime();destroyed.destroyed=true
        XCTAssertTrue(NativeSourceEndgameChecker.idleHintEligible(state:.init(tiles:pair+[wild]),runtime:["wild":destroyed]))
    }
}
