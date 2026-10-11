import Foundation
struct Row:Decodable {let width,height,safeTop,safeBottom:Double;let columns,rows:Int;let scale,left,top:Double}
let cases=try JSONDecoder().decode([Row].self,from:Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[1])))
var worst=0.0
for row in cases {
 let size=CGSize(width:row.width,height:row.height),g=NativeBoardGeometry(columns:row.columns,rows:row.rows,viewport:size,safeInsets:.init(top:row.safeTop,left:0,bottom:row.safeBottom,right:0))
 let top=row.height-g.origin.y-(Double(row.rows)*128+Double(row.rows-1)*20)*g.scale
 worst=max(worst,abs(g.scale-row.scale),abs(g.origin.x-row.left),abs(top-row.top))
 for r in 0..<row.rows {for c in 0..<row.columns {let hit=g.cell(at:g.center(row:r,column:c));precondition(hit?.row==r && hit?.column==c)}}
}
precondition(worst<1e-9,"v9 mismatch \(worst)")
print("PASS native final geometry",cases.count,"v9 cases; max error",worst)
