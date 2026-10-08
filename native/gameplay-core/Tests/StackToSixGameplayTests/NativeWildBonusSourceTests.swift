import XCTest
@testable import StackToSixGameplay
final class NativeWildBonusSourceTests:XCTestCase {
    struct Case:Decodable {let count,room,draws:Int;let referenceAlpha:Double?;let rejected:Bool;let emptyCells:[Cell];let output:[Out]}
    struct Cell:Decodable {let c,r:Int}
    struct Out:Decodable {let c,r,direction:Int;let alpha:Double}
    func test192ExecutedOriginalLockedBonusAllocationsPreserveDrawOrderAndInheritedOpacity()throws {
        let rows=try JSONDecoder().decode([Case].self,from:NativeWildBonusOracle.data);XCTAssertEqual(rows.count,192)
        for row in rows {
            var draws=0
            let actual=NativeWildLockedBonusRules.allocate(count:row.count,emptyCells:row.emptyCells.map{.init(column:$0.c,row:$0.r)},referenceAlpha:row.referenceAlpha,admitted:{!row.rejected},isEmpty:{_ in true},random:{let n=draws;draws+=1;return Double((n*37+13)%101)/101})
            XCTAssertEqual(draws,row.draws)
            XCTAssertEqual(actual.map(\.cell),row.output.map{.init(column:$0.c,row:$0.r)})
            XCTAssertEqual(actual.map(\.alpha),row.output.map(\.alpha));XCTAssertEqual(actual.map(\.direction),row.output.map(\.direction))
            XCTAssertEqual(actual.map(\.delayMilliseconds),Array(0..<actual.count).map{$0*150})
        }
    }
}
