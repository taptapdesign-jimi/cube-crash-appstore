import SpriteKit

/// PRIVATE real travel onImpact bridge. Existing app union service supplies
/// SourceGSAP; shared renderer supplies pool/hot/TTL and same visual RNG. No
/// pulse/PNG/audio fallback, extra clock, or synthetic Source100 activity.
@MainActor final class NativeMeterLandingSourceOwner {
    struct Origin {
        let canvas:SKNode,sourceTile:SKNode,point:CGPoint,renderScale:CGFloat,depth:Double
    }
    struct Hooks {
        let current:()->Bool
        let impactCurrent:(NativeWildMeterDropRuntime.Capture)->Bool
        let readShake:()->NativeMeterLandingShakeGraph.Pose
        let paintShake:(NativeMeterLandingShakeGraph.Pose)->Void
        let sound:()->Void // existing authored landing cue; respects settings
        let reduced:()->Bool // actual Source pressure policy, not ReduceMotion
        let monotonicMilliseconds:()->Double // Source performance.now hot domain
        let fault:(String)->Void
    }
    @MainActor private final class Root:NativeSourceAnimationParticipant {
        let advance:(Double)->Void
        init(_ advance:@escaping(Double)->Void){self.advance=advance}
        func advanceSourceAnimation(seconds:Double){advance(seconds)}
    }
    @MainActor private final class Entry {
        let id=UUID(),capture:NativeWildMeterDropRuntime.Capture,admission:UInt64
        var root:Root?,lease:NativeSourceAnimationClockService.Lease?,graph:NativeMeterLandingShakeGraph?
        init(_ capture:NativeWildMeterDropRuntime.Capture,admission:UInt64){self.capture=capture;self.admission=admission}
    }
    enum Failure:Error {case retired}
    private let service:NativeSourceAnimationClockService,renderer:NativeSharedSmokeRootRenderer,session:NativeSharedSmokeRootSession,hooks:Hooks
    private var serial:UInt64=0,admissionEpoch:UInt64=0
    private var entry:Entry?,seen=Set<NativeWildMeterDropRuntime.Capture>(),closed=false
    init(service:NativeSourceAnimationClockService,renderer:NativeSharedSmokeRootRenderer,session:NativeSharedSmokeRootSession,hooks:Hooks){self.service=service;self.renderer=renderer;self.session=session;self.hooks=hooks}
    private func valid()->Bool {guard !closed else{return false};let c=hooks.current();return c && !closed}
    private func valid(admission:UInt64)->Bool {valid() && admissionEpoch==admission}
    private func valid(_ e:Entry)->Bool {valid() && serial==e.admission && entry === e}
    private func building(_ e:Entry)->Bool {valid(e) && admissionEpoch==e.admission}
    /// Origin is captured BEFORE tile staging in the actual hidden/created Node
    /// caller. The currently flying Node at contact cannot reconstruct it.
    @discardableResult func impact(_ capture:NativeWildMeterDropRuntime.Capture,origin:Origin)->Bool {
        // Allocate the admission identity BEFORE any external predicate/sound/pose
        // callback. Reentrant C invalidates A before A can retire or publish.
        guard !closed,!seen.contains(capture) else{return false}
        admissionEpoch &+= 1;let acceptedSerial=admissionEpoch
        guard valid(admission:acceptedSerial) else{return false}
        let isImpactCurrent=hooks.impactCurrent(capture)
        guard valid(admission:acceptedSerial),isImpactCurrent else{return false}
        seen.insert(capture)
        hooks.sound()
        guard valid(admission:acceptedSerial) else{return false}
        // Replacement preserves actually painted CSS surfaces. Captured old
        // cleanup is intentionally KING-safe: it never resets newer C.
        let initial=hooks.readShake()
        guard valid(admission:acceptedSerial) else{return false}
        let old=entry;entry=nil;old?.lease?.cancel();old?.lease=nil;old?.root=nil
        guard valid(admission:acceptedSerial) else{return false}
        let captured=Entry(capture,admission:acceptedSerial);serial=acceptedSerial;entry=captured
        let root=Root{[weak self,weak captured] elapsed in
            guard let self,let captured,self.valid(captured),let graph=captured.graph else{return}
            if let initial=self.readInitial(captured){graph.captureInitial(initial)}
            guard self.valid(captured) else{return}
            let pose=graph.advance(elapsed)
            guard self.valid(captured) else{return};self.hooks.paintShake(pose)
        }
        captured.root=root
        // Literal trackTimeline before 36 random draws and smoke creation.
        let lease=service.register(participant:root,duration:NativeMeterLandingShakeGraph.duration,domain:.sourceGSAP(.timeline),cleanup:{[weak self,weak captured] success in
            guard let self,let captured,self.entry === captured else{return}
            self.entry=nil;captured.lease=nil;captured.root=nil
            if success,self.valid(),self.entry==nil,self.serial==acceptedSerial{self.hooks.paintShake(.init(canvas:[0,0],indicator:[0,0],decor:[0,0]))}
        })
        guard building(captured),let lease else{lease?.cancel();retire(captured);return false}
        captured.lease=lease
        do {
            captured.graph=try NativeMeterLandingShakeGraph(initial:initial,random:{[self] in
                guard building(captured) else{throw Failure.retired}
                let draw=session.nextVisualRandom()
                guard building(captured) else{throw Failure.retired};return draw
            })
        }catch{retire(captured);return false}
        guard building(captured) else{retire(captured);return false}
        // Source continues helper calls even if shake throws; here clock failure
        // is explicit admission failure, not silent generic replacement.
        let reduced=hooks.reduced()
        guard building(captured) else{retire(captured);return false}
        let wall=hooks.monotonicMilliseconds()
        guard building(captured) else{retire(captured);return false}
        let recipe=NativeSharedSmokeRecipes.wildMeterLanding(tileDepth:origin.depth)
        var smokePublished=false
        let smoke=renderer.admit(recipe:recipe,canvas:origin.canvas,tile:origin.sourceTile,generation:capture.generation,
            origin:origin.point,renderScale:origin.renderScale,monotonicMilliseconds:wall,reduced:reduced,
            current:{[weak self] generation in
                guard let self,self.valid(),generation==capture.generation else{return false}
                return smokePublished || self.admissionEpoch==acceptedSerial
            },
            acquireActivity:{_ in assertionFailure("Unlabelled v9 landing smoke must not acquire activity");return nil})
        guard building(captured) else{smoke?.disposeForRetirement();retire(captured);return false}
        guard smoke != nil else{hooks.fault("Source meter landing smoke was not admitted");return false}
        smokePublished=true
        return true
    }
    private func readInitial(_ e:Entry)->NativeMeterLandingShakeGraph.Pose? {
        guard valid(e) else{return nil};let pose=hooks.readShake();return valid(e) ? pose:nil
    }
    private func retire(_ e:Entry){guard entry === e else{return};entry=nil;let lease=e.lease;e.lease=nil;lease?.cancel();e.root=nil}
    func dispose(){guard !closed else{return};closed=true;serial &+= 1;admissionEpoch &+= 1;if let e=entry{retire(e)};seen.removeAll()}
    isolated deinit {dispose()}
}
