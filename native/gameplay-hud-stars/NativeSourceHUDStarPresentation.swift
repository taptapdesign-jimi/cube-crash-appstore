#if canImport(SpriteKit)
import SpriteKit
import StackToSixGameplay

/// Original protected stage container and newly allocated star sprites. Texture
/// preparation is external and selected; this adapter never decodes on its clock.
@MainActor final class NativeSourceHUDStarPresentation {
    @MainActor private final class FlightRoot:NativeSourceAnimationParticipant {
        let update:(Double)->Void
        init(_ update:@escaping(Double)->Void){self.update=update}
        func advanceSourceAnimation(seconds:Double){update(seconds)}
    }
    struct Bindings {
        let current:()->Bool
        let random:()->Double
        let acquireCadence:()->()->Void
        let onArrival:(NativeMoveResult)->Void
        let onRetired:(NativeSourceHUDStarJob)->Void
    }
    private weak var stage:SKNode?
    private let height:CGFloat,texture:SKTexture,pixelSize:CGSize
    private let service:NativeSourceAnimationClockService,timeouts:NativeSourceAppTimeoutOwner,engine:NativeGameplayEngine,generation:UInt64
    private let bindings:Bindings
    private let container=SKNode()
    private var sprites:[String:SKSpriteNode]=[:],roots:[UUID:FlightRoot]=[:],jobCaptures:[UUID:NativeSourceHUDStarJob]=[:]
    private var disposed=false
    private(set) var selectedAssetsReady:Bool
    var admissionOpen:Bool{current() && selectedAssetsReady}
    func acceptsParticle(_ selected:NativeSourceHUDStarTexturePreparation.Prepared)->Bool {
        admissionOpen && selected.current && selected.texture === texture && selected.pixelSize==pixelSize
    }
    var pendingJobCount:Int{jobs.jobCount}
    var capturedJobs:[NativeSourceHUDStarJob]{Array(jobCaptures.values)}
    var starIDs:[String]{jobs.liveStarIDs}
    var mountedContainer:SKNode?{jobs.containerMounted ? container:nil}
    private lazy var jobs=NativeSourceHUDStarJobs(hooks:.init(current:{[weak self] in self?.current() ?? false},acquireCadence:{[weak self] in self?.bindings.acquireCadence() ?? {}},mountContainer:{[weak self] in self?.mountContainer() ?? false},removeContainer:{[weak self] in self?.container.removeFromParent()},mountStar:{[weak self] id,plan in self?.mountStar(id,plan) ?? false},paintStar:{[weak self] id,pose in self?.paint(id,pose)},removeStar:{[weak self] id in self?.sprites.removeValue(forKey:id)?.removeFromParent()},timeline:{[weak self] plan,update,complete in self?.timeline(plan,update,complete)},wall:{[weak self] delay,elapsed in
        guard let self else{return{}}
        let token=self.timeouts.schedule(sourceID:"source-hud-star-wall:\(UUID().uuidString)",generation:self.generation,delayMilliseconds:Int(delay.rounded(.towardZero)),elapsed:elapsed)
        return{[weak self] in _=self?.timeouts.cancel(token)}
    },arrive:{[weak self] id in self?.arrive(id)},retire:{[weak self] uuid,_ in self?.retire(uuid)}))
    /// selectedAssetsReady is an actual captured SKTexture.preload completion,
    /// never inferred from tile creation, an image object or a elapsed timer.
    init?(stage:SKNode,viewportHeight:CGFloat,texture:SKTexture,pixelSize:CGSize,selectedAssetsReady:Bool,service:NativeSourceAnimationClockService,timeouts:NativeSourceAppTimeoutOwner,engine:NativeGameplayEngine,bindings:Bindings) {
        guard selectedAssetsReady,pixelSize.width>0,pixelSize.height>0,pixelSize.width.isFinite,pixelSize.height.isFinite,viewportHeight>0,viewportHeight.isFinite else{return nil}
        self.stage=stage;height=viewportHeight;self.texture=texture;self.pixelSize=pixelSize;self.selectedAssetsReady=selectedAssetsReady
        self.service=service;self.timeouts=timeouts;self.engine=engine;generation=engine.state.generation;self.bindings=bindings
        container.name="source-protected-hud-star-container";container.zPosition=999999;container.isUserInteractionEnabled=false
    }
    private func current()->Bool {
        guard !disposed,stage != nil,engine.state.generation==generation else{return false}
        let admitted=bindings.current()
        return admitted && !disposed && stage != nil && engine.state.generation==generation
    }
    private func mountContainer()->Bool {
        guard current(),let stage else{return false};stage.addChild(container)
        guard current(),container.parent === stage else{container.removeFromParent();return false};return true
    }
    private func mountStar(_ id:String,_ plan:NativeSourceHUDStarPlan)->Bool {
        guard current(),sprites[id]==nil,container.parent === stage else{return false}
        let star=SKSpriteNode(texture:texture,size:pixelSize);star.name="source-hud-star:\(id)";star.anchorPoint = .init(x:0.5,y:0.5)
        star.position = .init(x:plan.points[0].x,y:height-plan.points[0].y);star.setScale(plan.size/plan.textureWidth)
        sprites[id]=star;container.addChild(star)
        return current() && sprites[id] === star && star.parent === container
    }
    private func paint(_ id:String,_ pose:NativeSourceHUDStarPlan.Pose) {
        guard current(),let star=sprites[id],star.parent === container else{return}
        star.position = .init(x:pose.point.x,y:height-pose.point.y);star.setScale(pose.scale);star.zRotation = -pose.rotation
    }
    private func timeline(_ plan:NativeSourceHUDStarPlan,_ update:@escaping(Double)->Void,_ complete:@escaping()->Void)->NativeSourceHUDStarJobs.Cancel? {
        guard current() else{return nil};let id=UUID(),root=FlightRoot(update);roots[id]=root
        guard let lease=service.register(participant:root,duration:plan.duration,domain:.sourceGSAP(.timeline),delay:plan.delay,cleanup:{[weak self] success in
            guard let self,self.roots.removeValue(forKey:id) === root else{return}
            if success{complete()}
        }) else{roots.removeValue(forKey:id);return nil}
        guard current(),roots[id] === root else{roots.removeValue(forKey:id);lease.cancel();return nil}
        return{[weak self] in self?.roots.removeValue(forKey:id);lease.cancel()}
    }
    @discardableResult func start(receiptIDs:[String],screenOrigin:CGPoint,hudTarget:CGPoint)->Bool {
        guard current(),selectedAssetsReady else{return false}
        guard let capture=engine.registerSourceHUDStarJob(receiptIDs:receiptIDs,generation:generation) else{return false}
        let id=UUID();jobCaptures[id]=capture
        let started=jobs.start(jobID:id,ids:receiptIDs,origin:screenOrigin,target:hudTarget,textureWidth:pixelSize.width,random:bindings.random)
        if !started {retire(id)}
        return started
    }
    private func arrive(_ id:String) {
        guard current(),let capture=jobCaptures.values.first(where:{$0.receiptIDs.contains(id)}) else{return}
        let result=engine.commitSourceHUDStarArrival(job:capture,receiptID:id)
        guard result.accepted,current() else{return};bindings.onArrival(result)
    }
    private func retire(_ id:UUID) {
        guard let capture=jobCaptures.removeValue(forKey:id) else{return}
        // Actual captured cleanup may still retire Core after UI admission closed;
        // generation guards inside Core prevent touching replacement state.
        let retired=engine.retireSourceHUDStarJob(job:capture)
        if retired,!disposed{bindings.onRetired(capture)}
    }
    func dispose() {
        guard !disposed else{return};disposed=true;jobs.dispose()
        sprites.values.forEach{$0.removeFromParent()};sprites.removeAll();container.removeFromParent()
        let remaining=jobCaptures;jobCaptures.removeAll()
        for capture in remaining.values {_=engine.retireSourceHUDStarJob(job:capture)}
        roots.removeAll();selectedAssetsReady=false
    }
}
#endif
