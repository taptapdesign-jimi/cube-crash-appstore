import Foundation
import CoreGraphics
import StackToSixGameplay

@MainActor final class NativeSourceScreenShakeOverlayTarget {
    private let read:()->CGPoint,paint:(CGPoint)->Void,current:()->Bool
    init(read:@escaping()->CGPoint,paint:@escaping(CGPoint)->Void,current:@escaping()->Bool){self.read=read;self.paint=paint;self.current=current}
    func offset()->CGPoint {current() ? read():.zero}
    func apply(_ offset:CGPoint){guard current() else{return};paint(offset)}
    var isCurrent:Bool {current()}
    static func combining(_ first:NativeSourceScreenShakeOverlayTarget?,_ second:NativeSourceScreenShakeOverlayTarget?)->NativeSourceScreenShakeOverlayTarget? {
        guard let first else{return second};guard let second else{return first}
        return .init(read:{first.isCurrent ? first.offset():second.offset()},paint:{first.apply($0);second.apply($0)},current:{first.isCurrent || second.isCurrent})
    }
}

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
    struct Configuration:Equatable {
        enum Ease {case power2Out,sineInOut}
        let strength:Double,duration:Double,steps:Int,ease:Ease,yScale:Double
        var alsoShakeOverlay=false
        static func wild(archetype:NativeWildArchetype,isFinal:Bool,tntTargetCount:Int=0)->Self {
            let multiplier=isFinal ? 0:archetype == .tnt ? min(4,max(0,tntTargetCount)+1):2
            var strength=min(28,12+Double(max(1,multiplier))*4)
            if archetype == .tnt {strength=floor(min(100,floor(strength*5+0.5))*0.4+0.5)}
            let longer=archetype == .star || archetype == .juice
            if longer {strength=floor(strength*1.25+0.5)}
            return .init(strength:strength,duration:longer ? 0.52:0.26,steps:longer ? 32:16,ease:.sineInOut,yScale:1,alsoShakeOverlay:archetype == .tnt)
        }
        static let magnetPull=Self(strength:28,duration:0.36,steps:28,ease:.sineInOut,yScale:1)
        static func laserImpact(index:Int)->Self? {
            guard index==2 || index==3 else{return nil}
            return .init(strength:index==2 ? 9:12,duration:index==2 ? 0.18:0.22,steps:index==2 ? 10:12,ease:.power2Out,yScale:0.72,alsoShakeOverlay:true)
        }
        var totalDuration:Double {Double(steps)*max(0.01,duration/Double(max(1,steps)))+min(0.12,duration*0.45)}
    }
    struct Pose {var canvas:[Double],indicator:[Double],decor:[Double];var overlay:[Double]?=nil;var overlayInvocationID:UUID?=nil}
    private struct Child {let start,duration:Double;let target:Pose;let ease:Configuration.Ease;var from:Pose?}
    private var children:[Child]=[]
    private(set) var pose:Pose
    let zeroPose:Pose
    convenience init(strength:Double,initial:Pose,random:()->Double) {
        self.init(configuration:.init(strength:strength,duration:0.32,steps:18,ease:.power2Out,yScale:1),initial:initial,random:random)
    }
    init(configuration:Configuration,initial:Pose,random:()->Double) {
        pose=initial
        zeroPose = .init(canvas:[0,0],indicator:[0,0],decor:[0,0],overlay:configuration.alsoShakeOverlay ? [0,0]:nil,overlayInvocationID:initial.overlayInvocationID)
        let dt=max(0.01,configuration.duration/Double(max(1,configuration.steps)))
        for i in 0..<configuration.steps {
            let p=1-Double(i)/Double(configuration.steps),amp=configuration.strength*p*p
            let x=(random()*2-1)*amp,y=(random()*2-1)*amp*configuration.yScale
            children.append(.init(start:NativeSixSourceMath.q(Double(i)*dt,1e7),duration:NativeSixSourceMath.q(dt,1e7),
                target:.init(canvas:[x,y],indicator:[x*0.8,y*0.8],decor:[x*0.8,max(0,y*0.8)],overlay:configuration.alsoShakeOverlay ? [x,y]:nil,overlayInvocationID:initial.overlayInvocationID),ease:configuration.ease))
        }
        children.append(.init(start:NativeSixSourceMath.q(Double(configuration.steps)*dt,1e7),duration:min(0.12,configuration.duration*0.45),target:zeroPose,ease:.power2Out))
    }
    func captureInitial(_ value:Pose){if children.allSatisfy({$0.from==nil}){pose=value}}
    func advance(_ seconds:Double)->Pose {
        let t=NativeSixSourceMath.q(max(0,seconds),1e7)
        for i in children.indices where t>=children[i].start {
            if children[i].from==nil{children[i].from=pose}
            let from=children[i].from!,to=children[i].target,ratio=(t-children[i].start)/children[i].duration
            let p=children[i].ease == .power2Out ? NativeSixSourceMath.out(ratio):(1-cos(Double.pi*NativeSixSourceMath.unit(ratio)))/2
            // Actual CSSPlugin cache and transform renderer use four decimals.
            func mix(_ a:[Double],_ b:[Double])->[Double]{zip(a,b).map{NativeSixSourceMath.q($0+($1-$0)*p,1e4)}}
            pose = .init(canvas:mix(from.canvas,to.canvas),indicator:mix(from.indicator,to.indicator),decor:mix(from.decor,to.decor),overlay:to.overlay.map{mix(from.overlay ?? [0,0],$0)},overlayInvocationID:to.overlayInvocationID)
        }
        return pose
    }
}
