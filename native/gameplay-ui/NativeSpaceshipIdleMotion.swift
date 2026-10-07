import CoreGraphics
import Foundation

/// Source hover and engine share totalTime; the .12 repeat gap does not stop frames.
enum NativeSpaceshipIdleMotion {
    struct Pose {let x,y,rotation:CGFloat}
    struct EnginePose {let x,y,alpha,scale:CGFloat}
    static let duration:Double=4.52
    static func sample(seconds:Double)->Pose {
        let t=max(0,seconds).truncatingRemainder(dividingBy:duration)
        guard t<4.4 else {return Pose(x:0,y:0,rotation:0)}
        let angle=CGFloat(Double.pi/12),start:Double,end:Double,a:Pose,b:Pose
        if t<1.1 {start=0;end=1.1;a=Pose(x:0,y:0,rotation:0);b=Pose(x:-5,y:-3,rotation:-angle)}
        else if t<3.3 {start=1.1;end=3.3;a=Pose(x:-5,y:-3,rotation:-angle);b=Pose(x:5,y:3,rotation:angle)}
        else {start=3.3;end=4.4;a=Pose(x:5,y:3,rotation:angle);b=Pose(x:0,y:0,rotation:0)}
        let p=CGFloat(0.5-0.5*cos(Double.pi*(t-start)/(end-start)))
        return Pose(x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p,rotation:a.rotation+(b.rotation-a.rotation)*p)
    }
    static func frame(seconds:Double)->Int {Int(floor(max(0,seconds)/0.18))%4}
    static func engine(index:Int,seconds:Double)->EnginePose {
        let phase=Double(index)/9,local=(max(0,seconds).truncatingRemainder(dividingBy:1.8)/1.8+phase).truncatingRemainder(dividingBy:1)
        let lane=Double(index%5-2)*3.2,drift:Double=index%2==0 ? -1:1,travel=Double(12+(index%4)*3),opacity:Double=index%2==0 ? 0.60:0.78
        let visibility=min(min(1,local/0.16),min(1,(1-local)/0.30))
        return EnginePose(x:CGFloat(lane*(0.32+local*0.68)+sin(local*Double.pi*2+phase*Double.pi)*2.2+drift*local*1.8),y:CGFloat(27+local*travel),alpha:CGFloat(opacity*visibility),scale:CGFloat(0.72+(1-local)*0.48))
    }
}
