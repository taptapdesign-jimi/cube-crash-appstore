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
    private var holdAtCarrierArrival=false,restartCarrierAudioOnResume=false
    private var tutorialCarrierArrival=false
    private var carrierResumeStart:Double?
    private var carrierOpeningBounce=false
    private(set) var carrierArrivalHeld=false
    var onDropStarted:(()->Void)?
    var onCarrierArrived:(()->Void)?
    var onCarrierPaint:((SKSpriteNode?)->Void)?
    private(set) var assetReady=false
    var heldTutorialCarrier:SKSpriteNode? {carrierArrivalHeld && valid() ? presentation?.carrier:nil}
    var presentationMounted:Bool {presentation?.parent != nil}
    var restored:Bool {presentation?.runtime.restored == true}
    /// Actual retained carrier lifetime, including paused motion.
    var sourceTutorialWildDropping:Bool {!disposed && valid() && assetReady && presentationMounted && !restored}
    var foregroundReleased:Bool {presentation?.runtime.foregroundReleased == true}
    func captureSourceDropActivity()->Bool? {
        guard valid() else{return nil}
        if let presentation {
            let active=presentation.runtime.sourceDropActivityActive
            return valid() ? active:nil
        }
        guard !assetReady,valid() else{return nil}
        return false // The genuine awaited-assets acquisition has not occurred.
    }
    func captureSourceTileMarkers()->NativeWildMeterDropRuntime.SourceTileMarkers? {
        guard valid() else{return nil}
        if let presentation {
            let markers=presentation.runtime.sourceTileMarkers
            return valid() ? markers:nil
        }
        // Awaited assets have not reached the actual Source assignment yet.
        guard !assetReady,valid() else{return nil}
        return .init(dropping:false,handoffLocked:false)
    }
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
    func pauseAtCarrierArrival() {holdAtCarrierArrival=true}
    @discardableResult func resumeAfterCarrierArrival()->Bool {
        guard carrierArrivalHeld,valid() else{return false}
        carrierArrivalHeld=false;holdAtCarrierArrival=false
        carrierOpeningBounce=true
        clock?.suspend(suspended)
        return true
    }
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
                self.tutorialCarrierArrival=plan.tutorialCarrierArrival
                self.handoff=handoff;self.presentation=owner;stage.addChild(owner)
                if plan.tutorialCarrierArrival {owner.onCarrierPaint={[weak self] node in self?.onCarrierPaint?(node)}}
                owner.onTilePose={ [weak self] pose in guard let self,!self.disposed,self.valid() else{return};_ = self.handoff?.apply(pose)}
                owner.onEvent={ [weak self] event in self?.receive(event) }
                self.assetReady=true
                self.onDropStarted?()
                guard self.valid(),self.presentation === owner else{return}
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
        let slowArrival=tutorialCarrierArrival && base==0
        let openingBounce=holdAtCarrierArrival && base==0
        let bounceDuration=NativeWildMeterDropPlan.tutorialOpenBounceDurationFor(arcade:arcade)
        let phaseDuration=duration+(slowArrival ? 0.22:0)+(openingBounce ? bounceDuration:0)
        let captured=attach(phaseDuration,{ [weak self] clockElapsed in
            guard let self,!self.disposed,self.valid() else{return}
            let elapsed=slowArrival ? (clockElapsed<=0.5 ? clockElapsed*0.28/0.5:clockElapsed-0.22):clockElapsed
            if self.holdAtCarrierArrival && !self.carrierArrivalHeld && base==0 && elapsed>=0.28 {
                self.presentation?.advance(animationSeconds:0.28,wallMilliseconds:self.wallNow(),renderEpoch:self.renderEpoch())
                self.carrierResumeStart=clockElapsed
                self.carrierArrivalHeld=true
                self.clock?.suspend(true)
                let stop=self.stopAudio;self.stopAudio=nil;stop?()
                self.restartCarrierAudioOnResume=true
                self.onCarrierArrived?()
                return
            }
            if self.carrierArrivalHeld{return}
            let resumed=base==0 && self.carrierResumeStart != nil
            if self.carrierOpeningBounce,let start=self.carrierResumeStart {
                let age=max(0,clockElapsed-start)
                if age<bounceDuration {
                    self.presentation?.advance(animationSeconds:0.28,wallMilliseconds:self.wallNow(),renderEpoch:self.renderEpoch(),carrierEmphasis:NativeWildMeterDropPlan.tutorialOpenBounce(at:age,arcade:self.arcade))
                    return
                }
                self.carrierOpeningBounce=false
                if self.restartCarrierAudioOnResume {
                    self.restartCarrierAudioOnResume=false;self.stopAudio=self.onBeginAudio?()
                }
            }
            // Addition/subtraction of the longer hold can end a root one ULP
            // before genuine travel completion. Publish its exact final boundary.
            let sourceTime=clockElapsed>=phaseDuration-1e-9 ? base+duration:
                resumed ? max(0.28,base+elapsed-bounceDuration):base+elapsed
            self.presentation?.advance(animationSeconds:sourceTime,wallMilliseconds:self.wallNow(),renderEpoch:self.renderEpoch())
        },{ [weak self] success in
            guard let self,!self.disposed,self.valid() else{return}
            if !success {self.interruptAcceptedAnimation()}
        })
        guard let captured else {onFailure?("Native meter Source clock root unavailable");return}
        guard valid() else {captured.cancel();return}
        clock=captured;captured.suspend(suspended || carrierArrivalHeld)
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
    @discardableResult func transferRestoredTileToGameplay()->Bool {
        guard !disposed,valid(),restored,let presentation,presentation.runtime.spawnCompleted else{return false}
        // The captured merge now paints/retires this exact node. Only the
        // original finite wall timeout remains owned by this carrier.
        presentation.onTilePose=nil;handoff?.dispose();handoff=nil
        return presentation.runtime.transferRestoredForeground(capture)
    }
    func setCapturedChildSuspended(_ value:Bool) {guard !disposed else{return};suspended=value;clock?.suspend(value || carrierArrivalHeld)}
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
        onDropStarted=nil;onCarrierArrived=nil;onCarrierPaint=nil;onReceipt=nil;onBeginActivity=nil;onBeginAudio=nil;onBeginDividerMask=nil;onFailure=nil
    }
}
