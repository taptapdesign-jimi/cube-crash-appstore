import Foundation

@MainActor
protocol NativeRegularSixWallScheduling:AnyObject {
    func schedule(generation:UInt64,id:String,delayMilliseconds:Int,elapsed:@escaping()->Void)->NativeSharedSmokeRootCancellation
}

@MainActor
protocol NativeRegularSixSharedShardResources:AnyObject {
    var admitted:Bool{get}
    func mount()
    func acquire(id:Int)
    func configure(id:Int,points:[Double],rotation:Double,alpha:Double)
    func paintPosition(id:Int,x:Double,y:Double)
    func paintAlpha(id:Int,alpha:Double)
    func releaseAll()
    func retireLayer()
}

/// PRIVATE Source regularMerge6ShardsTemplated lifecycle. Two independent
/// default-lazy GLOBAL tween roots per shard, installed during source RNG
/// construction. Their completion does NOT release GraphicsPool resources.
/// The independent one-second setTimeout owns actual shard/resource cleanup.
@MainActor
final class NativeRegularSixSharedShardOwner {
    enum AdmissionError:Error{case unavailable,closedScheduler}
    private let resources:any NativeRegularSixSharedShardResources
    private let roots:NativeSharedSmokeRegisteredRoots
    private let current:()->Bool
    private var wall:NativeSharedSmokeRootCancellation?,scope:(()->Void)?
    private(set)var plan:NativeRegularSixSharedShardPlan?
    private(set)var disposed=false
    var onFinished:((Bool)->Void)?
    var activeRootCount:Int{roots.activeRootCount}
    init(patternIndex:Int,reduced:Bool,generation:UInt64,sequence:UInt64,sourceOwnerID:String,
         resources:any NativeRegularSixSharedShardResources,scheduler:any NativeSharedSmokeRootScheduler,
         wall:any NativeRegularSixWallScheduling,current:@escaping()->Bool,random:()->Double,
         acquireActivity:(NativeSharedFxReceipt)->(()->Void)?)throws {
        guard current(),resources.admitted else{throw AdmissionError.unavailable}
        self.resources=resources;self.current=current;roots=NativeSharedSmokeRegisteredRoots(scheduler:scheduler)
        let receipt=NativeSharedFxReceipt(kind:.shards,generation:generation,sequence:sequence,label:"regular-merge6-shards",tailMilliseconds:100,sourceOwnerID:sourceOwnerID)
        scope=acquireActivity(receipt)
        // Captured acquisition can reenter route disposal before retention.
        guard current(),resources.admitted else{finish(false);throw AdmissionError.unavailable}
        resources.mount()
        plan=NativeRegularSixSharedShardPlan(patternIndex:patternIndex,reduced:reduced,random:random,isActive:{[weak self] in self?.disposed==false},
            acquire:{[resources] id in resources.acquire(id:id)},
            materialize:{[resources] id,points,rotation,alpha in resources.configure(id:id,points:points,rotation:rotation,alpha:alpha)},
            registerTweens:{[weak self] id,shard in self?.register(id:id,shard:shard)})
        guard !disposed else{throw AdmissionError.closedScheduler}
        self.wall=wall.schedule(generation:generation,id:receipt.invocationID,delayMilliseconds:1000){[weak self] in self?.finish(true)}
    }
    private func register(id:Int,shard:NativeRegularSixShardPlan.Shard){
        guard !disposed else{return}
        // Source constants are fixed before lazy initialization: x=y=0 and
        // definition alpha. Travel and alpha roots do not share properties.
        let travel=roots.register(.init(kind:.puff(id),family:.defaultLazyTween,delay:0,duration:shard.travelDuration),advance:{[weak self] _,seconds in
            guard let self,self.validate() else{return}
            let p=NativeRegularSixFxMath.out(seconds/shard.travelDuration,3)
            self.resources.paintPosition(id:id,x:Self.round6(shard.dx*p),y:Self.round6(shard.dy*p))
        },retired:{[weak self] _,success in if !success{self?.finish(false)}})
        guard travel,!disposed else{finish(false);return}
        let fade=roots.register(.init(kind:.burst(id),family:.defaultLazyTween,delay:shard.fadeDelay,duration:0.25),advance:{[weak self] _,seconds in
            guard let self,self.validate() else{return}
            let a=shard.alpha*(1-NativeRegularSixFxMath.inside(seconds/0.25,3))
            self.resources.paintAlpha(id:id,alpha:Self.round6(a))
        },retired:{[weak self] _,success in if !success{self?.finish(false)}})
        if !fade{finish(false)}
    }
    private func validate()->Bool{guard !disposed else{return false};guard current(),resources.admitted else{finish(false);return false};return true}
    static func round6(_ value:Double)->Double{floor(value*1_000_000+0.5)/1_000_000}
    private func finish(_ success:Bool){
        guard !disposed else{return};disposed=true
        let timer=wall;wall=nil;timer?.cancel()
        // Source captured shard resources first, captured activity second,
        // layer destruction last. Reentrant activity cleanup cannot steal a
        // new invocation's pooled graphics (KING identity-preserving rule).
        roots.dispose();resources.releaseAll()
        let release=scope;scope=nil;release?();resources.retireLayer()
        let callback=onFinished;onFinished=nil;callback?(success && current())
    }
    func dispose(){finish(false)}
    isolated deinit {
        if !disposed{wall?.cancel();roots.dispose();resources.releaseAll();scope?();resources.retireLayer()}
    }
}
