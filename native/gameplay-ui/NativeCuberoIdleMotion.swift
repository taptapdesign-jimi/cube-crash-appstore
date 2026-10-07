import UIKit

/// Registry Cubero hop. Pickup restores the neutral pose; release recreates phase zero.
enum NativeCuberoIdleMotion {
    struct Pose {let x,y,rotation:CGFloat}
    static let activeDuration:Double = 0.88
    static let duration:Double = 1.0
    static func sample(seconds:Double)->Pose {
        let clock=max(0,seconds).truncatingRemainder(dividingBy:duration)
        guard clock<activeDuration else {return Pose(x:0,y:0,rotation:0)}
        let ends:[Double]=[0.28,0.36,0.64,0.72,0.88]
        let poses=[Pose(x:0,y:0,rotation:0),Pose(x:-2,y:-1,rotation:-0.045),Pose(x:-1,y:0,rotation:-0.030),Pose(x:2,y:-1,rotation:0.045),Pose(x:1,y:0,rotation:0.030),Pose(x:0,y:0,rotation:0)]
        let index=ends.firstIndex(where: {clock<$0}) ?? 4,start=index==0 ? 0:ends[index-1]
        let raw=CGFloat((clock-start)/(ends[index]-start)),p:CGFloat
        if index==4 {p=sin(raw * .pi/2)}
        else {p=(index==1 || index==3 ? NativeBoardMotion.Ease.power2Out:NativeBoardMotion.Ease.sineInOut).sample(raw)}
        let a=poses[index],b=poses[index+1]
        return Pose(x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p,rotation:a.rotation+(b.rotation-a.rotation)*p)
    }
}
