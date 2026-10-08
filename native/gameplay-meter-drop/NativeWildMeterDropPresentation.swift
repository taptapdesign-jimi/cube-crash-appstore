import SpriteKit

/// Selected borrowed original textures only. Root owns asset preparation and
/// source clocks. The emitted native die is retained by the Scene: onTilePose
/// applies this plan to that SAME captured node instead of inventing a new die.
/// This carrier must be mounted directly in the existing foreground stage at
///2100000, above both board and authored HUD, with emitted die at2100001.
@MainActor
final class NativeWildMeterDropPresentation: SKNode {
    enum AdmissionError: Error { case missingTexture(String) }
    let runtime: NativeWildMeterDropRuntime
    var onTilePose: ((NativeWildMeterDropPlan.TilePose) -> Void)?
    var onEvent: ((NativeWildMeterDropRuntime.Event) -> Void)?
    private let carrier: SKSpriteNode
    private var borrowedTextures: [String:SKTexture]
    private let stagePoint: (NativeWildMeterDropPlan.Point) -> CGPoint
    private var disposed=false,lastSource: String?

    init(plan:NativeWildMeterDropPlan,capture:NativeWildMeterDropRuntime.Capture,
         preparedTextures:[String:SKTexture],stagePoint:@escaping (NativeWildMeterDropPlan.Point)->CGPoint) throws {
        let paths=plan.arcade ? NativeWildMeterDropPlan.crateSources:NativeWildMeterDropPlan.backpackSources
        for path in paths {guard preparedTextures[path] != nil else {throw AdmissionError.missingTexture(path)}}
        self.stagePoint=stagePoint;borrowedTextures=preparedTextures
        runtime=NativeWildMeterDropRuntime(capture:capture,plan:plan)
        let texture=preparedTextures[paths[0]]!
        carrier=SKSpriteNode(texture:texture)
        carrier.size=texture.size()
        super.init()
        isUserInteractionEnabled=false;zPosition=CGFloat(NativeWildMeterDropPlan.carrierDepth)
        carrier.anchorPoint=CGPoint(x:0.5,y:0.28);addChild(carrier)
        carrier.alpha=0;lastSource=paths[0]
        runtime.onEvent={ [weak self] event in
            guard let self,!self.disposed else {return}
            if event == .carrierReleased {self.carrier.removeFromParent()}
            if event == .mediumHaptic {
                // Literal travel onComplete paints target/.76 BEFORE haptic and
                // authored onImpact. Runtime events precede the outer frame return.
                let boundary=NativeWildMeterDropPlan.travelStart+NativeWildMeterDropPlan.travelDuration
                self.onTilePose?(self.runtime.plan.sample(seconds:boundary,impactStart:boundary,
                    restored:false,wallHandoffPending:false).tile)
            }
            if event == .restoreBoardFallback {
                // Source restores the SAME tile parent/pose BEFORE starting idle.
                let tile=self.runtime.plan.sample(seconds:0,impactStart:nil,restored:true,wallHandoffPending:true).tile
                self.onTilePose?(tile)
            }
            if self.runtime.restored,
               event == .handoffLock(false) || event == .spawnCompleted {
                var tile=self.runtime.plan.sample(seconds:0,impactStart:nil,restored:true,
                    wallHandoffPending:self.runtime.handoffPending).tile
                tile.interactive=self.runtime.isTileInputLegal
                self.onTilePose?(tile)
            }
            self.onEvent?(event)
        }
    }
    required init?(coder:NSCoder) {fatalError("init(coder:) has not been implemented")}
    func prepared(animationSeconds:Double) {
        guard !disposed else {return}
        runtime.assetsPrepared(runtime.capture,animationSeconds:animationSeconds)
    }
    func advance(animationSeconds:Double,wallMilliseconds:Double,renderEpoch:UInt64) {
        guard !disposed,let frame=runtime.advance(runtime.capture,animationSeconds:animationSeconds,
            wallMilliseconds:wallMilliseconds,renderEpoch:renderEpoch) else {return}
        if !frame.carrier.released {
            let pose=frame.carrier.pose
            if frame.carrier.source != lastSource,let texture=borrowedTextures[frame.carrier.source] {
                carrier.texture=texture;carrier.size=texture.size();lastSource=frame.carrier.source
            }
            carrier.position=stagePoint(pose.point)
            carrier.xScale=CGFloat(pose.scaleX);carrier.yScale=CGFloat(pose.scaleY)
            carrier.zRotation = -CGFloat(pose.rotation);carrier.alpha=CGFloat(pose.opacity)
        }
        onTilePose?(frame.tile)
    }
    func advanceWall(wallMilliseconds:Double) {
        guard !disposed else {return};runtime.advanceWall(runtime.capture,wallMilliseconds:wallMilliseconds)
    }
    func selectedWarmupCompleted() {
        guard !disposed else {return};runtime.selectedWarmupCompleted(runtime.capture)
    }
    func painted(renderEpoch:UInt64,onscreen:Bool,includesReplacement:Bool) {
        guard !disposed else {return}
        runtime.painted(runtime.capture,renderEpoch:renderEpoch,onscreen:onscreen,includesReplacement:includesReplacement)
    }
    func interrupt(wallMilliseconds:Double,renderEpoch:UInt64) {
        guard !disposed else {return}
        runtime.interrupt(runtime.capture,wallMilliseconds:wallMilliseconds,renderEpoch:renderEpoch)
    }
    func dispose() {
        guard !disposed else {return}
        runtime.dispose();disposed=true;carrier.removeFromParent();removeFromParent()
        borrowedTextures.removeAll();onTilePose=nil;onEvent=nil;runtime.onEvent=nil
    }
}
