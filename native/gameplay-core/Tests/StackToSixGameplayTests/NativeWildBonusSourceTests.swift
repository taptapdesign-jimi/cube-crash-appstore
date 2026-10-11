import XCTest
@testable import StackToSixGameplay
final class NativeWildBonusSourceTests:XCTestCase {
    func testConstructorDrawInterleavesBeforeEachDirectionAndRefusalHasNoDirectionDraw(){
        var order:[String]=[],draw=0
        let cells=[NativeCell(column:0,row:0),NativeCell(column:1,row:0),NativeCell(column:2,row:0)]
        let result=NativeWildLockedBonusRules.allocate(count:3,emptyCells:cells,referenceAlpha:0.25,
            admitted:{true},isEmpty:{_ in true},random:{order.append("rng:\(draw)");draw+=1;return 0.2},
            construct:{cell,alpha in
                order.append("constructor:\(cell.column)");XCTAssertEqual(alpha,0.25)
                if cell.column==2{return false}
                order.append("tilt:\(draw)");draw+=1;return true
            })
        XCTAssertEqual(order,["rng:0","rng:1","constructor:1","tilt:2","rng:3","constructor:2","constructor:0","tilt:4","rng:5"])
        XCTAssertEqual(result.map(\.delayMilliseconds),[0,300]);XCTAssertEqual(draw,6)
    }
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
