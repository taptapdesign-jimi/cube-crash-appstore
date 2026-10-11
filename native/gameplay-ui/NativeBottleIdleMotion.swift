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

#if canImport(UIKit) && canImport(SpriteKit)
import SpriteKit

/// Original Bottle tile.base owner, Source y-down converted exactly once.
/// Caller supplies painted-host ownership; closed/stale owners cannot restore C.
@MainActor final class NativeSourceBottleIdlePresentation:NativeSourceAnimationParticipant {
    private weak var host:SKSpriteNode?
    private let service:NativeSourceAnimationClockService,current:()->Bool
    private let position:CGPoint,anchor:CGPoint,rotation:CGFloat,scale:CGPoint,motionBase:CGPoint
    private var lease:NativeSourceAnimationClockService.Lease?,disposed=false,started=false
    init?(host:SKSpriteNode,service:NativeSourceAnimationClockService,current:@escaping()->Bool){
        guard service.sourceMicrotaskRAFBoundaryInstalled,current() else{return nil}
        let width=host.size.width,height=host.size.height
        guard width.isFinite,height.isFinite,host.position.x.isFinite,host.position.y.isFinite else{return nil}
        self.host=host;self.service=service;self.current=current
        position=host.position;anchor=host.anchorPoint;rotation=host.zRotation;scale = .init(x:host.xScale,y:host.yScale)
        motionBase = .init(x:host.position.x+width*(0.5-host.anchorPoint.x),y:host.position.y-height*host.anchorPoint.y)
    }
    @discardableResult func start()->Bool {
        guard !disposed,!started,let host,current() else{return false};started=true
        host.anchorPoint = .init(x:0.5,y:0);host.position=motionBase
        guard let captured=service.registerBottleIdleRepeat(participant:self,cleanup:{[weak self] _ in
            guard let self,!self.disposed else{return};self.dispose(restoring:self.current())
        }) else{dispose(restoring:true);return false}
        guard !disposed,current() else{captured.cancel();dispose(restoring:false);return false}
        lease=captured;return true
    }
    func advanceSourceAnimation(seconds:Double){
        guard !disposed,let host,current() else{dispose(restoring:false);return}
        let pose=NativeBottleIdleMotion.sample(seconds:seconds)
        host.position = .init(x:motionBase.x,y:motionBase.y-pose.y);host.zRotation=rotation-pose.rotation
    }
    func setSuspended(_ value:Bool){guard !disposed else{return};lease?.setSuspended(value)}
    func dispose(restoring:Bool=true){
        guard !disposed else{return};disposed=true;let old=lease;lease=nil;old?.cancel()
        guard restoring,current(),let host else{return}
        host.position=position;host.zRotation=rotation;host.xScale=scale.x;host.yScale=scale.y;host.anchorPoint=anchor
    }
    isolated deinit{dispose()}
}
#endif
