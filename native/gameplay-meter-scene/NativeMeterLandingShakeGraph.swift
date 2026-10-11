import Foundation

/// PRIVATE literal Source screenShake(app,{strength:14,duration:.38,steps:18,
/// ease:'power2.out',yScale:.85}). CSS points stay CSS points (not board scaled).
/// Child from-values capture on actual Source root advancement, not birth/paint.
final class NativeMeterLandingShakeGraph {
    struct Pose:Equatable {var canvas:[Double],indicator:[Double],decor:[Double]}
    private struct Child {let start,duration:Double,target:Pose;var from:Pose?}
    private var children:[Child]=[]
    private(set) var pose:Pose
    static let duration=0.5
    init(initial:Pose,random:()throws->Double)rethrows {
        pose=initial
        let dt=0.38/18
        for i in 0..<18 {
            let p=1-Double(i)/18,amp=14*p*p
            let x=(try random()*2-1)*amp,y=(try random()*2-1)*amp*0.85
            children.append(.init(start:Self.q(Double(i)*dt,1e7),duration:Self.q(dt,1e7),target:.init(canvas:[x,y],indicator:[x*0.8,y*0.8],decor:[x*0.8,max(0,y*0.8)])))
        }
        children.append(.init(start:0.38,duration:0.12,target:.init(canvas:[0,0],indicator:[0,0],decor:[0,0])))
    }
    func captureInitial(_ initial:Pose){if children.allSatisfy({$0.from==nil}){pose=initial}}
    func advance(_ seconds:Double)->Pose {
        let t=Self.q(max(0,seconds),1e7)
        for i in children.indices where t>=children[i].start {
            if children[i].from==nil{children[i].from=pose}
            let from=children[i].from!,to=children[i].target,p=1-pow(1-min(1,max(0,(t-children[i].start)/children[i].duration)),3)
            func mix(_ a:[Double],_ b:[Double])->[Double]{zip(a,b).map{Self.q($0+($1-$0)*p,1e4)}}
            pose = .init(canvas:mix(from.canvas,to.canvas),indicator:mix(from.indicator,to.indicator),decor:mix(from.decor,to.decor))
        }
        return pose
    }
    private static func q(_ n:Double,_ digits:Double)->Double{floor(n*digits+0.5)/digits}
}
