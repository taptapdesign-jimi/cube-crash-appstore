import Foundation
import StackToSixGameplay

/// Actual normal replacement caller, distinct from zero-active post-check
/// fallback. Core owns planned cells/faces; each captured object follows the
/// original constructor → immediate value/raw-face RAF → Source spawn timeline
/// → wall50 verification → FIFO Promise-all. No nominal bounce timer.
@MainActor final class NativeSourceMagnetNormalCaller {
    struct Hooks {
        let current:()->Bool
        let resourcesReady:()->Bool
        let random:()->Double
        let schedule:(Int,@escaping()->Void,@escaping()->Void)->(()->Void)?
        let enqueue:(@escaping()->Void)->Bool
        let construct:(NativeTile,Double)->NativeDiceNode?
        let owns:(NativeDiceNode,NativeTile)->Bool
        let publish:(NativeMoveResult,NativeBoardState)->Void
        let verify:(NativeCell)->Bool
        let acquireFrames:(String,UInt64)->(()->Void)?
        let finished:(NativeSourceMagnetRespawnOwner.Completion)->Void
        /// Supplied only by the actual app/Node lifetime caller, never inferred
        /// from this short Promise's activity or an arbitrary outer marker.
        var frameCurrent:((NativeDiceNode,NativeTile)->Bool)?=nil
        /// Real captured old empty-holder retirement BEFORE fresh constructor.
        /// Required by Source lazy route; nil keeps legacy behavior unchanged.
        var removeEmptyHolder:((NativeSourceMagnetLazyOpen)->Bool)?=nil
    }
    private let engine:NativeGameplayEngine,service:NativeSourceAnimationClockService,hooks:Hooks
    private var transactionID:String?,generation:UInt64?,replacements:[NativeTile]=[]
    private var pipeline:NativeSourceMagnetRespawnOwner?,nodes:[Int:NativeDiceNode]=[:],bounces:[Int:NativeSourceAppSpawnBounceOwner]=[:]
    private var lazySlots:[NativeSourceMagnetLazySlot]?,lazyOpens:[Int:NativeSourceMagnetLazyOpen]=[:]
    private var count:Int{lazySlots?.count ?? replacements.count}
    private var closed=false
    init(engine:NativeGameplayEngine,service:NativeSourceAnimationClockService,hooks:Hooks){self.engine=engine;self.service=service;self.hooks=hooks}
    var active:Bool{!closed && transactionID != nil}
    func owns(_ node:NativeDiceNode)->Bool{active && nodes.values.contains{$0 === node}}
    func ownsSpawnEvent(_ event:NativeGameplayEvent)->Bool{active && event.kind == .spawned && event.archetype == .magnet && event.reason==transactionID}
    private func current()->Bool {
        guard !closed else{return false};let accepted=hooks.current()
        return accepted && !closed && (generation==nil || engine.state.generation==generation)
    }
    @discardableResult func start(transactionID:String,generation:UInt64)->Bool {
        guard !closed,self.transactionID==nil,current(),service.sourceFrameTransportAdmissionOpen else{return false}
        let ready=hooks.resourcesReady()
        guard ready,current(),engine.pendingSpecial?.id==transactionID,engine.state.generation==generation else{return false}
        if engine.sourceMagnetLazyRespawnEnabled {
            guard let plan=engine.pendingSourceMagnetLazyRespawn,plan.transactionID==transactionID,plan.generation==generation,
                  hooks.removeEmptyHolder != nil else{return false}
            lazySlots=plan.slots
        } else {
            guard let respawn=engine.pendingMagnetRespawn,respawn.transactionID==transactionID else{return false}
            replacements=respawn.replacements
        }
        self.transactionID=transactionID;self.generation=generation
        let owner=NativeSourceMagnetRespawnOwner(hooks:.init(current:{[weak self] in self?.current()==true},
            schedule:hooks.schedule,enqueue:hooks.enqueue,open:{[weak self] index,done in self?.open(index,done:done) ?? .unavailable},
            verify:{[weak self] index in self?.verify(index)==true},finished:{[weak self] outcome in self?.finish(outcome)}))
        pipeline=owner
        guard owner.start(count:count),current(),pipeline === owner else{owner.retire();finish(.unavailable);return false}
        return true
    }
    private func open(_ index:Int,done:@escaping(Bool)->Void)->NativeSourceMagnetRespawnOwner.OpenResult {
        guard current(),index>=0,index<count,let transactionID,let generation else{return .unavailable}
        let tile:NativeTile,value:Int
        if let slots=lazySlots {
            guard let opening=engine.beginSourceMagnetLazyOpen(transactionID:transactionID,generation:generation,index:index,sourceCurrent:current),current() else{return .unavailable}
            if opening.skipped{return .skipped}
            guard let holder=opening.holder,let retire=hooks.removeEmptyHolder else{return .unavailable}
            lazyOpens[index]=opening
            let retired=retire(opening)
            guard retired,current(),lazyOpens[index]==opening else{return .unavailable}
            tile=holder;value=slots[index].forcedValue
        } else {
            tile=replacements[index];value=tile.value
            // Original skips an active/Wild/unlocked occupant at callback time.
            if let existing=engine.state.tile(at:tile.cell),existing.value>0 || existing.isWild || !existing.locked{return .skipped}
        }
        // Source logical/constructor/skin/tail all borrow the immutable APP
        // provider. This retained function outlives the short Promise caller,
        // just like its existing stable Node raw-frame lifetime.
        let random:()->Double
        if lazySlots != nil {guard let math=engine.sourceMathRandom else{return .unavailable};random=math.next}
        else {random=hooks.random}
        let roll=random()
        guard current(),roll.isFinite,roll>=0,roll<1 else{return .unavailable}
        guard let node=hooks.construct(tile,roll*0.12-0.06),current(),hooks.owns(node,tile),current() else{return .unavailable}
        nodes[index]=node
        let alive:()->Bool = {[weak self,weak node] in
            guard let self,let node,self.current(),self.nodes[index] === node else{return false}
            let accepted=self.hooks.owns(node,tile)
            return accepted && self.current() && self.nodes[index] === node
        }
        let frameCurrent:(()->Bool)? = hooks.frameCurrent.map{callback in
            {[weak node] in guard let node else{return false};return callback(node,tile)}
        }
        let admitted=node.openSourceAppSpawnHolder(value,service:service,random:random,current:alive,frameCurrent:frameCurrent,
            beforeSetValue:{[weak self] in
                guard let self,alive() else{return false}
                let previous=self.engine.state,result:NativeMoveResult
                if let opening=self.lazyOpens[index] {
                    result=self.engine.commitSourceMagnetLazyOpenValue(openID:opening.id,generation:generation,sourceCurrent:alive)
                } else {result=self.engine.commitMagnetReplacement(transactionID:transactionID,index:index)}
                guard result.accepted,alive() else{return false}
                self.hooks.publish(result,previous);return alive()
            },onCancelled:{[weak self] in self?.finish(.cancelled)})
        guard admitted,alive() else{return .unavailable}
        let ownerID="magnet-normal:\(transactionID):\(index)"
        let bounce=NativeSourceAppSpawnBounceOwner(service:service,hooks:.init(current:alive,
            readRotation:{[weak node] in node.map{Double($0.dragInnerTilt)}},
            paintScale:{[weak node] value in node?.paintSourceOuterScale(.init(x:value,y:value))},
            paintRotation:{[weak node] value in node?.dragInnerTilt=CGFloat(value)},
            ensureFullOpacity:{[weak node] in node?.ensureSourceAppSpawnFullOpacity()},random:random,
            acquireFrames:{[hooks] in hooks.acquireFrames(ownerID,generation)},
            finished:{[weak self,weak node] outcome in
                guard let self,self.nodes[index] === node else{return}
                self.bounces.removeValue(forKey:index);node?.unbindSourceAppSpawnInterruption(id:ownerID)
                guard self.current() else{return};done(outcome == .completed)
            }))
        bounces[index]=bounce
        guard node.bindSourceAppSpawnInterruption(id:ownerID,pickup:{[weak bounce] in bounce?.removeChildrenForPickup()},interrupted:{[weak bounce] in bounce?.interrupt()}),alive(),bounce.start(),alive() else{
            bounce.interrupt();return .unavailable
        }
        return .started
    }
    private func verify(_ index:Int)->Bool {
        guard current(),index>=0,index<count else{return false}
        let cell=lazySlots?[index].cell ?? replacements[index].cell
        let success=hooks.verify(cell)
        guard success,current() else{return false}
        if let opening=lazyOpens[index] {
            guard let node=nodes[index],let generation else{return false}
            return engine.finishSourceMagnetLazyOpen(openID:opening.id,generation:generation,verifiedTileID:node.tileID,sourceCurrent:current) && current()
        }
        return true
    }
    private func finish(_ outcome:NativeSourceMagnetRespawnOwner.Completion){
        guard !closed else{return};closed=true
        let capturedPipeline=pipeline;pipeline=nil
        let capturedBounces=bounces;bounces=[:];let capturedNodes=nodes;nodes=[:]
        if let transactionID {for(index,node) in capturedNodes{node.unbindSourceAppSpawnInterruption(id:"magnet-normal:\(transactionID):\(index)")}}
        capturedPipeline?.retire();capturedBounces.values.forEach{$0.interrupt()}
        hooks.finished(outcome)
    }
    func retire(){finish(.cancelled)}
    isolated deinit {retire()}
}
