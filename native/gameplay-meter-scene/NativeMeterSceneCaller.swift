import SpriteKit
import StackToSixGameplay

/// PRIVATE opt-in actual Scene composition. No Timer, CADI, broad alpha-zero
/// scan, fabricated renderer frame, cloned artwork or gameplay decision here.
@MainActor final class NativeMeterSceneCaller {
    typealias Hidden=NativeMeterHiddenOpenOwner<NativeDiceNode>
    typealias Core=NativeMeterHiddenCoreCaller<NativeDiceNode,SKTexture>
    struct Hooks {
        let current:()->Bool
        let viewport:()->CGSize
        let renderEpoch:()->UInt64
        let node:(String)->NativeDiceNode?
        let install:(NativeDiceNode,NativeCell)->Void
        let retire:(String,NativeDiceNode)->Void
        let cellPose:(NativeCell)->(point:CGPoint,scale:CGFloat)?
        let enqueue:(@escaping @MainActor ()->Void)->Void
        let sourceActivity:(String,UInt64)->(()->Void)?
        let carrierAudio:(Bool,String,UInt64)->(()->Void)
        let dividerMask:()->(()->Void)
        let selectedAudio:(NativeTile,NativeMeterSelectedFinaleWarmup<SKTexture>.Capture)->Void
        let texturesCurrent:()->Bool
        let onImpact:(NativeDiceNode,NativeWildMeterDropRuntime.Capture)->Void
        let onHaptic:()->Void
        let idleAdmitted:(NativeDiceNode)->Void
        let ownershipReleased:()->Void
        let fault:(String)->Void
        let consume:(NativeMoveResult,NativeBoardState)->Void
        var onDropStarted:((NativeDiceNode)->Void)?=nil
        var onDropContact:((NativeDiceNode)->Void)?=nil
        var onDropLanded:((NativeDiceNode)->Void)?=nil
        var sourceSkin:((NativeDiceNode)->Bool)?=nil
    }
    @MainActor private final class Drop {
        let captured:Core.Captured,runtime:NativeWildMeterDropRuntime.Capture
        var owner:NativeWildMeterDropSceneOwner?
        var landingOrigin:NativeMeterLandingSourceOwner.Origin?
        var spawned=false,foreground=false,wallUnlocked=false
        var gameplayTransferred=false
        var sourceTravelReactionScheduled=false,sourceSpawnEventPending=false,sourceBookkeepingSucceeded=false
        init(_ captured:Core.Captured,epoch:UInt64){self.captured=captured;runtime = .init(id:captured.drop.id,generation:captured.drop.generation,epoch:epoch)}
    }
    private let engine:NativeGameplayEngine,textures:NativeBoardTextures
    private let resources:NativeWildMeterDropResources,timeouts:NativeSourceAppTimeoutOwner,service:NativeSourceAnimationClockService
    private weak var stage:SKNode?
    private let hooks:Hooks,random:()->Double,wallNow:()->Double
    private let sourcePromiseBookkeeping:Bool
    private var closed=false,sequence:UInt64=0,drops:[String:Drop]=[:]
    func captureSourceDropActiveCount()->Int? {
        guard sourcePromiseBookkeeping,valid() else{return nil}
        let captured=drops
        func unchanged()->Bool {valid() && drops.count==captured.count && captured.allSatisfy{drops[$0.key] === $0.value}}
        var count=0
        for drop in captured.values {
            guard unchanged(),valid(drop),let owner=drop.owner,
                  let active=owner.captureSourceDropActivity(),unchanged(),valid(drop),drop.owner === owner else{return nil}
            if active {count+=1}
        }
        return unchanged() ? count:nil
    }
    private lazy var store=NativeMeterSceneNodeStore<NativeDiceNode>(current:{[weak self] in self?.valid()==true},actualContains:{[weak self] id,node in node.sourceContactNodeAlive && self?.hooks.node(id) === node},holder:{node in
        .init(id:node.tileID,value:node.value,locked:node.locked,destroyed:!node.sourceContactNodeAlive,special:node.kind=="regular" ? nil:node.kind,registryArchetype:node.variant.flatMap{NativeSpecialDiceRegistry.variants[$0]?.archetype.rawValue},isWild:node.kind.hasPrefix("wild"))
    },retireNode:{[weak self] id,node in self?.hooks.retire(id,node)})
    private lazy var hidden=Hidden(hooks:.init(readGrid:{[weak self] in self?.store.read($0)},createPlaceholder:{[weak self] capture in self?.createPlaceholder(capture)},unlockAndBind:{lease in
        let n=lease.node;n.update(value:n.value,kind:n.kind,variant:n.variant,depth:n.depth,locked:false)
        if n.sourcePhysicalMarkersCovered {n.sourceEventMode="static"}
    },resetNormal:{lease in lease.node.update(value:0,kind:"regular",variant:nil,depth:1,locked:false)},deferIdle:{$0.node.setSourceIdleDeferred($1)},setCoreValue:{[weak self] lease,special in
        guard let self,self.valid() else{return}
        if self.sourcePromiseBookkeeping {
            let node=lease.node
            guard node.openSourceWildCore(special,selectedVariant:self.engine.pendingMeterOpen?.tile.variant,service:self.service,
                current:{[weak self,weak node] in guard let self,let node else{return false};return self.valid() && self.hooks.node(node.tileID) === node},onCancelled:{}) else{
                lease.retire();self.hooks.fault("source_meter_wild_constructor_rejected");return
            }
            if let skin=self.hooks.sourceSkin,!skin(node) {lease.retire();self.hooks.fault("source_meter_wild_skin_rejected")}
        } else {lease.node.update(value:6,kind:special,variant:nil,depth:1,locked:false)}
    },applyVariant:{[weak self] lease,selection in
        guard let self,self.valid() else{return}
        let n=lease.node
        if self.sourcePromiseBookkeeping {
            guard n.kind==selection.special,n.applySourceOpenedWildVariant(selection.variant) else{lease.retire();self.hooks.fault("source_meter_wild_variant_rejected");return}
            if let skin=self.hooks.sourceSkin,!skin(n) {lease.retire();self.hooks.fault("source_meter_wild_skin_rejected")}
        } else {n.update(value:6,kind:selection.special,variant:selection.variant,depth:n.depth,locked:false)}
    },hide:{$0.node.alpha=0},activateIdle:{$0.node.resumeIdleAfterLanding()},enqueue:{[weak self] action in self?.hooks.enqueue(action)},generationCurrent:{[weak self] capture in
        guard let self else{return false};return self.valid() && self.engine.state.generation==capture.generation
    }))
    private lazy var warmup=NativeMeterSelectedNativeWarmup.make(textures:textures)
    private lazy var core:Core={
        let c=Core(engine:engine,hidden:hidden,warmup:warmup,current:{[weak self] in self?.valid()==true},texturesCurrent:{[weak self] in self?.hooks.texturesCurrent()==true},prepareAudio:{[weak self] tile,capture in self?.hooks.selectedAudio(tile,capture)})
        c.onReserved={[weak self] captured in self?.start(captured)}
        c.onResult={[weak self] result,previous in guard let self,self.valid() else{return};self.hooks.consume(result,previous)}
        return c
    }()
    init(engine:NativeGameplayEngine,textures:NativeBoardTextures,resources:NativeWildMeterDropResources,
         timeouts:NativeSourceAppTimeoutOwner,service:NativeSourceAnimationClockService,stage:SKNode,
         hooks:Hooks,random:@escaping()->Double,wallNow:@escaping()->Double,
         sourcePromiseBookkeeping:Bool=false){
        self.engine=engine;self.textures=textures;self.resources=resources;self.timeouts=timeouts;self.service=service
        self.stage=stage;self.hooks=hooks;self.random=random;self.wallNow=wallNow
        self.sourcePromiseBookkeeping=sourcePromiseBookkeeping
    }
    var retainedNodeIDs:Set<String>{core.retainedNodeIDs}
    func captureSourceTileDropMarkers(_ node:NativeDiceNode)->NativeWildMeterDropRuntime.SourceTileMarkers? {
        guard sourcePromiseBookkeeping,valid(),let stage,node.parent === stage,node.sourcePhysicalMarkersCovered,
              node.sourceGeneration==engine.state.generation,let cell=node.sourceGridCell,
              store.containsBoundNode(node,id:node.tileID,cell:.init(column:cell.column,row:cell.row),generation:node.sourceGeneration),
              valid(),node.parent === stage else{return nil}
        let captured=drops.values.filter{$0.captured.lease.node === node}
        guard captured.count<=1 else{return nil}
        if let drop=captured.first {
            let generation=node.sourceGeneration
            guard valid(drop),let owner=drop.owner,let markers=owner.captureSourceTileMarkers(),valid(drop),drop.owner === owner,
                  node.parent === stage,node.sourceGeneration==generation,node.sourceGridCell==cell,
                  store.containsBoundNode(node,id:node.tileID,cell:.init(column:cell.column,row:cell.row),generation:generation),
                  valid(drop),node.parent === stage,node.sourceGeneration==generation,node.sourceGridCell==cell else{return nil}
            return markers
        }
        // This caller owns the actual constructor-bound cell and no carrier.
        // Completed carriers remove themselves only after genuine paint, selected
        // Promise completion and matching wall unlock; destructive removal unbinds.
        return .init(dropping:false,handoffLocked:false)
    }
    /// Tutorial observes the exact selected node; a same-ID replacement never
    /// inherits the old carrier's dropping flag. No timer or canonical guess.
    func sourceTutorialWildDropping(_ node:NativeDiceNode)->Bool {
        guard valid(),node.sourceContactNodeAlive,hooks.node(node.tileID) === node else{return false}
        return drops.values.contains { drop in
            drop.captured.lease.node === node && drop.runtime.generation==engine.state.generation &&
                drop.owner?.sourceTutorialWildDropping == true
        }
    }
    func owns(_ node:NativeDiceNode)->Bool {
        retainedNodeIDs.contains(node.tileID) && hooks.node(node.tileID) === node
    }
    /// A genuine accepted pickup/contact takes over an already-bookkept
    /// carrier. Retire only its finite transport; preserve the exact board node.
    @discardableResult func transferSettledGameplay(_ node:NativeDiceNode,generation:UInt64)->Bool {
        guard let drop=drops.values.first(where:{$0.captured.lease.node === node}) else{return !owns(node)}
        guard generation==engine.state.generation,drop.runtime.generation==generation,valid(drop) else{return false}
        // Before the actual wall handoff the existing carrier remains owner;
        // destination admission policy is not changed by this visual transfer.
        guard engine.meterDropReservations[drop.runtime.id]==nil else{return true}
        guard drop.sourceBookkeepingSucceeded,core.releaseToScene(dropID:drop.runtime.id) else{return false}
        drops.removeValue(forKey:drop.runtime.id)
        let owner=drop.owner;drop.owner=nil;owner?.dispose()
        return valid() && engine.state.generation==generation && hooks.node(node.tileID) === node
    }
    /// Called for ACTUAL Scene nodes after their canonical cell binding. Existing
    /// deferred/carrier node epochs are preserved, not replaced each synchronize.
    func bind(_ node:NativeDiceNode,cell:NativeCell,generation:UInt64){
        guard valid() else{return}
        if sourcePromiseBookkeeping {_ = node.bindSourceGridCell(cell,generation:generation)}
        store.bind(node:node,id:node.tileID,cell:.init(column:cell.column,row:cell.row),generation:generation)
    }
    /// Before canonical map removal, revoke only the captured actual object.
    func remove(_ node:NativeDiceNode){
        for drop in Array(drops.values) where drop.captured.lease.node === node && !drop.gameplayTransferred {retire(drop)}
        store.remove(node:node)
    }
    func receive(_ result:NativeMoveResult){
        guard valid(),result.accepted,result.state.generation==engine.state.generation else{return}
        for event in result.events {
            guard valid() else{return}
            switch event.kind {
            case .meterDropWillOpen:
                if let request=engine.pendingMeterOpen,event.reason==request.id {_=core.begin(request)}
            case .meterDropCanceled:
                if let id=event.reason,let drop=drops[id]{retire(drop)}
            case .specialReserved:
                guard let plan=engine.pendingSpecial,plan.id==event.reason,plan.generation==result.state.generation else{continue}
                let captured=engine.state
                guard transferSelectedNodes([plan.source.id,plan.destination.id]+plan.targets.map(\.id),generation:plan.generation,
                    current:{self.engine.state==captured && self.engine.pendingSpecial==plan}) else{return}
            case .directWildReserved:
                guard let plan=engine.pendingDirectWild,plan.id==event.reason,plan.generation==result.state.generation else{continue}
                let captured=engine.state
                guard transferSelectedNodes([plan.source.id,plan.destination.id],generation:plan.generation,
                    current:{self.engine.state==captured && self.engine.pendingDirectWild==plan}) else{return}
            default:break
            }
        }
    }
    private func transferSelectedNodes(_ ids:[String],generation:UInt64,current:()->Bool)->Bool {
        var seen=Set<String>()
        for id in ids where seen.insert(id).inserted {
            guard valid(),current() else{return false}
            guard let node=hooks.node(id) else{continue}
            guard valid(),current() else{return false}
            guard transferAcceptedGameplay(node,generation:generation) else{
                if valid(),current(){hooks.fault("source_meter_settled_contact_transfer_refused")}
                return false
            }
            guard valid(),current() else{return false}
        }
        return true
    }
    /// Called only for nodes captured by an actually accepted transaction.
    /// Unlike pickup, a destination is legal during the real140ms handoff.
    private func transferAcceptedGameplay(_ node:NativeDiceNode,generation:UInt64)->Bool {
        guard let drop=drops.values.first(where:{$0.captured.lease.node === node}) else{return !owns(node)}
        if drop.gameplayTransferred {return generation==engine.state.generation && valid(drop)}
        guard let reservation=engine.meterDropReservations[drop.runtime.id] else{
            return transferSettledGameplay(node,generation:generation)
        }
        guard generation==engine.state.generation,drop.runtime.generation==generation,valid(drop),
              reservation.landed,reservation.bookkeepingCommitted,drop.sourceBookkeepingSucceeded,
              let owner=drop.owner,owner.restored,core.releaseToScene(dropID:drop.runtime.id) else{return false}
        // Release the node lease before external foreground callbacks. The
        // original wall timeout can now outlive canonical removal of this die.
        drop.gameplayTransferred=true
        return owner.transferRestoredTileToGameplay() && valid() && engine.state.generation==generation
    }
    /// Plain v9 wildDropSmokeOrigin was captured before staging. Actual object
    /// identity remains required at impact; the flying pose is never substituted.
    func landingOrigin(_ capture:NativeWildMeterDropRuntime.Capture)->NativeMeterLandingSourceOwner.Origin? {
        guard let drop=drops[capture.id],drop.runtime==capture,valid(drop) else{return nil}
        let origin=drop.landingOrigin
        return valid(drop) ? origin:nil
    }
    private func createPlaceholder(_ capture:Hidden.Capture)->Hidden.Lease? {
        guard valid(),let request=engine.pendingMeterOpen,request.id==capture.id,request.generation==capture.generation,
              let pose=hooks.cellPose(request.tile.cell),valid(),let stage else{return nil}
        // Actual regular-zero constructor and Source epoch registration precede
        // setCoreValue, selected variant rebuild, artwork or idle allocation.
        let node=NativeDiceNode(id:request.tile.id,value:0,kind:"regular",variant:nil,depth:1,locked:true,textures:textures,deferSourceIdle:true)
        node.position=pose.point;node.setScale(pose.scale);node.alpha=0
        guard valid() else{node.dispose();return nil}
        hooks.install(node,request.tile.cell)
        guard valid(),hooks.node(node.tileID) === node,valid() else{
            // install may synchronously retire this caller and return a late
            // inserted object. Exact identity cleanup cannot remove new C.
            if hooks.node(node.tileID) === node {hooks.retire(node.tileID,node)} else {node.dispose()}
            return nil
        }
        if node.parent==nil {stage.addChild(node)}
        if sourcePromiseBookkeeping {
            // Literal board.createTile regular-zero rotG constructor. Reused
            // Source holders bypass createPlaceholder and consume no new draw.
            let draw=random()
            guard valid(),draw.isFinite,draw>=0,draw<1,
                  hooks.node(node.tileID) === node,node.parent === stage,
                  node.prepareSourceInitialHolder(rotation:draw*0.12-0.06,generation:capture.generation,cell:request.tile.cell),
                  valid(),hooks.node(node.tileID) === node,node.parent === stage else {
                if hooks.node(node.tileID) === node {hooks.retire(node.tileID,node)}else{node.dispose()}
                if valid(){hooks.fault("source_meter_placeholder_constructor_rejected")}
                return nil
            }
        }
        store.bind(node:node,id:node.tileID,cell:.init(column:capture.column,row:capture.row),generation:capture.generation)
        return store.read(capture)
    }
    private func valid()->Bool {guard !closed else{return false};let answer=hooks.current();return answer && !closed}
    private func valid(_ drop:Drop)->Bool {
        guard valid(),drops[drop.runtime.id] === drop,engine.state.generation==drop.runtime.generation else{return false}
        if drop.gameplayTransferred {return true}
        let owned=drop.captured.lease.isOwned()
        return owned && !closed && drops[drop.runtime.id] === drop
    }
    private func start(_ captured:Core.Captured){
        guard valid(),drops[captured.drop.id]==nil,let stage,captured.lease.isOwned(),valid() else{return}
        sequence &+= 1;let drop=Drop(captured,epoch:sequence);drops[drop.runtime.id]=drop
        let node=captured.lease.node
        // Native Scene places board scale on full-node carriers. This source
        // plain origin receipt applies only to the current stable layout.
        if node.parent === stage {
            drop.landingOrigin = .init(canvas:stage,sourceTile:node,point:node.position,renderScale:node.xScale,depth:Double(node.zPosition))
        }
        let owner=NativeWildMeterDropSceneOwner(capture:drop.runtime,tile:node,stage:stage,arcade:engine.state.mode == .arcade,
            resources:resources,timeouts:timeouts,attach:{[weak service] duration,advance,done in
                guard let service else{return nil};return NativeMeterSourceClockAdapter.attach(service:service,duration:duration,advance:advance,finish:done)
            },wallNow:wallNow,renderEpoch:hooks.renderEpoch,isCurrent:{[weak self,weak drop] in
                guard let self,let drop else{return false};return self.valid(drop)
            },stagePoint:{[weak self] in CGPoint(x:$0.x,y:(self?.hooks.viewport().height ?? 0)-$0.y)},makePlan:{[weak self,weak drop,weak stage] in
                guard let self,let drop,let stage,self.valid(drop) else{return nil}
                let viewport=self.hooks.viewport();guard self.valid(drop) else{return nil}
                var canceled=false
                let plan=NativeMeterSceneGeometry.plan(tile:drop.captured.lease.node,stage:stage,viewport:viewport,arcade:self.engine.state.mode == .arcade,random:{
                    guard !canceled,self.valid(drop) else{canceled=true;return 0}
                    let value=self.random();if !self.valid(drop){canceled=true};return value
                })
                return !canceled && self.valid(drop) ? plan:nil
            },makeHandoff:{[weak self,weak drop,weak stage] plan in
                guard let self,let drop,let stage,self.valid(drop) else{return nil}
                return NativeWildMeterDropNodeHandoff(tile:drop.captured.lease.node,stage:stage,capture:drop.runtime,sourceParentVisualScale:plan.visualScale,
                    stagePoint:{[weak self] in CGPoint(x:$0.x,y:(self?.hooks.viewport().height ?? 0)-$0.y)},isCurrent:{[weak self,weak drop] capture,node in
                        guard let self,let drop else{return false};return capture==drop.runtime && node === drop.captured.lease.node && self.valid(drop)
                    })
            })
        drop.owner=owner
        owner.onDropStarted={[weak self,weak drop] in guard let self,let drop,self.valid(drop) else{return};self.hooks.onDropStarted?(drop.captured.lease.node)}
        owner.onBeginActivity={[weak self,weak drop] in guard let self,let drop,self.valid(drop) else{return nil};return self.hooks.sourceActivity(drop.runtime.id,drop.runtime.generation)}
        owner.onBeginAudio={[weak self,weak drop] in guard let self,let drop,self.valid(drop) else{return {}};return self.hooks.carrierAudio(self.engine.state.mode == .arcade,drop.runtime.id,drop.runtime.generation)}
        owner.onBeginDividerMask={[weak self,weak drop] in guard let self,let drop,self.valid(drop) else{return {}};return self.hooks.dividerMask()}
        owner.onReceipt={[weak self,weak drop] event in guard let self,let drop,self.valid(drop) else{return};self.receive(event,drop:drop)}
        owner.onFailure={[weak self,weak drop] message in guard let self,let drop,self.valid(drop) else{return};self.hooks.fault(message)}
        core.whenWarmupSettled(dropID:drop.runtime.id){[weak self,weak drop] outcome in
            guard let self,let drop,self.valid(drop) else{return}
            if case .settled=outcome {drop.owner?.selectedWarmupCompleted(drop.runtime)}
        }
        guard valid(drop) else{retire(drop);return}
        owner.start()
    }
    private func sourceCancellation(_ drop:Drop)->NativeMeterDropCancellation? {
        engine.meterDropSourceCancellation(generation:drop.captured.request.generation,
            spawnToken:drop.captured.request.spawnToken,dropID:drop.runtime.id,retainedCarrier:true)
    }
    private func receive(_ event:NativeWildMeterDropRuntime.Event,drop:Drop){
        guard valid(drop) else{return}
        if sourcePromiseBookkeeping {
            if event == .dropPromiseCompleted {
                guard !drop.sourceTravelReactionScheduled else{return}
                drop.sourceTravelReactionScheduled=true
                // Literal await animateWildSpawnDropFromMeter: the first
                // continuation begins finally AFTER the entire GSAP callback.
                hooks.enqueue{[weak self,weak drop] in
                    guard let self,let drop,self.valid(drop) else{return}
                    let cancellation=self.sourceCancellation(drop)
                    guard self.valid(drop) else{return}
                    if cancellation==nil,self.engine.meterDropReservations[drop.runtime.id]?.warmupCompleted==true {
                        // Even an already-fulfilled Promise.all is awaited in
                        // finally. Preserve the second FIFO position; no timer.
                        self.hooks.enqueue{[weak self,weak drop] in
                            guard let self,let drop,self.valid(drop) else{return}
                            self.receiveReceipt(event,drop:drop)
                            self.finishSourceSpawnContinuation(drop)
                        }
                    } else {
                        // Pending warmup records the actual awaiting state;
                        // explicit cancellation skips that await as in Source.
                        self.receiveReceipt(event,drop:drop)
                        self.finishSourceSpawnContinuation(drop)
                    }
                }
                return
            }
            if event == .selectedWarmupCompleted,drop.sourceTravelReactionScheduled {
                // This producer must already be genuinely mapped. An unmapped
                // I/O completion is refused by the captured enqueue capability.
                hooks.enqueue{[weak self,weak drop] in
                    guard let self,let drop,self.valid(drop) else{return}
                    self.receiveReceipt(event,drop:drop)
                    self.finishSourceSpawnContinuation(drop)
                }
                return
            }
            if event == .spawnCompleted {
                drop.sourceSpawnEventPending=true
                finishSourceSpawnContinuation(drop)
                return
            }
        }
        receiveReceipt(event,drop:drop)
    }
    private func finishSourceSpawnContinuation(_ drop:Drop){
        guard valid(drop),drop.sourceSpawnEventPending,
              drop.sourceBookkeepingSucceeded else{return}
        drop.sourceSpawnEventPending=false
        receiveReceipt(.spawnCompleted,drop:drop)
    }
    private func receiveReceipt(_ event:NativeWildMeterDropRuntime.Event,drop:Drop){
        guard valid(drop) else{return}
        let receipt:NativeMeterDropReceipt?
        switch event {
        case .activityBegin100:receipt = .assetsPrepared
        case .tileRevealed:receipt = .revealed
        case .impact:receipt = .impact
        case .restoreBoardFallback:receipt = .boardFallbackRestored
        case .dropPromiseCompleted:receipt = .dropPromiseCompleted
        case .selectedWarmupCompleted:receipt = .selectedWarmupCompleted
        case .handoffLock(false):receipt = .wallHandoffUnlocked
        default:receipt=nil
        }
        if let receipt {
            // onLanded only reads this predicate. Cancellation latches at the
            // actual finally boundary, preserving a transient busy that clears.
            let finalCheck = receipt == .dropPromiseCompleted || (receipt == .selectedWarmupCompleted && engine.meterDropReservations[drop.runtime.id]?.dropCompleted == true)
            let reason=finalCheck ? sourceCancellation(drop):nil
            guard valid(drop) else{return}
            if let reason {
                let previous=engine.state,cancel=engine.requestMeterDropCancellation(id:drop.runtime.id,generation:drop.runtime.generation,reason:reason)
                if cancel.accepted {hooks.consume(cancel,previous)}
                guard valid(drop) else{return}
            }
            let previous=engine.state,result=engine.applyMeterDropReceipt(id:drop.runtime.id,generation:drop.runtime.generation,receipt:receipt)
            guard valid(drop) else{return}
            guard result.accepted else{hooks.fault("Rejected captured native meter receipt: \(receipt)");return}
            if result.events.contains(where:{$0.kind == .meterDropCompleted && $0.reason==drop.runtime.id}) {
                drop.sourceBookkeepingSucceeded=true // actual once Core receipt, not reservation absence
            }
            hooks.consume(result,previous)
            guard valid(drop) else{return}
        }
        switch event {
        case .mediumHaptic:hooks.onHaptic()
        case .impact:
            hooks.onImpact(drop.captured.lease.node,drop.runtime)
            guard valid(drop) else{return}
            hooks.onDropContact?(drop.captured.lease.node)
        case .landed,.spawnCompleted:
            // spawnCompleted is literal post-warmup finally startLandedIdle;
            // it also covers accepted explicit carrier interruption.
            let allowed=sourceCancellation(drop)==nil
            guard valid(drop) else{return}
            if core.landed(dropID:drop.runtime.id,allowsSourceIdle:allowed) {hooks.idleAdmitted(drop.captured.lease.node)}
            guard valid(drop) else{return}
            if event == .landed {hooks.onDropLanded?(drop.captured.lease.node)}
            if event == .spawnCompleted {drop.spawned=true}
        case .foregroundReleased:drop.foreground=true
        case .handoffLock(false):drop.wallUnlocked=true
        default:break
        }
        guard valid(drop) else{return}
        if drop.spawned && drop.foreground && drop.wallUnlocked {
            // Preserve same board node/idle; close transport captures only after
            // actual paint + wall unlock + selected Promise bookkeeping.
            guard drop.gameplayTransferred || core.releaseToScene(dropID:drop.runtime.id) else{return}
            drops.removeValue(forKey:drop.runtime.id);drop.owner?.dispose();drop.owner=nil
            guard valid() else{return};hooks.ownershipReleased()
        }
    }
    func painted(epoch:UInt64,onscreen:Bool,contains:(NativeDiceNode)->Bool){
        guard valid() else{return}
        for drop in Array(drops.values) {
            guard valid(drop) else{retire(drop);continue}
            let includes=contains(drop.captured.lease.node)
            guard valid(drop) else{retire(drop);continue}
            drop.owner?.painted(epoch:epoch,onscreen:onscreen,includesReplacement:includes)
        }
    }
    func interruptAcceptedAnimation(id:String){guard let drop=drops[id],valid(drop) else{return};drop.owner?.interruptAcceptedAnimation()}
    private func retire(_ drop:Drop){guard drops[drop.runtime.id] === drop else{return};drops.removeValue(forKey:drop.runtime.id)
        drop.owner?.dispose();drop.owner=nil;core.retire(dropID:drop.runtime.id)
    }
    func retireGeneration(_ generation:UInt64){
        for drop in Array(drops.values) where drop.runtime.generation==generation {retire(drop)}
        core.retireGeneration(generation);store.clearGeneration(generation)
    }
    func dispose(){guard !closed else{return};closed=true;for drop in Array(drops.values){retire(drop)};core.dispose();hidden.dispose();warmup.dispose();store.dispose()}
}
