import Foundation

/// One stage-owned, protected Source container. Timelines and wall timers are
/// injected from existing app owners; this class creates neither a clock nor a
/// sprite pool. Every asynchronous callback carries its accepted job/flight.
@MainActor final class NativeSourceHUDStarJobs {
    typealias Cancel=()->Void
    struct Hooks {
        let current:()->Bool
        let acquireCadence:()->Cancel?
        let mountContainer:()->Bool
        let removeContainer:()->Void
        let mountStar:(String,NativeSourceHUDStarPlan)->Bool
        let paintStar:(String,NativeSourceHUDStarPlan.Pose)->Void
        let removeStar:(String)->Void
        let timeline:(NativeSourceHUDStarPlan,@escaping(Double)->Void,@escaping()->Void)->Cancel?
        let wall:(Double,@escaping()->Void)->Cancel
        let arrive:(String)->Void
        let retire:(UUID,[String])->Void
    }
    private final class Flight {
        let id:String,plan:NativeSourceHUDStarPlan
        var scale:Double,alive=true,cancel:Cancel?
        init(id:String,plan:NativeSourceHUDStarPlan){self.id=id;self.plan=plan;scale=plan.size/plan.textureWidth}
    }
    private final class Job {
        let id:UUID,ids:[String]
        var flights:[Flight]=[],cancelWall:Cancel?,retired=false
        init(id:UUID,ids:[String]){self.id=id;self.ids=ids}
    }
    private let hooks:Hooks
    private let readableCoins:Bool
    private var jobs:[UUID:Job]=[:],order:[UUID]=[]
    private var cadence:Cancel?,emptyWall:Cancel?
    private(set) var containerMounted=false
    private(set) var disposed=false
    var jobCount:Int{jobs.count}
    var liveStarIDs:[String]{order.compactMap{jobs[$0]}.flatMap{$0.flights.filter(\.alive).map(\.id)}}
    init(hooks:Hooks,readableCoins:Bool=false){self.hooks=hooks;self.readableCoins=readableCoins}
    private func current(_ job:Job)->Bool {
        guard !disposed,jobs[job.id] === job,!job.retired else{return false}
        let valid=hooks.current()
        return valid && !disposed && jobs[job.id] === job && !job.retired
    }
    /// IDs are one reward group (Native coins max7, Source reference max3); callers must never
    /// flatten several Core batches and cap their combined earned debt.
    @discardableResult func start(jobID:UUID,ids:[String],origin:CGPoint,target:CGPoint,textureWidth:Double,viewport:CGSize?=nil,gentleLaunch:Bool=false,bloobOrdinal:Int?=nil,random:()->Double)->Bool {
        guard !disposed,!ids.isEmpty,ids.count <= (readableCoins ? 7 : 3),Set(ids).count==ids.count,jobs[jobID]==nil,
              origin.x.isFinite,origin.y.isFinite,target.x.isFinite,target.y.isFinite,textureWidth.isFinite,textureWidth>0 else{return false}
        let valid=hooks.current();guard valid,!disposed else{return false}
        let job=Job(id:jobID,ids:ids);jobs[jobID]=job;order.append(jobID)
        let empty=emptyWall;emptyWall=nil;empty?();guard current(job) else{return false}
        if !containerMounted {
            // Publish ownership before external mount; reentrant disposal can
            // unhook this container, never resurrect it after mount returns.
            containerMounted=true
            guard hooks.mountContainer(),current(job),containerMounted else{retire(job);return false}
        }
        if cadence==nil {
            guard let release=hooks.acquireCadence() else{retire(job);return false}
            guard current(job),containerMounted else{release();retire(job);return false}
            cadence=release
        }
        let sizes=NativeSourceHUDStarPlan.sizeOrder(random:random);guard current(job) else{retire(job);return false}
        var previous=0.0,previousCoinEnd=0.0,maxEnd=0.0
        var coinLaunchInterval:Double?
        var plans:[NativeSourceHUDStarPlan]=[]
        for (ordinal,_) in ids.enumerated() {
            guard current(job) else{retire(job);return false}
            let sourcePlan=NativeSourceHUDStarPlan.construct(ordinal:ordinal,sizes:sizes,origin:origin,target:target,textureWidth:textureWidth,previousArrival:&previous,random:random)
            let baseline=readableCoins ? sourcePlan.readableCoin(ordinal:ordinal,previousEnd:&previousCoinEnd,viewport:viewport,gentleLaunch:gentleLaunch,launchInterval:coinLaunchInterval):sourcePlan
            if readableCoins,coinLaunchInterval==nil {coinLaunchInterval=(baseline.originalMotionDuration>0 ? baseline.originalMotionDuration:baseline.duration)*0.20}
            plans.append(bloobOrdinal.map{baseline.bloobScatter(ordinal:$0+ordinal,origin:origin,viewport:viewport)} ?? baseline)
        }
        for (id,plan) in zip(ids,plans) {
            guard current(job) else{retire(job);return false}
            let flight=Flight(id:id,plan:plan);job.flights.append(flight);maxEnd=max(maxEnd,plan.end)
            guard hooks.mountStar(id,plan),current(job),flight.alive else{retire(job);return false}
            let cancel=hooks.timeline(plan,{[weak self,weak job,weak flight] seconds in
                guard let self,let job,let flight else{return};self.advance(job,flight,seconds)
            },{[weak self,weak job,weak flight] in
                guard let self,let job,let flight,self.current(job),flight.alive else{return}
                self.remove(flight) // Source onComplete safety destroys without score.
            })
            guard let cancel else{retire(job);return false}
            guard current(job),flight.alive else{cancel();if !current(job){retire(job);return false};continue}
            flight.cancel=cancel
        }
        guard current(job) else{retire(job);return false}
        let cancel=hooks.wall((maxEnd+0.08)*1000,{[weak self,weak job] in
            guard let self,let job,self.current(job) else{return};self.retire(job)
        })
        guard current(job) else{cancel();return false};job.cancelWall=cancel
        return true
    }
    private func advance(_ job:Job,_ flight:Flight,_ seconds:Double) {
        guard current(job),flight.alive,seconds.isFinite,seconds>=0 else{return}
        let pose=flight.plan.sample(localSeconds:seconds,previousScale:flight.scale)
        flight.scale=pose.scale
        hooks.paintStar(flight.id,pose)
        guard current(job),flight.alive else{return}
        if pose.arrived {
            remove(flight)
            guard current(job) else{return}
            hooks.arrive(flight.id)
        }
    }
    private func remove(_ flight:Flight) {
        guard flight.alive else{return};flight.alive=false
        // Source arrival kills sprite rotation but path root lives until its
        // own completion/job wall cleanup. No root cancel is fabricated here.
        hooks.removeStar(flight.id)
    }
    private func retire(_ job:Job) {
        guard jobs[job.id] === job,!job.retired else{return}
        job.retired=true;jobs.removeValue(forKey:job.id);order.removeAll{$0==job.id}
        let wall=job.cancelWall;job.cancelWall=nil
        let roots=job.flights.compactMap(\.cancel);job.flights.forEach{$0.cancel=nil}
        let remaining=job.flights.filter(\.alive);remaining.forEach{$0.alive=false}
        wall?();roots.forEach{$0()};remaining.forEach{hooks.removeStar($0.id)}
        hooks.retire(job.id,job.ids)
        guard !disposed,jobs.isEmpty,containerMounted else{return}
        let release=cadence;cadence=nil;release?()
        guard !disposed,jobs.isEmpty,containerMounted,emptyWall==nil else{return}
        let cancel=hooks.wall(120,{[weak self] in self?.destroyEmptyContainer()})
        guard !disposed,jobs.isEmpty,containerMounted,emptyWall==nil else{cancel();return};emptyWall=cancel
    }
    private func destroyEmptyContainer() {
        guard !disposed,jobs.isEmpty,containerMounted else{return}
        emptyWall=nil;containerMounted=false;hooks.removeContainer()
    }
    /// Original forceCleanup protected graphs: unhook before all external
    /// callbacks, remove pending Core debt without an arrival/reward.
    func dispose() {
        guard !disposed else{return};disposed=true
        let captured=order.compactMap{jobs[$0]};jobs.removeAll();order.removeAll()
        let empty=emptyWall;emptyWall=nil;let release=cadence;cadence=nil
        let mounted=containerMounted;containerMounted=false
        empty?()
        for job in captured {
            job.retired=true;let wall=job.cancelWall;job.cancelWall=nil
            let roots=job.flights.compactMap(\.cancel);job.flights.forEach{$0.cancel=nil}
            let remaining=job.flights.filter(\.alive);remaining.forEach{$0.alive=false}
            wall?();roots.forEach{$0()};remaining.forEach{hooks.removeStar($0.id)};hooks.retire(job.id,job.ids)
        }
        release?();if mounted{hooks.removeContainer()}
    }
}
