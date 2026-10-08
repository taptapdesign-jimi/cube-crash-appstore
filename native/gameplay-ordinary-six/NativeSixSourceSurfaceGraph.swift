import Foundation

/// PRIVATE original scalar graph. It owns neither clock nor Scene state.
enum NativeSixSourceMath {
    static func q(_ n:Double,_ digits:Double)->Double {floor(n*digits+0.5)/digits}
    static func unit(_ n:Double)->Double {min(1,max(0,n))}
    static func out(_ n:Double)->Double {1-pow(1-unit(n),3)}
    static func elasticOut(_ n:Double,_ period:Double)->Double {
        let t=unit(n);if t==0 || t==1{return t}
        return pow(2,-10*t)*sin((t-period/4)*2*Double.pi/period)+1
    }
    static func backOut(_ n:Double)->Double {let t=unit(n)-1;return 1+4*t*t*t+3*t*t}
}

final class NativeSixSourceMultiplierGraph {
    struct Pose {var scale=0.12,alpha=0.0,rotation=0.0}
    private(set) var pose=Pose()
    private var backStart:Double?,shrinkStart:Double?
    func advance(_ seconds:Double)->Pose {
        let t=NativeSixSourceMath.q(max(0,seconds),1e7)
        let q={NativeSixSourceMath.q($0,1e6)}
        pose.alpha=q(NativeSixSourceMath.out(t/0.06))
        pose.scale=q(0.12+1.14*NativeSixSourceMath.elasticOut(t/0.18,0.55))
        if t>=0.12 {
            if backStart==nil{backStart=pose.scale}
            pose.scale=q(backStart!+(1-backStart!)*NativeSixSourceMath.backOut((t-0.12)/0.1))
            let local=min(0.16,max(0,t-0.12)),r=local<=0.08 ? local/0.08:(0.16-local)/0.08
            pose.rotation=q(0.05*(1-cos(Double.pi*r))/2)
        }
        if t>=0.42 {
            if shrinkStart==nil{shrinkStart=pose.scale}
            let ratio=1-NativeSixSourceMath.elasticOut(1-(t-0.42)/0.22,0.6)
            pose.scale=q(shrinkStart!*(1-ratio))
            pose.alpha=q(1-pow(NativeSixSourceMath.unit((t-0.42)/0.16),2))
        }
        return pose
    }
}

final class NativeSixSourceShakeGraph {
    struct Pose {var canvas:[Double],indicator:[Double],decor:[Double]}
    private struct Child {let start,duration:Double;let target:Pose;var from:Pose?}
    private var children:[Child]=[]
    private(set) var pose:Pose
    init(strength:Double,initial:Pose,random:()->Double) {
        pose=initial
        for i in 0..<18 {
            let p=1-Double(i)/18,amp=strength*p*p
            let x=(random()*2-1)*amp,y=(random()*2-1)*amp
            children.append(.init(start:NativeSixSourceMath.q(Double(i)*0.32/18,1e7),duration:0.0177778,
                target:.init(canvas:[x,y],indicator:[x*0.8,y*0.8],decor:[x*0.8,max(0,y*0.8)])))
        }
        children.append(.init(start:0.32,duration:0.12,target:.init(canvas:[0,0],indicator:[0,0],decor:[0,0])))
    }
    func captureInitial(_ value:Pose){if children.allSatisfy({$0.from==nil}){pose=value}}
    func advance(_ seconds:Double)->Pose {
        let t=NativeSixSourceMath.q(max(0,seconds),1e7)
        for i in children.indices where t>=children[i].start {
            if children[i].from==nil{children[i].from=pose}
            let from=children[i].from!,to=children[i].target,p=NativeSixSourceMath.out((t-children[i].start)/children[i].duration)
            // Actual CSSPlugin cache and transform renderer use four decimals.
            func mix(_ a:[Double],_ b:[Double])->[Double]{zip(a,b).map{NativeSixSourceMath.q($0+($1-$0)*p,1e4)}}
            pose = .init(canvas:mix(from.canvas,to.canvas),indicator:mix(from.indicator,to.indicator),decor:mix(from.decor,to.decor))
        }
        return pose
    }
}
