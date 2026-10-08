import Foundation

@MainActor protocol NativeNoMovesRootScheduling:AnyObject {
    func register(_ participant:any NativeSourceAnimationParticipant,family:NativeSourceAnimationRuntime.RootFamily,
                  duration:Double,delay:Double,paused:Bool,cleanup:@escaping(Bool)->Void)->NativeNoMovesRootLease?
}
@MainActor final class NativeNoMovesRootLease {
    let id:UInt64
    private let cancelBody:(Bool)->Void,suspendBody:(Bool)->Void,activeBody:()->Bool
    init(id:UInt64,cancel:@escaping(Bool)->Void,suspend:@escaping(Bool)->Void,active:@escaping()->Bool){self.id=id;cancelBody=cancel;suspendBody=suspend;activeBody=active}
    func cancel(_ success:Bool=false){cancelBody(success)}
    func setSuspended(_ paused:Bool){suspendBody(paused)}
    var active:Bool{activeBody()}
}
@MainActor final class NativeNoMovesValueScheduler:NativeNoMovesRootScheduling {
    let runtime:NativeSourceAnimationRuntime
    init(_ runtime:NativeSourceAnimationRuntime){self.runtime=runtime}
    func register(_ participant:any NativeSourceAnimationParticipant,family:NativeSourceAnimationRuntime.RootFamily,duration:Double,delay:Double,paused:Bool,cleanup:@escaping(Bool)->Void)->NativeNoMovesRootLease? {
        guard let lease=runtime.attach(participant:participant,family:family,duration:duration,delay:delay,initiallySuspended:paused,cleanup:cleanup)else{return nil}
        return .init(id:lease.receiptID,cancel:{lease.cancel(success:$0)},suspend:{lease.setSuspended($0)},active:{lease.active})
    }
}

/// PRIVATE actual Source root topology; contains no renderer tick, input lease,
/// fail classification or invented 1.5s timer. Infinity uses GSAP's literal 1e10
/// sentinel and remains owned by visible presentation until captured clear/exit.
@MainActor final class NativeNoMovesSourceGraph {
    typealias Pose=NativeNoMovesPlan.Pose
    @MainActor private final class Participant:NativeSourceAnimationParticipant {
        let paint:(Double)->Void
        init(_ paint:@escaping(Double)->Void){self.paint=paint}
        func advanceSourceAnimation(seconds:Double){paint(seconds)}
    }
    @MainActor private final class Root {
        let participant:Participant
        var lease:NativeNoMovesRootLease?
        let category:String
        init(_ category:String,_ paint:@escaping(Double)->Void){self.category=category;participant=Participant(paint)}
    }
    enum Failure:Error{case closed,stale}
    private let scheduler:any NativeNoMovesRootScheduling,current:()->Bool,random:()->Double
    private var roots:[UUID:Root]=[:],bounces:[NativeNoMovesRootLease]=[],closed=false,exiting=false
    private let scheduleExitFallback:((@escaping()->Void)->(()->Void))?
    private var fallbackCancellation:(()->Void)?
    private var cloudExitCaptured:[Int:NativeNoMovesCloudPlan.Cloud.Pose]=[:]
    private(set) var composition:NativeNoMovesPlan.Composition!
    private(set) var glyphs=Array(repeating:Pose(),count:8),clouds:[NativeNoMovesCloudPlan.Cloud]=[]
    private(set) var cloudPoses:[NativeNoMovesCloudPlan.Cloud.Pose]=[]
    var onGlyph:((Int,Pose)->Void)?,onCloud:((Int,NativeNoMovesCloudPlan.Cloud.Pose)->Void)?,onFinished:((Bool)->Void)?
    var activeIDs:[UInt64]{roots.values.compactMap{$0.lease?.id}.sorted()}
    var disposed:Bool{closed}
    init(width:Double,height:Double,scheduler:any NativeNoMovesRootScheduling,current:@escaping()->Bool,random:@escaping()->Double,scheduleExitFallback:((@escaping()->Void)->(()->Void))?=nil)throws {
        self.scheduler=scheduler;self.current=current;self.random=random;self.scheduleExitFallback=scheduleExitFallback
        guard current()else{throw Failure.stale}
        let tilt=(random()-0.5)*30,buckets=[[92.0,98,104],[66,72,80],[30,36,44,50],[66,72,80],[92,98,104],[30,36,44,50],[66,72,80],[30,36,44,50],[92,98,104]]
        let offset=min(8,Int(random()*9));var sizes:[Double]=[],letters:[NativeNoMovesPlan.Letter]=[]
        for i in 0..<8{let bucket=buckets[(i+offset)%9],base=bucket[min(bucket.count-1,Int(random()*Double(bucket.count)))];sizes.append(max(i==0 ? 75:28,base+random()*10-5))}
        do {
            for i in 0..<8 {
                let alpha=((0.8+random()*0.2)*100).rounded()/100
                // Registration precedes this glyph's bounce RNG, literal v9.
                let bounce=try root("bounce",family:.timeline,duration:1e10,paused:true,paint:{[weak self] time in self?.paintBounce(i,time)})
                bounces.append(bounce)
                let peak=1.02+random()*0.06,size=NativeNoMovesPlan.text[i]==" " ? 64:sizes[i]
                letters.append(.init(character:NativeNoMovesPlan.text[i],size:(size*10).rounded()/10,inkAlpha:alpha,bounce:peak))
            }
            composition = .init(tilt:tilt,letters:letters)
            // Per-cloud roots register between the original six draw groups.
            let w=max(320,width),h=max(520,height),base=min(240,max(104,w*0.22)),step=max(18,base*0.18)
            for i in 0..<5 {
                let boost=0.95+random()*0.4,size=((base+Double(i%3)*step)*boost).rounded(),height=(size/1.15).rounded()
                let scale=(0.9+Double(i%3)*0.08)*min(1.1,0.98+boost*0.1),delay=Double(i)*0.06*0.38
                let factor=1+(random()*2-1)*0.18,dy=(random()*2-1)*10,duration=(1.6*0.52+0.2)*factor*0.38,distance=w*0.32+random()*(w*0.3)
                let x=(w*0.5+(random()*2-1)*min(26,w*0.04)).rounded(),y=(h*0.5+(random()*2-1)*min(90,h*0.15)).rounded()
                let cloud=NativeNoMovesCloudPlan.Cloud(asset:i%4,width:size,height:height,x:x,y:y,rotation:Double(i%5-2)*5,baseScale:scale,enterDelay:delay,windDuration:duration,drift:distance*(i%2==0 ? -1:1),windY:dy)
                clouds.append(cloud);cloudPoses.append(.init(x:x,y:y,scale:0.12,alpha:0))
                _=try root("cloudEnter",family:.timeline,duration:Self.r7(0.0228+Self.r7(duration)),delay:delay,paint:{[weak self] t in self?.paintCloudEntry(i,t)})
                _=try root("cloudDelay",family:.eagerTween,duration:0,delay:cloud.exitAt,paint:{_ in},completed:{[weak self] success in if success{self?.beginCloudExit(i)}})
            }
            _=try root("textDelay",family:.eagerTween,duration:0,delay:0.2,paint:{_ in},completed:{[weak self] success in if success{self?.beginEntries()}})
        }catch{dispose();throw error}
    }
    @discardableResult private func root(_ category:String,family:NativeSourceAnimationRuntime.RootFamily,duration:Double,delay:Double=0,paused:Bool=false,paint:@escaping(Double)->Void,completed:@escaping(Bool)->Void={_ in})throws->NativeNoMovesRootLease {
        guard validate()else{throw Failure.closed}
        let id=UUID(),entry=Root(category,paint);roots[id]=entry
        guard let lease=scheduler.register(entry.participant,family:family,duration:duration,delay:delay,paused:paused,cleanup:{[weak self,weak entry] success in
            if let self,let entry,self.roots[id] === entry{self.roots.removeValue(forKey:id)}
            completed(success)
        })else{roots.removeValue(forKey:id);throw Failure.closed}
        guard validate(),roots[id] === entry else{lease.cancel();throw Failure.closed}
        entry.lease=lease;return lease
    }
    private func beginEntries(){
        guard validate(),!exiting else{return}
        do{for i in 0..<8 {
            _=try root("entry",family:.timeline,duration:0.54,delay:Double(i)*0.05,paint:{[weak self] t in self?.paintEntry(i,t)},completed:{[weak self] success in
                guard let self,success,self.validate(),!self.exiting,i<self.bounces.count else{return}
                self.bounces[i].setSuspended(false) // play(0), original linked slot.
            })
        }}catch{dispose()}
    }
    private func publish(_ i:Int,_ p:Pose){
        guard validate()else{return};glyphs[i]=p;onGlyph?(i,p)
        _=validate() // Resource callback can synchronously invalidate/retire.
    }
    private func paintEntry(_ i:Int,_ t:Double){
        var p=Pose()
        if t<0.3{let q=NativeNoMovesPlan.backOut(t/0.3,2);p.scale=Self.r6(1.2*q);p.alpha=Self.r6(q);p.rx=Self.r6(-5*q);p.z=Self.r6(20*q)}
        else if t<0.42{let q=NativeNoMovesPlan.powerOut((t-0.3)/0.12);p.scale=Self.r6(1.2-0.25*q);p.alpha=1;p.rx=Self.r6(-5+5*q);p.z=Self.r6(20-20*q)}
        else{p.scale=Self.r6(0.95+0.05*NativeNoMovesPlan.backOut((t-0.42)/0.12,1.5));p.alpha=1}
        publish(i,p)
    }
    private func paintBounce(_ i:Int,_ t:Double){
        guard validate(),composition != nil else{return}
        let phase=Self.r7(t).truncatingRemainder(dividingBy:0.7)/0.35,q=phase<=1 ? phase:2-phase
        var p=glyphs[i];p.scale=Self.r6(1+(composition.letters[i].bounce-1)*NativeNoMovesPlan.elasticInOut(q));p.rz=0;publish(i,p)
    }
    private func paintCloudEntry(_ i:Int,_ t:Double){
        guard validate()else{return}
        let c=clouds[i];func sine(_ p:Double)->Double{(1-cos(min(1,max(0,p)) * .pi))/2}
        let x=c.x+Self.r6(c.drift*sine((t-0.0228)/Self.r7(c.windDuration))),y=c.y+Self.r6(c.windY*sine((t-0.0228)/Self.r7(c.windDuration*0.55)))
        let scale:Double,alpha:Double
        if t<0.1292{let q=NativeNoMovesPlan.backOut(t/0.1292,2.2);scale=Self.r6(0.12+(c.baseScale*1.22-0.12)*q);alpha=Self.r6(0.8*q)}
        else{let q=NativeNoMovesPlan.powerOut((t-0.1292)/0.0532);let from=Self.r6(c.baseScale*1.22);scale=Self.r6(from+(c.baseScale-from)*q);alpha=0.8}
        cloudPoses[i] = .init(x:x,y:y,scale:scale,alpha:alpha);onCloud?(i,cloudPoses[i]);_=validate()
    }
    private func beginCloudExit(_ i:Int){
        guard validate()else{return}
        cloudExitCaptured[i]=cloudPoses[i]
        do{_=try root("cloudExit",family:.timeline,duration:0.1824,paint:{[weak self] t in self?.paintCloudExit(i,t)})}catch{dispose()}
    }
    private func paintCloudExit(_ i:Int,_ t:Double){
        guard validate(),let from=cloudExitCaptured[i]else{return}
        let c=clouds[i],alpha=min(0.88,from.alpha==0 ? 0.8:from.alpha),scale:Double,opacity:Double
        if t<0.0532{let q=NativeNoMovesPlan.backOut(t/0.0532,2);scale=from.scale+(c.baseScale*1.14-from.scale)*q;opacity=from.alpha+(alpha-from.alpha)*q}
        else{let q=NativeNoMovesPlan.backIn((t-0.0532)/0.1292,1.55);scale=Self.r6(c.baseScale*1.14)*(1-q);opacity=alpha*(1-q)}
        cloudPoses[i] = .init(x:from.x,y:from.y,scale:Self.r6(scale),alpha:Self.r6(opacity));onCloud?(i,cloudPoses[i]);_=validate()
    }
    func beginExit(){
        guard validate(),!exiting else{return};exiting=true
        let captured=roots.values.filter{["bounce","entry","textDelay"].contains($0.category)};for r in captured{r.lease?.cancel()};bounces.removeAll()
        do{for i in 0..<8 {
            let from=glyphs[i]
            // Literal timeline registration happens BEFORE this exit RNG draw.
            var rotation=0.0
            _=try root("exit",family:.timeline,duration:0.6,delay:Double(i)*0.06,paint:{[weak self] t in
                var p=from
                if t<0.19{let q=NativeNoMovesPlan.powerOut(t/0.19);p.scale=Self.r6(from.scale+(1.1-from.scale)*q);p.z=Self.r6(from.z+(30-from.z)*q)}
                else{let q=pow(min(1,max(0,(t-0.19)/0.41)),3);p.scale=Self.r6(1.1*(1-q));p.alpha=Self.r6(from.alpha*(1-q));p.rx=Self.r6(from.rx+(45-from.rx)*q);p.ry=Self.r6(from.ry+(30-from.ry)*q);p.rz=Self.r6(from.rz+(rotation-from.rz)*q);p.z=Self.r6(30-130*q)}
                self?.publish(i,p)
            })
            rotation=12+random()*8
        }
        if let scheduleExitFallback {
            let cancel=scheduleExitFallback{[weak self] in self?.deliverExitFallback()}
            guard validate()else{cancel();return};fallbackCancellation=cancel
        }
        _=try root("exitDelay",family:.eagerTween,duration:0,delay:1.07,paint:{_ in},completed:{[weak self] success in if success{self?.finish(true)}})
        }catch{dispose()}
        // Caller supplies original independent 1190ms fallback via receipt API.
    }
    func deliverExitFallback(){guard validate(),exiting else{return};finish(true)}
    func dispose(){finish(false)}
    /// Predicate and resource callbacks are external. Revalidate terminal
    /// state AFTER predicate evaluation, before mutation/new-root publication.
    private func validate()->Bool {
        guard !closed else{return false}
        let admitted=current()
        guard !closed,admitted else{if !closed{finish(false)};return false}
        return true
    }
    private func finish(_ success:Bool){
        guard !closed else{return};closed=true
        let captured=roots.values.sorted{($0.lease?.id ?? 0)<($1.lease?.id ?? 0)}
        roots.removeAll();bounces.removeAll();onGlyph=nil;onCloud=nil
        let fallback=fallbackCancellation;fallbackCancellation=nil;fallback?()
        for root in captured{root.lease?.cancel()}
        let admitted=success ? current():false
        let callback=onFinished;onFinished=nil;callback?(success && admitted)
    }
    isolated deinit {
        closed=true;onGlyph=nil;onCloud=nil
        let captured=Array(roots.values);roots.removeAll();bounces.removeAll()
        let fallback=fallbackCancellation;fallbackCancellation=nil;fallback?()
        for root in captured{root.lease?.cancel()}
        let callback=onFinished;onFinished=nil;callback?(false)
    }
    private static func r6(_ x:Double)->Double{floor(x*1e6+0.5)/1e6}
    private static func r7(_ x:Double)->Double{floor(x*1e7+0.5)/1e7}
}
