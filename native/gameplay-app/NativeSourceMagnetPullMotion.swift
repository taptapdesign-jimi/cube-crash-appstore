import Foundation

/// Literal v9 per-tile timeline, before renderer coordinates are converted.
/// Scale axes and rotation starts are captured independently; no random draw
/// is made during sampling. Root delay belongs to the shared Source service.
struct NativeSourceMagnetPullMotion {
 struct Point:Equatable {var x:Double,y:Double}
 struct Pose:Equatable {var point:Point,rotation:Double,scaleX:Double,scaleY:Double,converged:Bool}
 let start:Point,destination:Point,away:Point,startRotation:Double,rotationTarget:Double
 let scaleX:Double,scaleY:Double,delay:Double
 let duration=0.485
 init?(start:Point,destination:Point,rotation:Double,scaleX:Double,scaleY:Double,index:Int,count:Int,tileSize:Double=128,random:()->Double) {
  guard [start.x,start.y,destination.x,destination.y,rotation,scaleX,scaleY,tileSize].allSatisfy(\.isFinite),count>0,index>=0,index<count,tileSize>0 else{return nil}
  let first=random(),second=random()
  guard first.isFinite,second.isFinite,(0..<1).contains(first),(0..<1).contains(second) else{return nil}
  self.start=start;self.destination=destination;self.startRotation=rotation;self.scaleX=scaleX;self.scaleY=scaleY
  let dx=start.x-destination.x,dy=start.y-destination.y,distance=hypot(dx,dy)
  away=Point(x:start.x+(distance>0 ? dx/distance:0)*tileSize*0.63,y:start.y+(distance>0 ? dy/distance:0)*tileSize*0.63)
  rotationTarget=rotation+(10+first*20)*(second<0.5 ? 1:-1)*Double.pi/180
  delay=max(0,0.3+Double(index)*0.04-(index==count-1 ? 0.15:0))
 }
 private func round6(_ value:Double)->Double{floor(value*1_000_000+0.5)/1_000_000}
 private func clamp(_ x:Double)->Double{min(1,max(0,x))}
 private func power2Out(_ x:Double)->Double{let p=clamp(x);return 1-pow(1-p,3)}
 private func power2InOut(_ x:Double)->Double{let p=clamp(x);return p<0.5 ? 4*p*p*p:1-pow(-2*p+2,3)/2}
 func sample(seconds:Double,initializedPoint:Point?=nil,initializedRotation:Double?=nil)->Pose {
  let t=max(0,min(duration,seconds)),from=initializedPoint ?? start,fromRotation=initializedRotation ?? startRotation
  let initial=power2Out(t/0.05)
  var point=Point(x:round6(from.x+(away.x-from.x)*initial),y:round6(from.y+(away.y-from.y)*initial))
  var rotation=round6(fromRotation+(rotationTarget-fromRotation)*initial),sx=scaleX,sy=scaleY
  if t>=0.065 {
   let p=power2InOut((t-0.065)/0.35),ax=round6(away.x),ay=round6(away.y)
   point=Point(x:round6(ax+(destination.x-ax)*p),y:round6(ay+(destination.y-ay)*p))
  }
  if t>=0.135 {
   let p=power2InOut((t-0.135)/0.28)
   sx=round6(scaleX+(scaleX*0.40-scaleX)*p);sy=round6(scaleY+(scaleY*0.40-scaleY)*p)
   let r=power2InOut((t-0.135)/0.35),base=round6(rotationTarget)
   rotation=round6(base+(startRotation-base)*r)
  }
  let initialDistance=hypot(start.x-destination.x,start.y-destination.y)
  let distance=hypot(point.x-destination.x,point.y-destination.y)
  return Pose(point:point,rotation:rotation,scaleX:sx,scaleY:sy,converged:t>0 && (initialDistance==0 || 1-distance/initialDistance>=0.75))
 }
}
