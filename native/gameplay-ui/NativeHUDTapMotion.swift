import Foundation

/// Cartoon Bounce: shared0.40s alert-derived contact recipe. Callers own existing UIKit/Scene clocks.
enum NativeHUDTapMotion {
    static let duration=0.4
    struct Pose {let x:Double,y:Double,offset:Double}
    static let poses:[Pose]=[.init(x:1,y:1,offset:0),.init(x:1.16,y:0.82,offset:3),.init(x:0.88,y:1.14,offset:-7),.init(x:1.08,y:0.92,offset:1),.init(x:0.97,y:1.03,offset:-2),.init(x:1,y:1,offset:0)]
    static let phases:[Double]=[0,0.10/0.58,0.22/0.58,0.34/0.58,0.46/0.58,1]
    static func pose(at elapsed:Double)->Pose {
        let phase=min(1,max(0,elapsed/duration))
        let i=(0..<5).first{phase<phases[$0+1]} ?? 4
        let t=(phase-phases[i])/(phases[i+1]-phases[i])
        let e=JimiV9Motion.Ease.cubicBezier(0.42,0,0.58,1).value(t)
        let a=poses[i],b=poses[i+1]
        return .init(x:a.x+(b.x-a.x)*e,y:a.y+(b.y-a.y)*e,offset:a.offset+(b.offset-a.offset)*e)
    }
}
