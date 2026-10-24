import SpriteKit

/// Exact retained-node presentation. Source scopes borrow the existing APP
/// timeline transport; default Native uses its existing SpriteKit clock.
/// This owner never mutates Core, navigation, save data, audio or haptics.
@MainActor final class NativeShortWildBoardBlastOwner {
    private final class Participant:NativeSourceAnimationParticipant {
        let paint:(Double)->Void
        init(_ paint:@escaping(Double)->Void){self.paint=paint}
        func advanceSourceAnimation(seconds:Double){paint(seconds)}
    }
    private final class Capture {
        let id=UUID(),node:NativeDiceNode,plan:NativeShortWildBoardBlastPlan,z:CGFloat,current:()->Bool
        var participant:Participant?,lease:NativeSourceAnimationClockService.Lease?
        let finished:()->Void
        init(node:NativeDiceNode,plan:NativeShortWildBoardBlastPlan,current:@escaping()->Bool,finished:@escaping()->Void){
            self.node=node;self.plan=plan;z=node.zPosition;self.current=current;self.finished=finished
        }
    }
    private var captures:[String:Capture]=[:],disposed=false
    var activeCount:Int{captures.count}
    var activeSourceCount:Int{captures.values.filter{$0.lease?.active==true}.count}
    func owns(_ node:NativeDiceNode)->Bool{captures[node.tileID]?.node === node}
    @discardableResult func start(nodes:[NativeDiceNode],center:CGPoint,tileSize:CGFloat,
        service:NativeSourceAnimationClockService?,random:()->Double,current:@escaping()->Bool,
        nodeCurrent:@escaping(NativeDiceNode)->Bool,acquire:@escaping()->(() -> Void))->Bool {
        guard !disposed,current() else{return false}
        let targets=nodes.filter{!owns($0)}
        guard let plans=NativeShortWildBoardBlastPlan.make(rests:targets.map(\.position),center:center,tileSize:tileSize,
            random:random,dateMilliseconds:{nil},current:{!self.disposed && current() && targets.allSatisfy(nodeCurrent)},held:false) else{return false}
        for (node,plan) in zip(targets,plans) {
            guard !disposed,current(),nodeCurrent(node) else{return false}
            let capture=Capture(node:node,plan:plan,current:{current() && nodeCurrent(node)},finished:acquire())
            captures[node.tileID]=capture;node.removeAllActions();node.zPosition=320
            let duration=plan.waveDelay+plan.blastDuration+plan.returnDelay+plan.returnDuration
            let paint:(Double)->Void = { [weak self,weak capture] seconds in
                guard let self,let capture,self.captures[node.tileID] === capture else{return}
                guard capture.current() else{self.finish(capture,restore:false);return}
                let progress:CGFloat,from:CGPoint,to:CGPoint
                if seconds<=plan.waveDelay+plan.blastDuration {
                    progress=NativeBoardMotion.Ease.backOut(2.9).sample(CGFloat(max(0,seconds-plan.waveDelay)/plan.blastDuration))
                    from=plan.rest;to=plan.blast
                } else {
                    progress=NativeBoardMotion.Ease.elasticOut(1,CGFloat(plan.returnElastic)).sample(CGFloat(max(0,seconds-plan.waveDelay-plan.blastDuration-plan.returnDelay)/plan.returnDuration))
                    from=plan.blast;to=plan.rest
                }
                node.position = .init(x:from.x+(to.x-from.x)*progress,y:from.y+(to.y-from.y)*progress)
            }
            if let service {
                let participant=Participant(paint);capture.participant=participant
                let lease=service.register(participant:participant,duration:duration,domain:.sourceGSAP(.timeline),cleanup:{[weak self,weak capture] _ in
                    guard let self,let capture else{return};self.finish(capture,restore:true)
                })
                guard let lease else{finish(capture,restore:true);return false}
                guard captures[node.tileID] === capture else{lease.cancel();continue}
                capture.lease=lease;paint(0)
            } else {
                node.run(.sequence([.customAction(withDuration:duration){_,elapsed in paint(Double(elapsed))},.run{[weak self,weak capture] in
                    guard let self,let capture else{return};self.finish(capture,restore:true)
                }]),withKey:"native-short-wild-blast")
            }
        }
        return true
    }
    private func finish(_ capture:Capture,restore:Bool) {
        guard captures[capture.node.tileID] === capture else{return}
        captures.removeValue(forKey:capture.node.tileID)
        let lease=capture.lease;capture.lease=nil;capture.participant=nil
        capture.node.removeAction(forKey:"native-short-wild-blast");lease?.cancel()
        if restore,capture.current() {capture.node.position=capture.plan.rest;capture.node.zPosition=capture.z}
        capture.finished()
    }
    func interrupt(_ node:NativeDiceNode){if let capture=captures[node.tileID],capture.node === node {finish(capture,restore:true)}}
    func dispose(){guard !disposed else{return};disposed=true;for capture in Array(captures.values){finish(capture,restore:true)}}
    isolated deinit{dispose()}
}

/// Standard TNT's retained outward/wobble/return tweens use the same APP
/// transport as its frame-six caller. Return captures the currently painted
/// position; cancellation cannot report a successful gameplay handoff.
@MainActor final class NativeSourceTntBoardBlastOwner {
    private final class Paint:NativeSourceAnimationParticipant {
        let sample:(Double)->Void
        init(_ sample:@escaping(Double)->Void){self.sample=sample}
        func advanceSourceAnimation(seconds:Double){sample(seconds)}
    }
    private final class Capture {
        let node:NativeDiceNode,plan:NativeTntBoardBlastPlan,current:()->Bool,z:CGFloat
        var lease:NativeSourceAnimationClockService.Lease?,paint:Paint?,epoch=UUID()
        init(node:NativeDiceNode,plan:NativeTntBoardBlastPlan,current:@escaping()->Bool){self.node=node;self.plan=plan;self.current=current;z=node.zPosition}
    }
    private let service:NativeSourceAnimationClockService
    private var captures:[String:Capture]=[:],disposed=false
    private var order:[String]=[]
    init(service:NativeSourceAnimationClockService){self.service=service}
    func start(node:NativeDiceNode,plan:NativeTntBoardBlastPlan,current:@escaping()->Bool)->Bool {
        guard !disposed,captures[node.tileID]==nil,current(),!disposed else{return false}
        let capture=Capture(node:node,plan:plan,current:current);captures[node.tileID]=capture;order.append(node.tileID)
        node.removeAllActions()
        let paint=Paint{[weak self,weak capture] seconds in
            guard let self,let capture,!self.disposed,self.captures[node.tileID] === capture else{return}
            guard capture.current() else{self.finish(capture,restore:false);return}
            let from:CGPoint,to:CGPoint,p:CGFloat
            if seconds<plan.blastDuration {
                from=plan.rest;to=plan.blast
                p=NativeBoardMotion.Ease.elasticOut(1,CGFloat(plan.returnElastic)).sample(CGFloat(seconds/plan.blastDuration))
            } else {
                let local=(seconds-plan.blastDuration).truncatingRemainder(dividingBy:plan.wobbleDuration*2)
                let outward=local<=plan.wobbleDuration
                from=outward ? plan.blast:plan.wobble;to=outward ? plan.wobble:plan.blast
                p=NativeBoardMotion.Ease.elasticInOut(1,CGFloat(plan.wobbleElastic)).sample(CGFloat((outward ? local:local-plan.wobbleDuration)/plan.wobbleDuration))
            }
            node.position = .init(x:from.x+(to.x-from.x)*p,y:from.y+(to.y-from.y)*p)
        }
        capture.paint=paint
        let epoch=capture.epoch
        guard let lease=service.register(participant:paint,duration:NativeTntFinale.duration,domain:.sourceGSAP(.defaultLazyTween),cleanup:{[weak self,weak capture] _ in
            guard let self,let capture,capture.epoch==epoch else{return};self.finish(capture,restore:true)
        }) else{finish(capture,restore:true);return false}
        guard !disposed,captures[node.tileID] === capture,current() else{lease.cancel(success:false);return false}
        capture.lease=lease;return true
    }
    func beginReturn(finished:@escaping()->Void)->Bool {
        guard !disposed else{return false}
        let retained=order.compactMap{captures[$0]}
        guard retained.allSatisfy({$0.current()}),!disposed else{return false}
        if retained.isEmpty {finished();return true}
        var pending=retained.count
        for capture in retained {
            guard !disposed,captures[capture.node.tileID] === capture,capture.current() else{return false}
            capture.epoch=UUID();let epoch=capture.epoch
            let previous=capture.lease;capture.lease=nil;capture.paint=nil;previous?.cancel(success:false)
            let node=capture.node,from=node.position,plan=capture.plan
            let paint=Paint{[weak self,weak capture] seconds in
                guard let self,let capture,!self.disposed,self.captures[node.tileID] === capture,capture.epoch==epoch else{return}
                guard capture.current() else{self.finish(capture,restore:false);return}
                let p=NativeBoardMotion.Ease.elasticOut(0.6,CGFloat(plan.returnElastic)).sample(CGFloat(seconds/plan.returnDuration))
                node.position = .init(x:from.x+(plan.rest.x-from.x)*p,y:from.y+(plan.rest.y-from.y)*p)
            }
            capture.paint=paint
            guard let lease=service.register(participant:paint,duration:plan.returnDuration,domain:.sourceGSAP(.defaultLazyTween),cleanup:{[weak self,weak capture] success in
                guard let self,let capture,capture.epoch==epoch,self.captures[node.tileID] === capture else{return}
                let complete=success && !self.disposed && capture.current()
                self.finish(capture,restore:complete)
                if complete {pending-=1;if pending==0 {finished()}}
            }) else{finish(capture,restore:true);return false}
            guard !disposed,captures[node.tileID] === capture,capture.epoch==epoch else{lease.cancel(success:false);return false}
            capture.lease=lease
        }
        return true
    }
    private func finish(_ capture:Capture,restore:Bool){
        guard captures[capture.node.tileID] === capture else{return}
        captures.removeValue(forKey:capture.node.tileID);order.removeAll{$0==capture.node.tileID};capture.epoch=UUID()
        let lease=capture.lease;capture.lease=nil;capture.paint=nil;lease?.cancel(success:false)
        if restore,capture.current(){capture.node.position=capture.plan.rest;capture.node.zPosition=capture.z}
    }
    func dispose(){guard !disposed else{return};disposed=true;for capture in Array(captures.values){finish(capture,restore:true)}}
    isolated deinit{dispose()}
}

/// Same standard outward grid recipe, driven only by the existing BLOOB finale clock.
/// Dedicated neutral art parents keep logical tile positions, hit tests and other tweens intact.
@MainActor final class NativeBloobBoardReactionBinding {
    struct Entry {
        weak var surface:SKNode?
        let plan:NativeShortWildBoardBlastPlan
        let phase:Double
        let current:()->Bool
    }
    private static let ownershipKey="native-board-reaction-owner"
    private let ownership=UUID().uuidString
    private var entries:[Entry]
    private var disposed=false
    init(entries:[Entry]){
        self.entries=entries
        for entry in entries {
            guard let surface=entry.surface else{continue}
            if surface.userData==nil {surface.userData=NSMutableDictionary()}
            surface.userData?[Self.ownershipKey]=ownership;surface.position = .zero
        }
    }
    private func owns(_ surface:SKNode)->Bool {surface.userData?[Self.ownershipKey] as? String == ownership}
    func paint(seconds:Double,startTime:Double=NativeBloobFinaleMotion.boardReactionStart,returnTime:Double=NativeBloobFinaleMotion.scatterStart,vibrates:Bool=true) {
        guard !disposed else{return}
        for entry in entries {
            guard let surface=entry.surface,owns(surface) else{continue}
            let offset=entry.current() ? NativeBloobFinaleMotion.boardReactionOffset(plan:entry.plan,phase:entry.phase,seconds:seconds,startTime:startTime,returnTime:returnTime,vibrates:vibrates):.zero
            if surface.position != offset {surface.position=offset}
        }
    }
    func reset(){for entry in entries {if let surface=entry.surface,owns(surface) {surface.position = .zero}}}
    func dispose(){
        guard !disposed else{return};reset();disposed=true
        for entry in entries {if let surface=entry.surface,owns(surface) {surface.userData?.removeObject(forKey:Self.ownershipKey)}}
        entries.removeAll()
    }
    isolated deinit{dispose()}
}
