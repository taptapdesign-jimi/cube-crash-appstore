import Foundation
struct LetterStyle:Decodable {let style:String,bounce,exitRotation:Double;let exitFrom:[Double]}
struct Style:Decodable {let seed:UInt32,tilt:String,letters:[LetterStyle]}
struct Row:Decodable {let seed:UInt32,index:Int,phase:String,seconds:Double;let pose:[Double]}
struct Oracle:Decodable {let styles:[Style],rows:[Row]}
let oracle=try JSONDecoder().decode(Oracle.self,from:Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[1])))
var compositions:[UInt32:NativeNoMovesPlan.Composition]=[:]
for style in oracle.styles {
 var seed=style.seed
 let c=NativeNoMovesPlan.make {seed=1664525 &* seed &+ 1013904223;return Double(seed)/4294967296}
 compositions[style.seed]=c
 for (i,l) in c.letters.enumerated(){precondition(style.letters[i].style.contains("font-size: \(String(format:"%.1f",l.size))px"));precondition(abs(l.bounce-style.letters[i].bounce)<1e-12)}
}
var worst=0.0
var worstDetail=""
for row in oracle.rows {
 let letter=compositions[row.seed]!.letters[row.index],style=oracle.styles.first{$0.seed==row.seed}!.letters[row.index]
 let p:NativeNoMovesPlan.Pose
 if row.phase=="enter" {p=letter.enter(at:row.seconds,index:row.index)}else{let f=style.exitFrom;p=letter.exit(at:row.seconds,index:row.index,from:.init(scale:f[0],alpha:f[1],rx:f[2],ry:f[3],rz:f[4],z:f[5]),rotation:style.exitRotation)}
 for (i,pair) in zip([p.scale,p.alpha,p.rx,p.ry,p.rz,p.z],row.pose).enumerated(){let (a,b)=pair;if abs(a-b)>worst {worst=abs(a-b);worstDetail="seed \(row.seed) index \(row.index) phase \(row.phase) t \(row.seconds) component \(i) native \(a) source \(b)"}}
}
print(worstDetail)
precondition(worst<1e-6,"v9 GSAP mismatch \(worst)")
print("PASS native NO MOVES",oracle.rows.count,"actual v9 GSAP poses; max error",worst)
