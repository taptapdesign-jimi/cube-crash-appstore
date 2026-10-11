import Foundation
import XCTest
@testable import Stack_to_Six
private struct PullOracle:Decodable {let cases:[PullRow]}
private struct PullPoint:Decodable {let x:Double,y:Double}
private struct PullTile:Decodable {let x:Double,y:Double,rotation:Double,sx:Double,sy:Double,arrived:Bool}
private struct PullInitial:Decodable {let x:Double,y:Double;let rotG:Rot,scale:PullPoint;struct Rot:Decodable{let rotation:Double}}
private struct PullFrame:Decodable {let t:Double,tiles:[PullTile]}
private struct PullRow:Decodable {let count:Int,seed:Int,zero:Bool,initial:[PullInitial],random:[Double],draws:Int,delays:[Double],durations:[Double],samples:[PullFrame]}
@MainActor private final class PullOracleParticipant:NativeSourceAnimationParticipant {
  let paint:(Double)->Void
  init(_ paint:@escaping(Double)->Void){self.paint=paint}
  func advanceSourceAnimation(seconds:Double){paint(seconds)}
}
@MainActor final class NativeSourceMagnetPullOracleTests:XCTestCase {
 func testLiteralOriginalSixteenRootGraphsAnd32400PoseArrivalFields()throws {
  let oracle=try JSONDecoder().decode(PullOracle.self,from:Data(contentsOf:try XCTUnwrap(Bundle(for:Self.self).url(forResource:"SourceMagnetPullV9",withExtension:"json"))))
  var comparisons=0
  for row in oracle.cases {
   var draw=0;let motions=row.initial.enumerated().map{i,t in NativeSourceMagnetPullMotion(start:.init(x:t.x,y:t.y),destination:.init(x:148,y:64),rotation:t.rotG.rotation,scaleX:t.scale.x,scaleY:t.scale.y,index:i,count:row.count,random:{defer{draw+=1};return row.random[draw]})!}
   precondition(draw==row.draws)
   let runtime=NativeSourceAnimationRuntime(wallOriginMilliseconds:0)
   var arrivals=Array(repeating:false,count:row.count)
   var painted=row.initial.map{NativeSourceMagnetPullMotion.Pose(point:.init(x:$0.x,y:$0.y),rotation:$0.rotG.rotation,scaleX:$0.scale.x,scaleY:$0.scale.y,converged:false)}
   let participants=motions.enumerated().map{i,motion in PullOracleParticipant{seconds in
    let pose=motion.sample(seconds:seconds);painted[i]=pose;if pose.converged{arrivals[i]=true}
   }}
   for (i,motion) in motions.enumerated(){
    precondition(abs(motion.delay-row.delays[i])<1e-12);precondition(abs(motion.duration-row.durations[i])<1e-12)
    precondition(runtime.attach(participant:participants[i],family:.timeline,duration:motion.duration,delay:motion.delay,cleanup:{_ in}) != nil)
   }
   for frame in row.samples {
    // Numeric exporter root times all align integer ms; same source ticker
    // arithmetic is delivered to the actual admitted linked root traversal.
    runtime.deliverSourceTicker(seconds:frame.t,wallMilliseconds:frame.t*1000)
    for i in motions.indices {
     let pose=painted[i],tile=frame.tiles[i]
     for (label,a,b) in [("x",pose.point.x,tile.x),("y",pose.point.y,tile.y),("rotation",pose.rotation,tile.rotation),("sx",pose.scaleX,tile.sx),("sy",pose.scaleY,tile.sy)] {
      XCTAssertEqual(a,b,accuracy:1e-6,"linked count\(row.count) zero\(row.zero) tile\(i) t\(frame.t) \(label)");comparisons+=1
     }
     precondition(arrivals[i]==tile.arrived);comparisons+=1
    }
   }
   runtime.dispose()
  }
  XCTAssertEqual(oracle.cases.count,16);XCTAssertEqual(comparisons,32_400)
 }
}
