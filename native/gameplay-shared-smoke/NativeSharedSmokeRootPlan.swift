import Foundation

/// PRIVATE literal smokeBubblesAtTile root topology, not one Scene participant.
/// A grouped body can own nested puff timelines; TTL and deferred bursts remain
/// distinct globally linked GSAP roots in their authored creation order.
struct NativeSharedSmokeRootPlan {
    enum Kind:Equatable {case body,lifetime,puff(Int),burst(Int),haloIn,haloOut}
    struct Registration:Equatable {
        let kind:Kind,family:NativeSourceAnimationRuntime.RootFamily
        let delay,duration:Double
    }
    enum AdmissionFailure:Error {case deferredGroupedParentReentryNotProven,unboundedLifetime}
    let registrations:[Registration]
    init(recipe:NativeSharedSmokeRecipe,puffs:[NativeSharedSmokeRuntime.Puff],burstCount:Int)throws {
        // Actual Source supports this branch, but the currently admitted native
        // root-family service lacks dynamic parent reinsertion/aliased pooled
        // child callbacks. No generic fallback or extra render scope is allowed.
        guard !recipe.deferFutureBursts else{throw AdmissionFailure.deferredGroupedParentReentryNotProven}
        guard recipe.ttl>0,recipe.ttl.isFinite else{throw AdmissionFailure.unboundedLifetime}
        var roots:[Registration]=[]
        if recipe.groupedOwner {
            roots.append(.init(kind:.body,family:.timeline,delay:0,duration:Self.round7(max(0.46,puffs.map(\.finish).max() ?? 0))))
        }
        // autoAdd runs AFTER optional grouped-owner creation, BEFORE puff roots.
        roots.append(.init(kind:.lifetime,family:.eagerTween,delay:Self.round7(recipe.ttl),duration:0))
        if !recipe.groupedOwner {
            for puff in puffs {roots.append(.init(kind:.puff(puff.id),family:.timeline,delay:0,duration:Self.round7(puff.finish)))}
            // Source halo are two direct GSAP default-lazy tweens. Fadeout uses
            // delay .18 and duration .28 rather than an invented .46 timeline.
            roots.append(.init(kind:.haloIn,family:.defaultLazyTween,delay:0,duration:0.08))
            roots.append(.init(kind:.haloOut,family:.defaultLazyTween,delay:0.18,duration:0.28))
        }
        registrations=roots
    }
    private static func round7(_ x:Double)->Double{(x*1e7).rounded()/1e7}
}

@MainActor
protocol NativeSharedSmokeRootScheduler:AnyObject {
    func registerSourceRoot(participant:any NativeSourceAnimationParticipant,family:NativeSourceAnimationRuntime.RootFamily,
                            duration:Double,delay:Double,cleanup:@escaping(Bool)->Void)->NativeSharedSmokeRootCancellation?
}
@MainActor
final class NativeSharedSmokeRootCancellation {
    private var cleanup:((Bool)->Void)?
    init(_ cleanup:@escaping(Bool)->Void){self.cleanup=cleanup}
    func cancel(success:Bool=false){let captured=cleanup;cleanup=nil;captured?(success)}
}

/// Executable value backend uses the SAME source root runtime proved against
/// GSAP, never installs a timer and never declares Pixi render activity.
@MainActor
final class NativeSharedSmokeValueRootScheduler:NativeSharedSmokeRootScheduler {
    let runtime:NativeSourceAnimationRuntime
    init(runtime:NativeSourceAnimationRuntime){self.runtime=runtime}
    func registerSourceRoot(participant:any NativeSourceAnimationParticipant,family:NativeSourceAnimationRuntime.RootFamily,
                            duration:Double,delay:Double,cleanup:@escaping(Bool)->Void)->NativeSharedSmokeRootCancellation? {
        guard let lease=runtime.attach(participant:participant,family:family,duration:duration,delay:delay,cleanup:cleanup) else{return nil}
        return NativeSharedSmokeRootCancellation{lease.cancel(success:$0)}
    }
}
