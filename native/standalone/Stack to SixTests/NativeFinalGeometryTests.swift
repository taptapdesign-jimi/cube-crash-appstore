import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeFinalGeometryTests:XCTestCase {
    private struct Row:Decodable {let width,height,safeTop,safeBottom:Double;let columns,rows:Int;let scale,left,top:Double}
    func testActualNativeFinalGeometryMatches675ImmutableSourceLayoutsAndCellFootprints()throws {
        let resource=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"NativeFinalGeometryOracle",withExtension:"json"))
        let rows=try JSONDecoder().decode([Row].self,from:Data(contentsOf:resource));XCTAssertEqual(rows.count,675)
        for row in rows {
            let g=NativeBoardGeometry(columns:row.columns,rows:row.rows,viewport:CGSize(width:row.width,height:row.height),safeInsets:.init(top:row.safeTop,left:0,bottom:row.safeBottom,right:0))
            let top=row.height-g.origin.y-(Double(row.rows)*128+Double(row.rows-1)*20)*g.scale
            XCTAssertEqual(g.scale,row.scale,accuracy:1e-9);XCTAssertEqual(g.origin.x,row.left,accuracy:1e-9);XCTAssertEqual(top,row.top,accuracy:1e-9)
            for r in 0..<row.rows {for c in 0..<row.columns {
                let hit=g.cell(at:g.center(row:r,column:c));XCTAssertEqual(hit?.row,r);XCTAssertEqual(hit?.column,c)
                XCTAssertNil(g.cell(at:CGPoint(x:g.center(row:r,column:c).x+g.tileSize/2+1e-5,y:g.center(row:r,column:c).y)))
            }}
        }
    }
}
