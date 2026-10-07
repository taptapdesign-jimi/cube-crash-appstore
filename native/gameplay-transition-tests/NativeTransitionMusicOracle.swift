import Foundation
enum NativeTransitionMusicOracle {struct Phase:Decodable {let gain,duration:Double};struct Row:Decodable{let theme:String,phases:[Phase]};static let rows=try! JSONDecoder().decode([Row].self,from:Data(json.utf8));private static let json = #"""
[{"theme":"forest","phases":[{"gain":0.35835999999999996,"duration":1.35},{"gain":0.289,"duration":0.4},{"gain":0.1156,"duration":2.351},{"gain":0.19074,"duration":0.32}]},{"theme":"beach","phases":[{"gain":0.35835999999999996,"duration":1.35},{"gain":0.289,"duration":0.4},{"gain":0.1156,"duration":1.901},{"gain":0.19074,"duration":0.32}]},{"theme":"area55","phases":[{"gain":0.35835999999999996,"duration":2.35},{"gain":0.289,"duration":0.331},{"gain":0.1156,"duration":1.836},{"gain":0.19074,"duration":0.32}]}]
"""#
}
