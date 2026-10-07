import CoreGraphics
import Foundation

/// Source special-dice-idle.ts: grounded bottom-pivot rock and shared repeat gap.
enum NativeBottleIdleMotion {
    struct Pose { let y,rotation:CGFloat }
    static let activeDuration:Double=7.2
    static let duration:Double=7.32
    static func sample(seconds:Double)->Pose {
        let t=max(0,seconds).truncatingRemainder(dividingBy:duration)
        guard t<activeDuration else {return Pose(y:0,rotation:0)}
        let radians=CGFloat(4.8 * Double.pi/180)
        let start:Double,end:Double,a:Pose,b:Pose
        if t<1.8 {start=0;end=1.8;a=Pose(y:0,rotation:0);b=Pose(y:-3,rotation:-radians)}
        else if t<5.4 {start=1.8;end=5.4;a=Pose(y:-3,rotation:-radians);b=Pose(y:2,rotation:radians)}
        else {start=5.4;end=7.2;a=Pose(y:2,rotation:radians);b=Pose(y:0,rotation:0)}
        let p=CGFloat(0.5-0.5*cos(Double.pi*(t-start)/(end-start)))
        return Pose(y:a.y+(b.y-a.y)*p,rotation:a.rotation+(b.rotation-a.rotation)*p)
    }
}
