import Foundation

/// PRIVATE Source roots for multiplier/CSS shake only. Scene admission, shared
/// shard/smoke order, physical drawing and gameplay receipts remain separate.
@MainActor final class NativeSixSourceSurfaceOwner {
    typealias ShakePose=NativeSixSourceShakeGraph.Pose
    private final class Root:NativeSourceAnimationParticipant {
        let advance:(Double)->Void
        init(_ advance:@escaping(Double)->Void){self.advance=advance}
        func advanceSourceAnimation(seconds:Double){advance(seconds)}
    }
    private final class Effect {
        let id=UUID(),multiplier=NativeSixSourceMultiplierGraph()
        let paint:(NativeSixSourceMultiplierGraph.Pose)->Void,remove:()->Void,carrierCurrent:()->Bool
        var shakeID:UUID?
        var roots:[Root]=[],leases:[NativeSourceAnimationClockService.Lease]=[]
        init(paint:@escaping(NativeSixSourceMultiplierGraph.Pose)->Void,remove:@escaping()->Void,carrierCurrent:@escaping()->Bool){self.paint=paint;self.remove=remove;self.carrierCurrent=carrierCurrent}
    }
    private final class Shake {
        let id=UUID(),graph:NativeSixSourceShakeGraph
        var empty=false,root:Root?,lease:NativeSourceAnimationClockService.Lease?
        init(_ graph:NativeSixSourceShakeGraph){self.graph=graph}
    }
    private let service:NativeSourceAnimationClockService,current:()->Bool
    private let paintShake:(ShakePose)->Void
    private var effects:[UUID:Effect]=[:],shakes:[UUID:Shake]=[:],latestShake:UUID?
    private var surfacePose:ShakePose?
    private var disposed=false
    init(service:NativeSourceAnimationClockService,current:@escaping()->Bool,paintShake:@escaping(ShakePose)->Void){self.service=service;self.current=current;self.paintShake=paintShake}
    private func valid()->Bool{guard !disposed else{return false};let accepted=current();return !disposed && accepted}
    private func valid(_ effect:Effect)->Bool{guard valid() else{return false};let accepted=effect.carrierCurrent();return valid() && accepted && effects[effect.id] === effect}
    private func paint(_ pose:ShakePose){surfacePose=pose;paintShake(pose)}
    @discardableResult
    func start(depth:Int,initial:ShakePose,random:()->Double,
               paintMultiplier:@escaping(NativeSixSourceMultiplierGraph.Pose)->Void,
               removeMultiplier:@escaping()->Void,carrierCurrent:@escaping()->Bool={true})->UUID? {
        guard valid() else{return nil}
        let effect=Effect(paint:paintMultiplier,remove:removeMultiplier,carrierCurrent:carrierCurrent);effects[effect.id]=effect
        guard valid(effect) else{retire(effect.id);return nil}
        // Literal autoAdd registers its delayed TTL before multiplier timeline.
        let ttl=Root{_ in}
        guard let ttlLease=service.register(participant:ttl,duration:0,domain:.sourceGSAP(.eagerTween),delay:0.9,cleanup:{[weak self,weak effect] success in
            guard let self,let effect,success else{return};self.retire(effect.id)
        }) else {retire(effect.id);return nil}
        guard valid(effect),effects[effect.id] === effect else{ttlLease.cancel();return nil}
        effect.roots.append(ttl);effect.leases.append(ttlLease)
        let multiplier=Root{[weak self,weak effect] elapsed in
            guard let self,let effect,self.valid(effect),self.effects[effect.id] === effect else{return}
            let pose=effect.multiplier.advance(elapsed)
            guard self.valid(effect),self.effects[effect.id] === effect else{return};effect.paint(pose)
        }
        guard let lease=service.register(participant:multiplier,duration:0.64,domain:.sourceGSAP(.timeline),cleanup:{_ in}) else{retire(effect.id);return nil}
        guard valid(effect),effects[effect.id] === effect else{lease.cancel();return nil}
        effect.roots.append(multiplier);effect.leases.append(lease)
        let strength=floor(min(24,10+Double(max(1,depth))*3)*0.45+0.5)
        let graph=NativeSixSourceShakeGraph(strength:strength,initial:initial,random:{
            guard self.valid(effect) else{return 0}
            let draw=random()
            guard self.valid(effect) else{return 0}
            return draw
        })
        guard valid(effect),effects[effect.id] === effect else{retire(effect.id);return nil}
        surfacePose=initial
        if let previous=latestShake,let old=shakes[previous] {old.empty=true}
        let shake=Shake(graph);effect.shakeID=shake.id;shakes[shake.id]=shake;latestShake=shake.id
        let root=Root{[weak self,weak shake,weak effect] elapsed in
            guard let self,let shake,let effect,self.valid(effect),self.shakes[shake.id] === shake else{return}
            if shake.empty {
                // Source killTweensOf removes only children. Empty old parent
                // performs its original onComplete reset on next traversal.
                self.paint(.init(canvas:[0,0],indicator:[0,0],decor:[0,0]))
                self.retireShake(shake.id)
            } else {
                if let initial=self.surfacePose{shake.graph.captureInitial(initial)}
                let pose=shake.graph.advance(elapsed)
                guard self.valid(effect),self.shakes[shake.id] === shake else{return};self.paint(pose)
            }
        }
        shake.root=root
        let shakeLease=service.register(participant:root,duration:0.44,domain:.sourceGSAP(.timeline),cleanup:{[weak self,weak shake,weak effect] success in
            guard let self,let shake else{return}
            if success,let effect,self.valid(effect),self.shakes[shake.id] === shake{self.paint(.init(canvas:[0,0],indicator:[0,0],decor:[0,0]))}
            self.retireShake(shake.id)
        })
        guard valid(effect),effects[effect.id] === effect,shakes[shake.id] === shake else{shakeLease?.cancel();return nil}
        shake.lease=shakeLease
        if shakeLease==nil{retireShake(shake.id);retire(effect.id);return nil}
        return effect.id
    }
    private func retireShake(_ id:UUID){
        guard let shake=shakes.removeValue(forKey:id) else{return}
        if latestShake==id{latestShake=nil};let lease=shake.lease;shake.lease=nil;lease?.cancel();shake.root=nil
    }
    private func retire(_ id:UUID){
        guard let effect=effects.removeValue(forKey:id) else{return}
        let leases=effect.leases;effect.leases=[];for lease in leases{lease.cancel()}
        effect.roots=[];effect.remove()
    }
    /// Cancel only this captured carrier; a replacement shake stays owned.
    func cancel(_ id:UUID){
        let shakeID=effects[id]?.shakeID
        if let shakeID{retireShake(shakeID)}
        retire(id)
    }
    func dispose(){
        guard !disposed else{return};disposed=true
        let capturedEffects=Array(effects.keys),capturedShakes=Array(shakes.keys)
        for id in capturedShakes{retireShake(id)};for id in capturedEffects{retire(id)}
    }
    isolated deinit {dispose()}
}
