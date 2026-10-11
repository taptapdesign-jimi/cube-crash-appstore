import Foundation
struct CloudOracle:Decodable {let width,height:Double,seed:UInt32,index:Int;let src,style:String;let rotation,exitAt:Double;let rows:[[Double]]}
let cases=try JSONDecoder().decode([CloudOracle].self,from:Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[1])))
var worst=0.0,count=0
var detail=""
for row in cases {
 var seed=row.seed;let plans=NativeNoMovesCloudPlan.make(width:row.width,height:row.height){seed=1664525 &* seed &+ 1013904223;return Double(seed)/4294967296},p=plans[row.index]
 precondition(row.src=="./"+NativeNoMovesCloudPlan.paths[p.asset]);precondition(abs(row.exitAt-p.exitAt)<1e-10)
 precondition(row.style.contains("width: \(Int(p.width))px") && row.style.contains("height: \(Int(p.height))px") && row.style.contains("left: \(Int(p.x))px") && row.style.contains("top: \(Int(p.y))px"))
 for actual in row.rows {let pose=p.sample(at:actual[0]);for (index,pair) in zip([pose.x-p.x,pose.y-p.y,pose.scale,pose.alpha],Array(actual.dropFirst())).enumerated(){let(a,b)=pair;if abs(a-b)>worst{worst=abs(a-b);detail="seed \(row.seed) cloud \(row.index) t \(actual[0]) component \(index) native \(a) source \(b)"}};count+=1}
}
print("cloud max error",worst,detail)
if worst>=1.1e-6 {print("FAIL cloud GSAP mismatch");exit(1)}
print("PASS native NO MOVES clouds",cases.count,"v9 plans",count,"GSAP poses")
