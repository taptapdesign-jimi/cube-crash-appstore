import Foundation

/// Separate from animation roots: resource IDs/generation guards belong to the
/// renderer. No effect may acquire hot/RNG/activity before admission succeeds.
@MainActor
protocol NativeSharedSmokeRootResources:AnyObject {
    func mountLayer()
    func acquirePuff(id:Int)
    func configurePuff(_ puff:NativeSharedSmokeRootValues.Puff)
    func paintPuff(id:Int,x:Double,y:Double,alpha:Double)
    func releasePuff(id:Int)
    func acquireHalo(radius:Double,color:UInt32,fillAlpha:Double)
    func paintHalo(alpha:Double)
    func releaseHalo()
    func retireLayer()
    var isAdmitted:Bool{get}
}

/// PRIVATE immediate topology controller, shared by pure proof and SpriteKit
/// projection. Each authored GLOBAL root retains independent delivery order.
/// Child puff timelines grouped under one authored parent may share that root;
/// ungrouped puffs and both lazy halo tweens never use a Scene array clock.
@MainActor
final class NativeSharedSmokeRootOwner {
    enum AdmissionError:Error {case deferredNotProven,unboundedLifetime,staleResources,clockClosed}
    private let roots:NativeSharedSmokeRegisteredRoots,resources:any NativeSharedSmokeRootResources
    private let current:()->Bool
    private var values:NativeSharedSmokeRootValues?,birthClockMs=0.0,bodyEnd=0.46
    private var activePuffs=Set<Int>(),haloActive=false,releaseActivity:(()->Void)?
    private(set) var disposed=false
    var onFinished:((Bool)->Void)?
    var onParityFailure:((String)->Void)?
    var activeRootCount:Int{roots.activeRootCount}
    init(recipe:NativeSharedSmokeRecipe,generation:UInt64,sequence:UInt64,sourceOwnerID:String,
         resources:any NativeSharedSmokeRootResources,scheduler:any NativeSharedSmokeRootScheduler,
         sourceClockNow:()->Double,current:@escaping()->Bool,random:@escaping()->Double,
         consumeHot:()->Double,acquireActivity:(NativeSharedFxReceipt)->(()->Void)?)throws {
        guard !recipe.deferFutureBursts else{throw AdmissionError.deferredNotProven}
        guard recipe.ttl>0,recipe.ttl.isFinite else{throw AdmissionError.unboundedLifetime}
        guard current(),resources.isAdmitted else{throw AdmissionError.staleResources}
        self.current=current;self.resources=resources;roots=NativeSharedSmokeRegisteredRoots(scheduler:scheduler)
        // Source allocates parent before it knows puff durations. The wrapper
        // keeps this root alive only through its computed authored end; it is
        // canceled with success during the same delivery BEFORE next sibling.
        if recipe.groupedOwner {
            guard register(.init(kind:.body,family:.timeline,delay:0,duration:recipe.ttl+2+max(0,recipe.bursts)*max(0,recipe.burstGap))) else{throw AdmissionError.clockClosed}
        }
        guard current(),resources.isAdmitted else{finish(false);throw AdmissionError.staleResources}
        resources.mountLayer()
        if let label=recipe.activityLeaseLabel,!label.isEmpty {
            releaseActivity=acquireActivity(.init(kind:.smoke,generation:generation,sequence:sequence,label:label,tailMilliseconds:100,sourceOwnerID:sourceOwnerID))
        }
        guard register(.init(kind:.lifetime,family:.eagerTween,delay:recipe.ttl,duration:0)) else{finish(false);throw AdmissionError.clockClosed}
        birthClockMs=sourceClockNow()
        var registrationRejected=false
        values=NativeSharedSmokeRootValues(recipe:recipe,hotFactor:consumeHot(),generation:generation,sequence:sequence,gsapNowMs:birthClockMs,random:random,
            willBuildPuff:{[weak self] id in self?.activePuffs.insert(id);self?.resources.acquirePuff(id:id)},
            preparePuffTimeline:{[weak self] id,duration in
                guard let self,!recipe.groupedOwner else{return}
                if !self.register(.init(kind:.puff(id),family:.timeline,delay:0,duration:duration)){registrationRejected=true}
            },didBuildPuff:{[weak self] in self?.resources.configurePuff($0)},acquireActivity:{_ in nil})
        guard !registrationRejected else{finish(false);throw AdmissionError.clockClosed}
        bodyEnd=Self.round7(max(0.46,values!.puffs.map(\.finish).max() ?? 0))
        resources.acquireHalo(radius:values!.haloRadius,color:recipe.haloColor ?? recipe.color,fillAlpha:0.10*recipe.haloAlpha);haloActive=true
        if !recipe.groupedOwner {
            guard register(.init(kind:.haloIn,family:.defaultLazyTween,delay:0,duration:0.08)),register(.init(kind:.haloOut,family:.defaultLazyTween,delay:0.18,duration:0.28)) else{finish(false);throw AdmissionError.clockClosed}
        }
        // Literal initial geometry/alpha are written synchronously, without
        // a fabricated zero-time GSAP onUpdate or draw during paint.
    }
    private func register(_ root:NativeSharedSmokeRootPlan.Registration)->Bool {
        roots.register(root,advance:{[weak self] kind,time in self?.advance(kind,time)},retired:{[weak self] kind,success in self?.retired(kind,success)})
    }
    private func advance(_ kind:NativeSharedSmokeRootPlan.Kind,_ seconds:Double){
        guard !disposed,let values else{return}
        guard current(),resources.isAdmitted else{finish(false);return}
        switch kind {
        case .body:
            let local=min(bodyEnd,seconds)
            // No blanket resource flush at beginning/end of Scene paint. Each
            // nested child releases exactly when its own source timeline exits.
            for puff in values.puffs {
                guard activePuffs.contains(puff.id) else{continue}
                let p=puff.pose(at:local);resources.paintPuff(id:puff.id,x:p.x,y:p.y,alpha:p.alpha)
                if local>=Self.round7(puff.finish){releasePuff(puff.id)}
            }
            if haloActive {resources.paintHalo(alpha:values.haloAlpha(gsapNowMs:birthClockMs+local*1000));if local>=0.46{releaseHalo()}}
            if seconds>=bodyEnd {roots.cancel(kind:.body,success:true)}
        case .puff(let id):
            guard activePuffs.contains(id),let puff=values.puffs.first(where:{$0.id==id}) else{return}
            let p=puff.pose(at:seconds);resources.paintPuff(id:id,x:p.x,y:p.y,alpha:p.alpha)
        case .haloIn:
            if haloActive{resources.paintHalo(alpha:values.haloAlpha(gsapNowMs:birthClockMs+seconds*1000))}
        case .haloOut:
            if haloActive{resources.paintHalo(alpha:values.haloAlpha(gsapNowMs:birthClockMs+(seconds+0.18)*1000))}
        case .lifetime,.burst:break
        }
    }
    private func retired(_ kind:NativeSharedSmokeRootPlan.Kind,_ success:Bool){
        guard !disposed else{return}
        guard success else{finish(false);return}
        switch kind{case .puff(let id):releasePuff(id);case .haloOut:releaseHalo();case .lifetime:finish(true);default:break}
    }
    private func releasePuff(_ id:Int){guard activePuffs.remove(id) != nil else{return};values?.markPuffReleased(id);resources.releasePuff(id:id)}
    private func releaseHalo(){guard haloActive else{return};haloActive=false;values?.markHaloReleased();resources.releaseHalo()}
    func dispose(){finish(false)}
    private func finish(_ success:Bool){
        guard !disposed else{return};disposed=true
        // Explicit cleanupFxContainer releases activity first. autoAdd TTL
        // releases its children first, then the capture before layer destroy.
        if !success{releaseCapturedActivity()}
        // Layer insertion order halo first, followed by surviving puffs.
        releaseHalo();for id in activePuffs.sorted(){releasePuff(id)}
        values?.sealValues();roots.retainEmptyTimelineTail();releaseCapturedActivity();resources.retireLayer()
        let callback=onFinished;onFinished=nil;callback?(success && current())
    }
    private func releaseCapturedActivity(){let release=releaseActivity;releaseActivity=nil;release?()}
    isolated deinit {
        releaseCapturedActivity()
        releaseHalo();for id in activePuffs.sorted(){releasePuff(id)}
        if !disposed{roots.dispose()};resources.retireLayer()
        let release=releaseActivity;releaseActivity=nil;release?()
        let callback=onFinished;onFinished=nil;callback?(false)
    }
    private static func round7(_ x:Double)->Double{floor(x*1e7+0.5)/1e7}
}
