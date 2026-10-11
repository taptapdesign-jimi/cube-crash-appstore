import Foundation
struct Input:Decodable {
 struct C:Decodable {let id:String,bounds:[Double],pointerBounds:[Double]}
 let source:[Double],candidates:[C],pointer:[Double]?,expected:String?
}
func rect(_ a:[Double])->CGRect {CGRect(x:a[0],y:a[1],width:a[2],height:a[3])}
let cases=try JSONDecoder().decode([Input].self,from:Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[1])))
for (i,c) in cases.enumerated() {
 let targets=c.candidates.map {NativeRegularDropTarget.Candidate(id:$0.id,bounds:rect($0.bounds),pointerBounds:rect($0.pointerBounds))}
 let p=c.pointer.map {CGPoint(x:$0[0],y:$0[1])}
 let actual=NativeRegularDropTarget.pick(source:rect(c.source),candidates:targets,pointer:p,tileSize:128)
 precondition(actual==c.expected,"v9 mismatch case \(i): \(String(describing:actual)) vs \(String(describing:c.expected))")
}
print("PASS actual v9 ordinary target \(cases.count) cases")
