import Foundation
import CoreGraphics

/// Literal v9 tile-idle-bounce/cartoon tuning; source consumes these three
/// random draws after selection and before scheduling the next wake.
struct NativeRegularIdleMotion {
    struct Pose {let x:CGFloat,y:CGFloat,rotation:CGFloat}
    let squash:Bool
    let tilt:CGFloat
    static let duration=0.52,smokeTime=0.23
    init(variantDraw:Double,directionDraw:Double,tiltDraw:Double) {
        squash=variantDraw.isFinite && variantDraw>=0.5
        tilt=CGFloat(1.35*(0.82+tiltDraw*0.36)*(directionDraw>0.5 ? 1:-1)*Double.pi/180)
    }
    func sample(_ elapsed:Double)->Pose {
        let poses:[Pose]=[.init(x:1,y:1,rotation:0),
            .init(x:squash ? 0.97:1.035,y:squash ? 1.035:0.97,rotation:tilt),
            .init(x:squash ? 1.085:0.975,y:squash ? 0.975:1.085,rotation:-tilt*0.32),
            .init(x:squash ? 0.99:1.02,y:squash ? 1.02:0.99,rotation:0),.init(x:1,y:1,rotation:0)]
        let ends=[0.09,0.23,0.35,0.52]
        let eases:[NativeBoardMotion.Ease]=[.power2Out,.backOut(1.65),.power2Out,.backOut(1.9)]
        let t=min(Self.duration,max(0,elapsed))
        var start=0.0
        for index in ends.indices {
            if t<=ends[index] {
                let p=eases[index].sample(CGFloat((t-start)/(ends[index]-start))),a=poses[index],b=poses[index+1]
                return Pose(x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p,rotation:a.rotation+(b.rotation-a.rotation)*p)
            }
            start=ends[index]
        }
        return poses.last!
    }
}
