import Foundation
import CoreGraphics

enum NativeIdleBubbleMotion {
    enum Family {case honey,bottle,juice,fish,beachBall
        var motionScale:Double {self == .honey ? 1.3:self == .bottle ? 1:1.4}
        var colors:[UInt32] {self == .honey ? [0xF7D58A,0xF2BB4F]:self == .bottle ? [0xCCF3F1,0xFFFFFF]:[0xFFE6E1,0xFFF2E9,0xFFD5D6]}
    }
    static func family(kind:String,variant:String?)->Family? {
        switch variant {
        case "honey":return .honey
        case "bottle":return .bottle
        case "fish":return .fish
        case "beach-ball":return .beachBall
        case "mushroom","robo-cube":return nil
        default:return kind=="juice" || kind=="wild-juice" ? .juice:nil
        }
    }
    struct Pose {let x,y,scaleX,scaleY,alpha:Double;let tint:UInt32}
    struct Plan {
        let family:Family,radius:Double,color:UInt32,startX,startScale,startAlpha,duration,scaleX,scaleY,nextDelay:Double,points:[CGPoint]
        func sample(seconds:Double)->Pose {
            let progress=min(1,max(0,seconds/duration))
            let growth=1-pow(1-min(1,progress/0.3),3)
            let alpha=startAlpha*(1-pow(min(1,max(0,(progress-0.6)/0.4)),3))
            let x,y:Double
            if family == .honey {
                let p=1-pow(1-progress,2)
                x=startX+(Double(points.last!.x)-startX)*p;y=64+(Double(points.last!.y)-64)*p
            } else {
                let master=0.5-0.5*cos(Double.pi*progress),fraction=master*Double(points.count),index=min(points.count-1,Int(floor(fraction))),raw=min(1,fraction-Double(index)),p=raw
                let a=index==0 ? CGPoint(x:startX,y:64):points[index-1],b=points[index]
                x=Double(a.x)+(Double(b.x)-Double(a.x))*p;y=Double(a.y)+(Double(b.y)-Double(a.y))*p
            }
            let tint:UInt32
            if family == .bottle {
                // GSAP's numeric PropertyTween writes its target field at six
                // decimal places before the authored onUpdate RGB quantization.
                let p=((0.5-0.5*cos(Double.pi*progress))*1_000_000).rounded()/1_000_000
                tint=UInt32((204+51*p).rounded())<<16|UInt32((243+12*p).rounded())<<8|UInt32((241+14*p).rounded())
            } else {tint=0xFFFFFF}
            return Pose(x:x,y:y,scaleX:startScale+(scaleX-startScale)*growth,scaleY:startScale+(scaleY-startScale)*growth,alpha:alpha,tint:tint)
        }
    }
    /// Selected Backpack only: small spring overshoot and reciprocal squash,
    /// sampled from the existing bubble age without another animation owner.
    static func collectionPose(_ pose:Pose,seconds:Double)->Pose {
        let t=max(0,seconds),admission=min(1,t/0.12)
        let squash=0.14*sin(t * .pi * 3.2)*admission
        let spring=1+0.12*exp(-3.5*t)*sin(t * .pi * 5)
        return Pose(x:pose.x,y:pose.y-2.2*sin(t * .pi * 3.2)*admission,
                    scaleX:pose.scaleX*(1+squash)*spring,
                    scaleY:pose.scaleY/(1+squash)*spring,alpha:pose.alpha,tint:pose.tint)
    }
    static func make(family:Family,random:()->Double,includeNextDelay:Bool=true)->Plan {
        let radius=(15+random()*25)/2,color=family == .bottle ? UInt32(0xFFFFFF):family.colors[min(family.colors.count-1,Int(floor(random()*Double(family.colors.count))))]
        let startX=(random()-0.5)*128*0.8,startScale=0.2+random()*0.2,startAlpha=0.7+random()*0.3,endX=startX+(random()-0.5)*20,duration=(0.8+random()*0.7)*family.motionScale
        let scaleX=0.6+random()*0.4,scaleY=0.6+random()*0.4,direction:Double=random()<0.5 ? -1:1,distance=family == .bottle ? 10+random()*8:(12+random()*10)*0.7
        let juiceEnd=endX-direction*distance*(0.2+random()*0.25),rise=128*1.3,points:[CGPoint]
        if family == .bottle {points=[CGPoint(x:startX+direction*distance,y:64-rise*0.25),CGPoint(x:startX-direction*distance,y:64-rise*0.5),CGPoint(x:startX+direction*distance*0.75,y:64-rise*0.75),CGPoint(x:endX,y:64-rise)]}
        else if family == .honey {points=[CGPoint(x:endX,y:64-rise)]}
        else {points=[CGPoint(x:startX+direction*distance*0.7,y:64-rise*0.16),CGPoint(x:startX-direction*distance,y:64-rise*0.37),CGPoint(x:startX+direction*distance*0.85,y:64-rise*0.58),CGPoint(x:startX-direction*distance*0.65,y:64-rise*0.79),CGPoint(x:juiceEnd,y:64-rise)]}
        return Plan(family:family,radius:radius,color:color,startX:startX,startScale:startScale,startAlpha:startAlpha,duration:duration,scaleX:scaleX,scaleY:scaleY,nextDelay:includeNextDelay ? (0.3+random()*0.3)*family.motionScale:0,points:points)
    }
}


extension NativeIdleBubbleMotion {
    /// Source delayed callbacks use their actual arrival as the next producer
    /// origin. The finite six-slot pool follows the maximum authored lifetime.
    final class Runtime {
        struct Bubble {let id:Int,slot:Int,born:Double,plan:Plan}
        private let family:Family,random:()->Double
        private(set) var bubbles:[Bubble]=[],elapsed=0.0,running=true
        private var nextBirth=0.0,sequence=0,cursor=0
        init(family:Family,random:@escaping()->Double) {self.family=family;self.random=random;emit()}
        func advance(_ delta:Double) {
            guard running else {return}
            elapsed+=max(0,delta)
            bubbles.removeAll {elapsed-$0.born >= $0.plan.duration}
            if elapsed>=nextBirth {emit()}
        }
        private func emit() {
            guard let slot=(0..<6).map({(cursor+$0)%6}).first(where:{candidate in !bubbles.contains {$0.slot==candidate}}) else {return}
            cursor=(slot+1)%6;sequence+=1
            let plan=NativeIdleBubbleMotion.make(family:family,random:random)
            bubbles.append(Bubble(id:sequence,slot:slot,born:elapsed,plan:plan));nextBirth=elapsed+plan.nextDelay
        }
        func stopForPointer() {running=false;bubbles.removeAll()}
        func restartAfterLanding() {guard !running else {return};running=true;elapsed=0;nextBirth=0;emit()}
    }
}

/// Literal Source spawnBubble producer. Each next delay is one finite eager
/// root on the shared transport. The mounted compositor supplies bubble roots
/// synchronously BEFORE the next-delay draw, exactly as fx.ts does.
/// Not admitted to Scene until its full bubble root compositor is implemented.
@MainActor final class NativeSourceFizzProducerClock {
    @MainActor private final class Participant:NativeSourceAnimationParticipant {
        func advanceSourceAnimation(seconds:Double){}
    }
    private struct Entry {let participant:Participant,lease:NativeSourceAnimationClockService.Lease}
    private let service:NativeSourceAnimationClockService,family:NativeIdleBubbleMotion.Family
    private let random:()->Double,current:()->Bool,paintable:()->Bool,emit:(NativeIdleBubbleMotion.Plan)->Void
    private var delay:Entry?,disposed=false,started=false,visible=true,epoch:UInt64=0
    var activeRootCount:Int {delay?.lease.active==true ? 1:0}
    init(service:NativeSourceAnimationClockService,family:NativeIdleBubbleMotion.Family,
         random:@escaping()->Double,current:@escaping()->Bool,paintable:@escaping()->Bool,
         emit:@escaping(NativeIdleBubbleMotion.Plan)->Void){
        self.service=service;self.family=family;self.random=random
        self.current=current;self.paintable=paintable;self.emit=emit
    }
    private func live()->Bool {guard !disposed else{return false};let value=current();return value && !disposed}
    @discardableResult func start()->Bool {
        guard !started,live() else{return false};started=true;return spawn()
    }
    private func spawn()->Bool {
        guard live() else{dispose();return false}
        let canPaint=paintable()
        guard live() else{dispose();return false}
        if canPaint {
            let plan=NativeIdleBubbleMotion.make(family:family,random:random,includeNextDelay:false)
            guard live() else{dispose();return false}
            emit(plan)
            guard live() else{dispose();return false}
        }
        // Original still draws its next delay if a live tile cannot paint.
        let sample=random()
        guard sample.isFinite,(0..<1).contains(sample),live() else{dispose();return false}
        let captured=epoch,participant=Participant()
        guard let lease=service.register(participant:participant,duration:0,domain:.sourceGSAP(.eagerTween),
            delay:(0.3+sample*0.3)*family.motionScale,initiallySuspended:!visible,
            cleanup:{[weak self] success in
                guard let self,!self.disposed,self.epoch==captured else{return}
                self.delay=nil
                guard success,self.live() else{self.dispose();return}
                _ = self.spawn()
            }) else{dispose();return false}
        delay = .init(participant:participant,lease:lease);return true
    }
    func setVisible(_ value:Bool){guard !disposed,visible != value else{return};visible=value;delay?.lease.setSuspended(!value)}
    func dispose(){guard !disposed else{return};disposed=true;epoch &+= 1;let old=delay;delay=nil;old?.lease.cancel()}
    isolated deinit{dispose()}
}

/// One original bubble owns independent scale/rise/tint/fade roots. Retirement
/// belongs to the APP microtask checkpoint after the full RAF root render.
/// Scene mounting remains gated by complete compositor/visibility admission.
@MainActor final class NativeSourceFizzBubbleClock {
    @MainActor private final class Participant:NativeSourceAnimationParticipant {
        let step:(Double)->Void
        init(_ step:@escaping(Double)->Void){self.step=step}
        func advanceSourceAnimation(seconds:Double){step(seconds)}
    }
    private struct Entry {let participant:Participant,lease:NativeSourceAnimationClockService.Lease}
    private let service:NativeSourceAnimationClockService,tasks:NativeSourceMicrotaskFIFO.Scope
    private let plan:NativeIdleBubbleMotion.Plan,current:()->Bool
    private let paint:(NativeIdleBubbleMotion.Pose)->Void,retired:()->Void
    private var entries:[UUID:Entry]=[:],disposed=false,started=false,visible=true
    private var x,y,scaleX,scaleY,alpha:Double,tint:UInt32
    var activeRootCount:Int{entries.values.filter{$0.lease.active}.count}
    init(service:NativeSourceAnimationClockService,tasks:NativeSourceMicrotaskFIFO.Scope,
         plan:NativeIdleBubbleMotion.Plan,current:@escaping()->Bool,
         paint:@escaping(NativeIdleBubbleMotion.Pose)->Void,retired:@escaping()->Void){
        self.service=service;self.tasks=tasks;self.plan=plan;self.current=current
        self.paint=paint;self.retired=retired;x=plan.startX;y=64
        scaleX=plan.startScale;scaleY=plan.startScale;alpha=plan.startAlpha
        tint=plan.family == .bottle ? 0xCCF3F1:0xFFFFFF
    }
    private func live()->Bool {
        guard !disposed,tasks.admissionOpen else{return false}
        let accepted=current();return accepted && !disposed && tasks.admissionOpen
    }
    private func publish(){
        guard live() else{dispose();return}
        paint(.init(x:x,y:y,scaleX:scaleX,scaleY:scaleY,alpha:alpha,tint:tint))
        if !live(){dispose()}
    }
    @discardableResult func start()->Bool {
        guard !started,live() else{return false};started=true;publish()
        guard live(),attach(duration:plan.duration*0.3,step:{[weak self] time in
            guard let self else{return};let pose=self.plan.sample(seconds:time)
            self.scaleX=pose.scaleX;self.scaleY=pose.scaleY;self.publish()
        }) else{dispose();return false}
        guard attach(duration:plan.duration,rise:true,step:{[weak self] time in
            guard let self else{return};let pose=self.plan.sample(seconds:time)
            self.x=pose.x;self.y=pose.y;self.publish()
        }) else{dispose();return false}
        if plan.family == .bottle {
            guard attach(duration:plan.duration,step:{[weak self] time in
                guard let self else{return};self.tint=self.plan.sample(seconds:time).tint;self.publish()
            }) else{dispose();return false}
        }
        guard attach(duration:plan.duration*0.4,delay:plan.duration*0.6,step:{[weak self] time in
            guard let self else{return};self.alpha=self.plan.sample(seconds:self.plan.duration*0.6+time).alpha;self.publish()
        }) else{dispose();return false}
        return live()
    }
    private func attach(duration:Double,delay:Double=0,rise:Bool=false,step:@escaping(Double)->Void)->Bool {
        guard live() else{return false}
        let id=UUID(),participant=Participant{[weak self] time in
            guard let self,self.live() else{self?.dispose();return};step(time)
        }
        guard let lease=service.register(participant:participant,duration:duration,
            domain:.sourceGSAP(.defaultLazyTween),delay:delay,initiallySuspended:!visible,
            cleanup:{[weak self] success in
                guard let self,!self.disposed else{return};self.entries.removeValue(forKey:id)
                guard self.live() else{self.dispose();return}
                if rise && success {
                    guard self.tasks.enqueue({[weak self] in
                        guard let self,self.live() else{self?.dispose();return}
                        self.dispose();self.retired()
                    }) else{self.dispose();return}
                }
            }) else{return false}
        guard live() else{lease.cancel();return false}
        entries[id] = .init(participant:participant,lease:lease);return true
    }
    func setVisible(_ value:Bool){
        guard !disposed,visible != value else{return};visible=value
        let captured=Array(entries.values);captured.forEach{$0.lease.setSuspended(!value)}
    }
    func dispose(){
        guard !disposed else{return};disposed=true
        let captured=Array(entries.values);entries.removeAll();captured.forEach{$0.lease.cancel()}
    }
    isolated deinit{dispose()}
}
