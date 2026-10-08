import SpriteKit

/// PRIVATE composition owner. All delivery comes from captured Source roots,
/// the existing finite app-timeout owner and actual renderer receipts. No ticker.
@MainActor
final class NativeWildMeterDropSceneOwner {
    typealias Capture=NativeWildMeterDropRuntime.Capture
    struct MotionLease {
        let cancel:()->Void
        let suspend:(Bool)->Void
    }
    /// Adapter MUST attach a grouped .sourceGSAP(.timeline) root, never Scene15.
    typealias Attach=(_ duration:Double,_ advance:@escaping(Double)->Void,_ finish:@escaping(Bool)->Void)->MotionLease?
    let capture:Capture
    let tile:SKNode
    private weak var stage:SKNode?
    private let resources:NativeWildMeterDropResources
    private let timeouts:NativeSourceAppTimeoutOwner
    private let attach:Attach,wallNow:()->Double,renderEpoch:()->UInt64,isCurrent:()->Bool
    private let stagePoint:(NativeWildMeterDropPlan.Point)->CGPoint
    private let makePlan:()->NativeWildMeterDropPlan?
    private let makeHandoff:(NativeWildMeterDropPlan)->NativeWildMeterDropNodeHandoff?
    private let arcade:Bool
    private var request:NativeWildMeterDropResources.Request?
    private var clock:MotionLease?,handoffTimeout:NativeSourceAppTimeoutOwner.Receipt?
    private var presentation:NativeWildMeterDropPresentation?,handoff:NativeWildMeterDropNodeHandoff?
    private var stopAudio:(()->Void)?,endActivity:(()->Void)?,restoreDivider:(()->Void)?
    private var suspended=false,disposed=false,warmupReady=false,impactPhase=false,forwardedWarmup=false,interrupted=false
    private(set) var assetReady=false
    var presentationMounted:Bool {presentation?.parent != nil}
    var restored:Bool {presentation?.runtime.restored == true}
    var foregroundReleased:Bool {presentation?.runtime.foregroundReleased == true}
    var onReceipt:((NativeWildMeterDropRuntime.Event)->Void)?
    var onBeginActivity:(()->(()->Void)?)?
    var onBeginAudio:(()->(()->Void))?
    var onBeginDividerMask:(()->(()->Void))?
    var onFailure:((String)->Void)?

    init(capture:Capture,tile:SKNode,stage:SKNode,arcade:Bool,
         resources:NativeWildMeterDropResources,timeouts:NativeSourceAppTimeoutOwner,
         attach:@escaping Attach,wallNow:@escaping()->Double,renderEpoch:@escaping()->UInt64,
         isCurrent:@escaping()->Bool,stagePoint:@escaping(NativeWildMeterDropPlan.Point)->CGPoint,makePlan:@escaping()->NativeWildMeterDropPlan?,
         makeHandoff:@escaping(NativeWildMeterDropPlan)->NativeWildMeterDropNodeHandoff?) {
        self.capture=capture;self.tile=tile;self.stage=stage;self.arcade=arcade
        self.resources=resources;self.timeouts=timeouts;self.attach=attach;self.wallNow=wallNow
        self.renderEpoch=renderEpoch;self.isCurrent=isCurrent;self.stagePoint=stagePoint;self.makePlan=makePlan;self.makeHandoff=makeHandoff
    }
    private func valid()->Bool {guard !disposed else{return false};let current=isCurrent();return !disposed && current}
    func start() {
        guard !disposed,request==nil,presentation==nil,valid() else{return}
        let newRequest=resources.prepare(arcade:arcade,capture:capture) { [weak self] result in
            guard let self,!self.disposed,self.valid(),let stage=self.stage else{return}
            self.request=nil
            guard case let .success(textures)=result,let plan=self.makePlan(),let handoff=self.makeHandoff(plan) else {
                self.onFailure?("Native meter selected original assets/geometry unavailable");return
            }
            guard self.valid() else{handoff.dispose();return}
            do {
                let owner=try NativeWildMeterDropPresentation(plan:plan,capture:self.capture,preparedTextures:textures,
                    stagePoint:self.stagePoint)
                guard self.valid() else{owner.dispose();handoff.dispose();return}
                self.handoff=handoff;self.presentation=owner;stage.addChild(owner)
                owner.onTilePose={ [weak self] pose in guard let self,!self.disposed,self.valid() else{return};_ = self.handoff?.apply(pose)}
                owner.onEvent={ [weak self] event in self?.receive(event) }
                self.assetReady=true
                // Source marks dropping before its initially hidden stage pose.
                owner.prepared(animationSeconds:0)
                owner.advance(animationSeconds:0,wallMilliseconds:self.wallNow(),renderEpoch:self.renderEpoch())
                guard self.valid(),self.presentation === owner else{return}
                if self.warmupReady {owner.selectedWarmupCompleted()}
                guard self.valid(),self.presentation === owner else{return}
                self.startPhase(duration:NativeWildMeterDropPlan.travelStart+NativeWildMeterDropPlan.travelDuration,base:0)
            } catch {self.onFailure?("Native meter selected original texture admission failed")}
        }
        if presentation==nil,!disposed {request=newRequest}
    }
    private func startPhase(duration:Double,base:Double) {
        guard !disposed,valid() else{return}
        let captured=attach(duration,{ [weak self] elapsed in
            guard let self,!self.disposed,self.valid() else{return}
            self.presentation?.advance(animationSeconds:base+elapsed,wallMilliseconds:self.wallNow(),renderEpoch:self.renderEpoch())
        },{ [weak self] success in
            guard let self,!self.disposed,self.valid() else{return}
            if !success {self.interruptAcceptedAnimation()}
        })
        guard let captured else {onFailure?("Native meter Source clock root unavailable");return}
        guard valid() else {captured.cancel();return}
        clock=captured;captured.suspend(suspended)
    }
    private func receive(_ event:NativeWildMeterDropRuntime.Event) {
        guard !disposed,valid() else{return}
        if event == .selectedWarmupCompleted {
            guard !forwardedWarmup else{return};forwardedWarmup=true
        }
        switch event {
        case .dividerMask(true):
            let lease=onBeginDividerMask?()
            guard valid() else{lease?();return}
            restoreDivider=lease
        case .dividerMask(false):let restore=restoreDivider;restoreDivider=nil;restore?()
        case .activityBegin100:
            let lease=onBeginActivity?()
            guard valid() else{lease?();return}
            endActivity=lease
        case .activityEnd100:let end=endActivity;endActivity=nil;end?()
        case .carrierSoundBegin:
            let lease=onBeginAudio?()
            guard valid() else{lease?();return}
            stopAudio=lease
        case .carrierSoundStop:let stop=stopAudio;stopAudio=nil;stop?()
        case .impact:
            if !impactPhase {
                impactPhase=true
                onReceipt?(event)
                // A new root is allocated at actual travel callback delivery.
                startPhase(duration:NativeWildMeterDropPlan.impactDuration,
                    base:NativeWildMeterDropPlan.travelStart+NativeWildMeterDropPlan.travelDuration)
            }
            return
        case .handoffLock(true):
            let restoredWall=wallNow()
            handoffTimeout=timeouts.schedule(sourceID:"meter-handoff:"+capture.id,generation:capture.generation,
                delayMilliseconds:140,elapsed:{ [weak self] in
                    guard let self,!self.disposed,self.valid() else{return}
                    self.handoffTimeout=nil
                    self.presentation?.advanceWall(wallMilliseconds:max(self.wallNow(),restoredWall+140))
                })
        default:break
        }
        guard valid() else{return}
        onReceipt?(event)
    }
    func selectedWarmupCompleted(_ receipt:Capture) {
        guard receipt==capture,!disposed,valid(),!warmupReady else{return}
        warmupReady=true;presentation?.selectedWarmupCompleted()
        // If hot warmup beats carrier assets, persist it without marking dropping.
        if presentation==nil {receive(.selectedWarmupCompleted)}
    }
    func painted(epoch:UInt64,onscreen:Bool,includesReplacement:Bool) {
        guard !disposed,valid() else{return}
        presentation?.painted(renderEpoch:epoch,onscreen:onscreen,includesReplacement:includesReplacement)
    }
    func setCapturedChildSuspended(_ value:Bool) {guard !disposed else{return};suspended=value;clock?.suspend(value)}
    /// Explicit Source kill is distinct from global pause/visibility.
    func interruptAcceptedAnimation() {
        guard !disposed,assetReady,valid(),!interrupted else{return}
        interrupted=true
        let captured=clock;clock=nil;captured?.cancel()
        presentation?.interrupt(wallMilliseconds:wallNow(),renderEpoch:renderEpoch())
    }
    func dispose() {
        guard !disposed else{return};disposed=true
        if let request {resources.cancel(request)};request=nil
        if let handoffTimeout {_=timeouts.cancel(handoffTimeout)};handoffTimeout=nil
        let cancel=clock;clock=nil;cancel?.cancel()
        let stop=stopAudio;stopAudio=nil;stop?()
        let end=endActivity;endActivity=nil;end?()
        let restore=restoreDivider;restoreDivider=nil;restore?()
        // Obsolete generation disposal never mutates engine or replacement node.
        presentation?.dispose();presentation=nil;handoff?.dispose();handoff=nil
        onReceipt=nil;onBeginActivity=nil;onBeginAudio=nil;onBeginDividerMask=nil;onFailure=nil
    }
}
