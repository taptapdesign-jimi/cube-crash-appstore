import XCTest
import StackToSixGameplay
@testable import StackToSixNativeState

final class NativeArcadeBoardFactoryTests: XCTestCase {
    func testRoundFiveAndLaterKeepExactExistingRandomBoard() {
        for round in [5,6,10,50] { for seed in UInt64(1)...20 {
            let endurance=NativeBoardFactory.make(mode:.arcade,board:round,seed:seed)
            let pure=NativeBoardFactory.make(mode:.arcade,board:round,seed:seed,arcadeVariant:.pureDice)
            XCTAssertEqual(pure.tiles,endurance.tiles);XCTAssertEqual(pure.rngState,endurance.rngState)
        } }
    }
    func testEarlyPureDiceBiasLowersAverageValueWithoutAddingSpecialsOrExtraTiles() {
        for round in 1...4 {
            var pureTotal=0,normalTotal=0
            for seed in UInt64(1)...100 {
                let normal=NativeBoardFactory.make(mode:.arcade,board:round,seed:seed)
                let pure=NativeBoardFactory.make(mode:.arcade,board:round,seed:seed,arcadeVariant:.pureDice)
                pureTotal += pure.activeTiles.reduce(0){$0+$1.value};normalTotal += normal.activeTiles.reduce(0){$0+$1.value}
                XCTAssertEqual(pure.activeTiles.count,normal.activeTiles.count)
                XCTAssertFalse(pure.tiles.contains(where: \.isWild))
                XCTAssertEqual(pure.effectiveArcadeVariant,.pureDice)
            }
            XCTAssertLessThan(pureTotal,normalTotal)
        }
    }
}
