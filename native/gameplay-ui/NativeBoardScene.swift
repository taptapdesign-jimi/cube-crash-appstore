import SpriteKit
import UIKit
import StackToSixGameplay

/// Opt-in aggregates compare actual Source paints to existing Scene handoffs.
/// A handoff is not proof that Metal presented a drawable.
struct NativeSourceDragRenderDiagnostics {
    private var paintSequence:UInt64=0,lastRenderSequence:UInt64=0,lastPaintMilliseconds:Double?
    private(set) var rendersWithoutPaint=0,rendersOnePaint=0,rendersMultiplePaints=0
    private(set) var worstPaintAgeMilliseconds=0.0,worstQueuedTouchAgeMilliseconds=0.0
    mutating func painted(at milliseconds:Double,touchMilliseconds:Double?) {
        paintSequence &+= 1;lastPaintMilliseconds=milliseconds
        if let touchMilliseconds {worstQueuedTouchAgeMilliseconds=max(worstQueuedTouchAgeMilliseconds,max(0,milliseconds-touchMilliseconds))}
    }
    mutating func rendered(at milliseconds:Double,dragging:Bool) {
        defer{lastRenderSequence=paintSequence}
        guard dragging else{return}
        let count=paintSequence &- lastRenderSequence
        if count==0 {rendersWithoutPaint+=1}else if count==1 {rendersOnePaint+=1}else{rendersMultiplePaints+=1}
        if let lastPaintMilliseconds {worstPaintAgeMilliseconds=max(worstPaintAgeMilliseconds,max(0,milliseconds-lastPaintMilliseconds))}
    }
    mutating func resetInterval() {
        rendersWithoutPaint=0;rendersOnePaint=0;rendersMultiplePaints=0
        worstPaintAgeMilliseconds=0;worstQueuedTouchAgeMilliseconds=0
    }
    mutating func retireDrag(){lastPaintMilliseconds=nil;lastRenderSequence=paintSequence}
}

/// One native renderer/input owner. The engine is the only decision owner;
/// animation completion never computes a merge, spawn, reward or terminal.
@MainActor
final class NativeBoardScene: SKScene {
    private weak var ownedRenderHost:(any NativeGameplayRenderHost)?
    private weak var mountedLifecycleHost:(any NativeGameplayRenderHost)?
    var renderPipelineProbe:NativeRenderPipelineProbe? = Bundle.main.bundleIdentifier=="com.taptapdesign.stacktosix.native" && ProcessInfo.processInfo.arguments.contains("--cc-render-pipeline-probe") ? NativeRenderPipelineProbe():nil
    var renderPipelineProbeAdmissionOpen:Bool {
        guard sourceAnimationBindingAdmissionOpen,!suspended,!isPaused,!exitInProgress,isBoardEntryComplete,
              engine.state.terminal==nil,engine.state.tutorial?.active != true,
              let host=gameplayRenderHost,host.renderedScene === self,host.renderView.window != nil,
              !host.renderView.isHidden,!host.renderingPaused,gameplayRenderHostVisible(host) else{return false}
        return true
    }
    func renderPipelineProbeTarget()->NativeRenderPipelineProbe.Target? {
        guard renderPipelineProbeAdmissionOpen,activeTouch==nil,draggedID==nil,!engine.hasUnsavableSourceGameplayState,
              let geometry else{return nil}
        for tile in engine.state.tiles.sorted(by:{$0.id<$1.id}) where tile.isPlayable && tile.value>0 && tile.value<6 && tile.gameplayArchetype==nil && !tile.sourceResidualWildPresence {
            guard let node=nodesByID[tile.id],node.parent === canvasRoot,node.sourceContactNodeAlive,
                  !node.isHidden,node.alpha>0.01,(!node.sourceOuterDriven || node.sourceEventMode=="static") else{continue}
            return .init(id:tile.id,generation:engine.state.generation,center:node.convert(.zero,to:self),radius:min(12,geometry.tileSize*0.15))
        }
        return nil
    }
    func renderPipelineProbeHolds(_ target:NativeRenderPipelineProbe.Target)->Bool {
        draggedID==target.id && engine.state.generation==target.generation && nodesByID[target.id]?.parent === canvasRoot
    }
    var gameplayRenderHost:(any NativeGameplayRenderHost)? {
        if let host=ownedRenderHost {return host.renderedScene === self ? host:nil}
        return view
    }
    private func gameplayRenderHostVisible(_ host:any NativeGameplayRenderHost)->Bool {
        guard host.renderedScene === self,let window=host.renderView.window,
              UIApplication.shared.applicationState == .active,
              window.windowScene?.activationState == nil || window.windowScene?.activationState == .foregroundActive else{return false}
        var surface:UIView?=host.renderView
        while let current=surface {
            if current.isHidden || current.alpha<=0.001 {return false}
            surface=current.superview
        }
        return true
    }
    @discardableResult func mountOwnedRenderHost(_ host:any NativeGameplayRenderHost)->Bool {
        guard !sourceDisposalInProgress,!disposed,host.renderedScene === self,
              view==nil,ownedRenderHost==nil || ownedRenderHost === host else{return false}
        ownedRenderHost=host
        mountGameplayRenderHost(host)
        return !disposed && ownedRenderHost === host && host.renderedScene === self
    }
    func unmountOwnedRenderHost(_ host:any NativeGameplayRenderHost) {
        guard ownedRenderHost === host else{return}
        renderPipelineProbe?.cancel(scene:self,reason:"host-unmounted")
        if draggedID != nil {cancelDrag(pointerCancelled:true)}
        retireSourceRendererDragTransport()
        ownedRenderHost=nil
        if mountedLifecycleHost === host {mountedLifecycleHost=nil}
    }
    private func mountGameplayRenderHost(_ host:any NativeGameplayRenderHost) {
        guard mountedLifecycleHost !== host else{return}
        mountedLifecycleHost=host;host.renderView.isMultipleTouchEnabled=true
        let sourceInitialEntry=sourceInitialEntryPending;sourceInitialEntryPending=false
        synchronize(animateEntry:lastGeneration==nil || sourceInitialEntry)
        guard !disposed,mountedLifecycleHost === host,host.renderedScene === self else{return}
        retainSourceRendererDragTransport()
    }
    private func touchLocationInGameplayScene(_ touch:UITouch)->CGPoint {
        guard let host=ownedRenderHost else{return touch.location(in:self)}
        return host.viewPointToScene(touch.location(in:host.renderView),scene:self)
    }
    var sourceWildShimmerEnabled=false
    private var sourceShimmerVisibilityElapsedMs=0.0
    let engine: NativeGameplayEngine
    private var sourceStarHaloScope:NativeGameplaySourceContext.Scope?
    private var sourceStarHaloTicker:NativeSourceStarHaloTicker?
    private var sourceStarHaloLayer:SKNode?
    private var sourceStarPerformanceNow:(()->Double)?
    private var sourceEntryDeferredPlainStars:[NativeDiceNode]=[]
    private var sourcePlainStarWaitsForSharedIdle=false
    private var sourceDeferredIdleResumeActive=false
    func sourcePlainStarHalosConfigured(scope:NativeGameplaySourceContext.Scope)->Bool {
        sourceAnimationBindingAdmissionOpen && scope.current && sourceStarHaloScope === scope && sourceStarHaloTicker != nil && sourceStarHaloLayer?.parent === self
    }
    @discardableResult func configureSourceRestoredPlainStarHalos(scope:NativeGameplaySourceContext.Scope,waitForSharedIdle:Bool=false)->Bool {
        guard sourceAnimationBindingAdmissionOpen,scope.current else{return false}
        guard engine.state.tiles.compactMap({nodesByID[$0.id]}).contains(where:{$0.sourceRestoredWildConstructorCurrent && $0.kind=="wild" && $0.variant==nil}) else{return true}
        if sourcePlainStarHalosConfigured(scope:scope) {return true}
        return configureSourcePlainStarHalos(scope:scope,waitForSharedIdle:waitForSharedIdle)
    }
    @discardableResult func configureSourcePlainStarHalos(scope:NativeGameplaySourceContext.Scope,
        performanceNow:@escaping()->Double={CACurrentMediaTime()*1000},waitForSharedIdle:Bool=false)->Bool {
        guard sourceAnimationBindingAdmissionOpen,scope.current,scope.service.sourceFrameTransportAdmissionOpen,
            scope.sourceMicrotaskTasks != nil,sourceStarHaloScope==nil else{return false}
        sourcePlainStarWaitsForSharedIdle=waitForSharedIdle
        sourceStarHaloScope=scope;sourceStarPerformanceNow=performanceNow
        let generation=engine.state.generation,layer=SKNode();layer.name="ANIMATED_DICE_HUD_FOREGROUND";layer.zPosition=10001;addChild(layer);sourceStarHaloLayer=layer
        sourceStarHaloTicker=NativeSourceStarHaloTicker(service:scope.service,generation:generation,current:{[weak self,weak scope] in
            guard let self,let scope else{return false}
            return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceStarHaloScope === scope && self.engine.state.generation==generation
        },performanceNow:performanceNow,beginRendering:{[weak self] in
            self?.beginSourceMotion(.starHalo,id:"wild-star-shared-ticker",generation:generation)
        })
        sourceEntryDeferredPlainStars=engine.state.tiles.compactMap{nodesByID[$0.id]}.filter{$0.sourceRestoredWildConstructorCurrent && $0.kind=="wild" && $0.variant==nil && $0.sourceIdleDeferred}
        resumeSourceEntryDeferredPlainStars()
        return sourceAnimationBindingAdmissionOpen && scope.current && sourceStarHaloScope === scope
    }
    private func resumeSourceEntryDeferredPlainStars(only:NativeDiceNode?=nil){
        if only==nil,sourcePlainStarWaitsForSharedIdle {resumeSourceEntryDeferredIdle();return}
        guard sourceAnimationBindingAdmissionOpen,!entryInProgress,let scope=sourceStarHaloScope,scope.current else{return}
        let captured=sourceEntryDeferredPlainStars.filter{only==nil || $0 === only};sourceEntryDeferredPlainStars.removeAll{only==nil || $0 === only}
        for node in captured {
            guard sourceAnimationBindingAdmissionOpen,scope.current,sourceStarHaloScope === scope,
                  nodesByID[node.tileID] === node,node.sourceRestoredWildConstructorCurrent,
                  node.kind=="wild",node.variant==nil else{continue}
            if node.sourceRestoreWildFacePending {sourceEntryDeferredPlainStars.append(node);continue}
            node.setSourceIdleDeferred(false)
            guard repairSourceWildSkin(tileID:node.tileID,scope:scope,startSourceIdle:{
                self.beginSourcePlainStarHalo(node,introBounce:false)
            }) else {onSourcePresentationFailure?("source_restored_star_idle_rejected",engine.state.generation);return}
        }
    }
    private struct SourceStarSheetPendingStart {
        weak var node:NativeDiceNode?
        let id:UUID,generation:UInt64
    }
    private var sourceStarSheetPendingStarts:[SourceStarSheetPendingStart]=[]
    private func flushSourcePlainStarSheetStarts(){
        guard sourceAnimationBindingAdmissionOpen,let scope=sourceStarHaloScope,scope.current else{return}
        let captured=sourceStarSheetPendingStarts;sourceStarSheetPendingStarts=[]
        for request in captured {
            guard sourceAnimationBindingAdmissionOpen,sourceStarHaloScope === scope,scope.current else{return}
            guard let node=request.node,nodesByID[node.tileID] === node,
                engine.state.generation==request.generation,node.sourcePlainStarSheetPendingID==request.id else{continue}
            let accepted=node.flushSourcePlainStarSheetStart(capturedID:request.id)
            guard sourceAnimationBindingAdmissionOpen,sourceStarHaloScope === scope,scope.current else{return}
            if !accepted {onSourcePresentationFailure?("source_star_sheet_resource_admission_rejected",request.generation);continue}
            if node.sourcePlainStarSheetPendingID==request.id {sourceStarSheetPendingStarts.append(request)}
        }
    }
    @discardableResult func beginSourcePlainStarHalo(_ node:NativeDiceNode,introBounce:Bool,force:Bool=false)->Bool {
        guard sourceAnimationBindingAdmissionOpen,let scope=sourceStarHaloScope,scope.current,
            let ticker=sourceStarHaloTicker,let layer=sourceStarHaloLayer,layer.parent === self,
            let tasks=scope.sourceMicrotaskTasks,let now=sourceStarPerformanceNow,
            nodesByID[node.tileID] === node,node.sourceGeneration==engine.state.generation else{return false}
        let generation=engine.state.generation
        if sourcePlainStarWaitsForSharedIdle,
            node.sourceRestoredWildConstructorCurrent || node.sourceOpenedWildConstructorCurrent {
            guard node.beginSourcePlainStarSheet(tasks:tasks,layer:layer,current:{[weak self,weak scope,weak node] in
                guard let self,let scope,let node else{return false}
                return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceStarHaloScope === scope &&
                    self.engine.state.generation==generation && self.nodesByID[node.tileID] === node
            },paintable:{[weak self] in self?.sourceShimmerCanvasPaintable == true}) else{return false}
            if let id=node.sourcePlainStarSheetPendingID,!sourceStarSheetPendingStarts.contains(where:{$0.id==id}) {
                sourceStarSheetPendingStarts.append(.init(node:node,id:id,generation:generation))
            }
        }
        // Tutorial keeps the authored Star face/sheet, without orbit resources.
        if engine.state.tutorial?.shouldLockHUD == true {
            node.retireSourceStarOrbit();return true
        }
        return node.beginSourcePlainStarHalo(service:scope.service,ticker:ticker,tasks:tasks,generation:generation,
            introBounce:introBounce,force:force,random:{scope.mathRandom.next()},performanceNow:now,
            current:{[weak self,weak scope,weak node] in
                guard let self,let scope,let node else{return false}
                return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceStarHaloScope === scope && self.engine.state.generation==generation && self.nodesByID[node.tileID] === node
            },paintable:{[weak self] in self?.gameplayRenderHost != nil},metrics:{[weak node] in node?.sourceStarOrbitMetrics ?? .zero},
            mount:{[weak self,weak node,weak layer] halo in
                guard let self,let node,let layer else{return false}
                halo.isHidden = self.engine.state.mode == .arcade
                return halo.mountAboveHUD(host:node.sourceStarOrbitHost,layer:layer,artworkZIndex:node.sourceStarArtworkZIndex)
            })
    }
    func retireSourcePlainStarHalos(scope:NativeGameplaySourceContext.Scope){
        guard sourceStarHaloScope === scope else{return}
        retireSourcePlainStarHalos()
    }
    func retireSourcePlainStarHalos(){
        sourceStarSheetPendingStarts=[]
        sourceEntryDeferredPlainStars.removeAll();sourcePlainStarWaitsForSharedIdle=false;sourceStarHaloScope=nil;sourceStarPerformanceNow=nil
        let ticker=sourceStarHaloTicker;sourceStarHaloTicker=nil;ticker?.dispose()
        nodesByID.values.forEach{$0.retireSourceStarHalo()}
        sourceStarHaloLayer?.removeFromParent();sourceStarHaloLayer=nil
    }
    var onStateChange: ((NativeBoardState) -> Void)?
    var onTerminal: ((NativeResolution) -> Void)?
    var onNativeNoMovesShow:((UInt64,UInt64)->Bool)?
    var onNativeNoMovesExit:((UInt64,@escaping()->Void)->Void)?
    var onNativeNoMovesClear:(()->Void)?
    private var nativeNoMovesReceipt:UInt64=0,nativeNoMovesCueReceipt:UInt64=0
    private var nativeNoMovesExitCapture:(generation:UInt64,receipt:UInt64)?
    func nativeNoMovesVisibleShow(generation:UInt64,receipt:UInt64){
        guard !disposed,!engine.stagedSourceNoMoves,engine.state.generation==generation,candidateSignature != nil,
            nativeNoMovesReceipt==receipt,nativeNoMovesCueReceipt != receipt else{return}
        nativeNoMovesCueReceipt=receipt;onGameplayEvent?(NativeGameplayEvent(.noMovesCandidate))
    }

    var onGameplayEvent: ((NativeGameplayEvent) -> Void)?
    var onGameplayReceipt: ((NativeGameplayEvent,NativeTile?,NativeTile?,UInt64) -> Void)?
    var onSpecialMoment: ((String?,String,Int) -> Void)?
    var onTntGlyphClock: ((String,TimeInterval,Bool) -> Void)?
    var onSplashGlyphClock: ((String,String,TimeInterval,Bool) -> Void)?
    var onHaptic: ((String) -> Void)?
    var onSpecialPresentationCancelled: ((String?) -> Void)?
    var authoredFinalePresentationReady: ((String) -> Bool)?
    var authoredTntPresentationReady: ((String) -> Bool)?
    var onAuthoredLaserImpact: (([NativeLaserVisualTarget],UInt64,@escaping (Int,String) -> Bool,@escaping () -> Void,@escaping () -> Void) -> Bool)?
    var onAuthoredTntPresentation: ((String,CGPoint,UInt64,@escaping () -> Void,@escaping () -> Void) -> Bool)?
    var onAuthoredFinale: ((String,CGPoint,UInt64,@escaping () -> Void) -> Bool)?
    var onExitRequest: (() -> Void)?
    var onHelpRequest: (() -> Void)?
    var onScoreRequest: (() -> Void)?
    var onComboRequest: (() -> Void)?
    var onPointerState: ((Bool) -> Void)?
    var onSourceGuidedSnapBack:((NativeDiceNode)->Void)?
    var onRenderingDemand: ((Bool) -> Void)?
    var onFrameCadence:((Int)->Void)?
    private func requestRendering(_ active:Bool){onRenderingDemand?(active)}
    var onFrameTarget:((Int)->Void)?
    var onRenderSurfacePreparation:(()->Void)?
    var onSpecialIdleSuspended:((Bool)->Void)?
    private let sourceFrames=NativeSourceFrameRuntime()
    private var sourceFramesAttached=false
    private let frameDiagnosticsEnabled=NativeDiagnosticsCapture.admitted(arguments:ProcessInfo.processInfo.arguments,bundleIdentifier:Bundle.main.bundleIdentifier,preferenceEnabled:UserDefaults.standard.bool(forKey:"cc.performanceDiagnostics"))
    func traceNoMovesHandoff(_ stage:String,token:UInt64=0,owner:AnyObject?=nil,mounted:Bool=false) {
        guard frameDiagnosticsEnabled else{return}
        let identity=owner.map{String(describing:ObjectIdentifier($0))} ?? "none"
        NSLog("[CC_NATIVE_NO_MOVES_HANDOFF] stage=%@ board=%d generation=%llu token=%llu owner=%@ mounted=%d exitInProgress=%d",stage,engine.state.board,engine.state.generation,token,identity,mounted,exitInProgress)
    }
    /// Event-only capture: reads stored model/node scalars, never Source admission hooks.
    private func traceSourceMagnetContact(_ stage:String,id:String,target:NativeCell?=nil,result:NativeMoveResult?=nil) {
        guard frameDiagnosticsEnabled else{return}
        let state=engine.state
        func describe(_ tileID:String)->String {
            let model=state.tiles.first{$0.id==tileID},node=nodesByID[tileID]
            let modelFlags=model.map{"value=\($0.value),kind=\($0.archetype?.rawValue ?? "regular"),variant=\($0.variant ?? "none"),locked=\($0.locked),removal=\($0.pendingRemoval),magnet=\($0.magnetOwned),resolution=\($0.resolutionOwned),cleared=\($0.sourceWildStateCleared),residual=\($0.sourceResidualWildPresence)"} ?? "missing"
            let nodeFlags=node.map{"value=\($0.value),kind=\($0.kind),variant=\($0.variant ?? "none"),event=\($0.sourceEventMode),mounted=\($0.parent === canvasRoot),generation=\($0.sourceGeneration),cleared=\($0.sourceWildStateCleared),residual=\($0.sourceResidualWildPresence)"} ?? "missing"
            return "id=\(tileID) model={\(modelFlags)} node={\(nodeFlags)}"
        }
        let destination=target.flatMap{state.tile(at:$0)}.map{describe($0.id)} ?? "none"
        let reasons=result.map{$0.events.compactMap{$0.reason}.joined(separator:",") + ";resolution=" + String(describing:$0.resolution.reason)} ?? "none"
        NSLog("[CC_NATIVE_MAGNET_CONTACT] stage=%@ board=%d generation=%llu revision=%llu accepted=%@ reason=%@ source=%@ target=%@ specialPending=%d lazyPending=%d",stage,state.board,state.generation,state.revision,result.map{String($0.accepted)} ?? "none",reasons,describe(id),destination,engine.pendingSpecial != nil,engine.pendingSourceMagnetLazyRespawn != nil)
    }
    private var diagnosticWindowStart:Double?,diagnosticLastFrame:Double?,diagnosticFrameCount=0
    private var diagnosticWorstGap=0.0,diagnosticElapsed=0.0
    private var diagnosticPreviousTarget:Int?
    private var diagnosticTime15=0.0,diagnosticTime30=0.0,diagnosticTime60=0.0,diagnosticActiveWorstGap=0.0
    private var diagnosticDrags=0,diagnosticMoves=0,diagnosticTouchSamples=0,diagnosticAnyDragging=false
    private var diagnosticMoveWorstMs=0.0,diagnosticUpdateWorstMs=0.0,diagnosticCadenceWorstMs=0.0,diagnosticIdleWorstMs=0.0,diagnosticHandoffWorstMs=0.0
    private var diagnosticDragRender=NativeSourceDragRenderDiagnostics()
    private var diagnosticLatestTouchMilliseconds:Double?
    // Scalars only: no retained UITouch/UIEvent, timer, or per-frame output.
    private struct DragInputProbe {
        var osTimestampMs:Double?,coalescedTimestampMs:Double?,paintedOSTimestampMs:Double?,paintedCoalescedTimestampMs:Double?,sceneTime:Double?
        var osSamples=0,coalescedSamples=0,coalescedEvents=0
        var callbackAgeWorst=0.0,paintAgeWorst=0.0,renderAgeWorst=0.0
        var coalescedCallbackAgeWorst=0.0,coalescedPaintAgeWorst=0.0,coalescedRenderAgeWorst=0.0
        var sceneGaps=0,sceneOver20=0,sceneOver30=0,sceneGapWorst=0.0
        var arrivalTime:Double?,phaseMinimum:Double?,phaseMaximum:Double?
        var arrivalGaps=0,arrivalOver20=0,arrivalOver30=0,arrivalGapWorst=0.0
        var positionChecks=0,positionMismatches=0,positionErrorWorst=0.0
        mutating func resetInterval(){
            osSamples=0;coalescedSamples=0;coalescedEvents=0
            callbackAgeWorst=0;paintAgeWorst=0;renderAgeWorst=0
            coalescedCallbackAgeWorst=0;coalescedPaintAgeWorst=0;coalescedRenderAgeWorst=0
            sceneGaps=0;sceneOver20=0;sceneOver30=0;sceneGapWorst=0
            arrivalGaps=0;arrivalOver20=0;arrivalOver30=0;arrivalGapWorst=0;phaseMinimum=nil;phaseMaximum=nil
            positionChecks=0;positionMismatches=0;positionErrorWorst=0
        }
    }
    private var diagnosticDragInput=DragInputProbe()
    private weak var diagnosticExpectedDragNode:NativeDiceNode?
    private var diagnosticExpectedDragPosition:CGPoint?
    private var diagnosticExpectedDragGeneration:UInt64?
    /// Read-only QA receipt; default-off callers do not observe nodes or clocks.
    func sourceDragInputDiagnosticSnapshot()->[String:Double] {
        guard frameDiagnosticsEnabled else{return [:]}
        let input=diagnosticDragInput
        return ["osSamples":Double(input.osSamples),"coalescedEvents":Double(input.coalescedEvents),
                "coalescedSamples":Double(input.coalescedSamples),
                "lastOSTimestampMs":input.osTimestampMs ?? -1,"lastCoalescedTimestampMs":input.coalescedTimestampMs ?? -1,
                "osCallbackAgeWorstMs":input.callbackAgeWorst,"osPaintAgeWorstMs":input.paintAgeWorst,"osRenderAgeWorstMs":input.renderAgeWorst,
                "coalescedCallbackAgeWorstMs":input.coalescedCallbackAgeWorst,"coalescedPaintAgeWorstMs":input.coalescedPaintAgeWorst,"coalescedRenderAgeWorstMs":input.coalescedRenderAgeWorst,
                "sceneGaps":Double(input.sceneGaps),"sceneOver20Ms":Double(input.sceneOver20),"sceneOver30Ms":Double(input.sceneOver30),
                "sceneGapWorstMs":input.sceneGapWorst,"heldPositionChecks":Double(input.positionChecks),
                "heldPositionMismatches":Double(input.positionMismatches),"heldPositionErrorWorstPoints":input.positionErrorWorst]
    }
    private var diagnosticLastLinkCreations=0
    private func resetDiagnosticFrameInterval() {
        diagnosticFrameCount=0;diagnosticElapsed=0;diagnosticWorstGap=0
        diagnosticTime15=0;diagnosticTime30=0;diagnosticTime60=0;diagnosticActiveWorstGap=0
        diagnosticDrags=0;diagnosticMoves=0;diagnosticTouchSamples=0;diagnosticAnyDragging=false
        diagnosticMoveWorstMs=0;diagnosticUpdateWorstMs=0;diagnosticCadenceWorstMs=0;diagnosticIdleWorstMs=0;diagnosticHandoffWorstMs=0
        diagnosticDragRender.resetInterval()
        if frameDiagnosticsEnabled {diagnosticDragInput.resetInterval()}
    }
    private func recordDiagnosticFrame(nowMs:Double,configuredFPS:Double) {
        guard frameDiagnosticsEnabled else{return}
        defer {diagnosticLastFrame=nowMs;diagnosticPreviousTarget=Int(configuredFPS)}
        guard let previous=diagnosticLastFrame,let start=diagnosticWindowStart else {
            diagnosticWindowStart=nowMs;return
        }
        let gap=max(0,nowMs-previous)
        switch diagnosticPreviousTarget {
        case 15:diagnosticTime15+=gap
        case 30:diagnosticTime30+=gap
        case 60:diagnosticTime60+=gap;diagnosticActiveWorstGap=max(diagnosticActiveWorstGap,gap)
        default:break
        }
        diagnosticAnyDragging = diagnosticAnyDragging || draggedID != nil
        diagnosticFrameCount+=1;diagnosticElapsed+=gap;diagnosticWorstGap=max(diagnosticWorstGap,gap)
        guard nowMs-start>=1000 else{return}
        // Existing Scene callback cadence, not proof of GPU-presented FPS.
        let state=sourceFrames.snapshot,labels=sourceFrames.cadence.diagnosticLeaseLabels
        if let service=sourceStackFrameService {
            let source=service.takeSchedulingDiagnostics(),drag=diagnosticDragRender
            let reads=sourcePhysicalReadDiagnostics,links=service.displayLinkCreationCount
            NSLog("[CC_NATIVE_HITCH_WORK] board=%d generation=%llu linkCreationsTotal=%d linkCreationsInterval=%d dragTransportReceipts=%d boardCaptures=%d boardRevalidations=%d tileObservationReads=%d observerCreations=%d",engine.state.board,engine.state.generation,links,max(0,links-diagnosticLastLinkCreations),service.directManipulationTransportCount,reads.boardCaptures,reads.boardRevalidations,reads.tileObservationReads,reads.observerCreations)
            diagnosticLastLinkCreations=links;resetSourcePhysicalReadDiagnostics()
            NSLog("[CC_NATIVE_FRAME_COST] board=%d generation=%llu deliveryMs=%.2f rootsMs=%.2f rootCleanupMs=%.2f rafMs=%.2f tickerMs=%.2f rawMs=%.2f fifoValidationMs=%.2f fifoReactionsMs=%.2f fifoCompactMs=%.2f otherMs=%.2f rootVisits=%d fifoJobs=%d reactionOwner=%@ reactionWorstMs=%.2f",engine.state.board,engine.state.generation,source.worstDeliveryMilliseconds,source.worstFrameRootTotalMilliseconds,source.worstFrameRootCleanupMilliseconds,source.worstFrameRAFTotalMilliseconds,source.worstFrameTickerTotalMilliseconds,source.worstFrameRawTotalMilliseconds,source.worstFrameFIFOValidationMilliseconds,source.worstFrameFIFOReactionMilliseconds,source.worstFrameFIFOCompactMilliseconds,source.worstFrameOtherMilliseconds,source.worstFrameRootCount,source.worstFrameFIFOJobCount,source.slowestReactionOwner,source.slowestReactionMilliseconds)
            NSLog("[CC_NATIVE_FRAME_OWNER] board=%d generation=%llu slowestOwner=%@ phase=%@ ownerWorstMs=%.2f rootWorstMs=%.2f rafWorstMs=%.2f tickerWorstMs=%.2f rawWorstMs=%.2f microtaskWorstMs=%.2f layerCommitWorstMs=%.2f rootHighWater=%d rawHighWater=%d rafHighWater=%d tickerHighWater=%d renderDemandHighWater=%d",engine.state.board,engine.state.generation,source.slowestParticipantOwner,source.slowestParticipantPhase,source.slowestParticipantMilliseconds,source.worstRootMilliseconds,source.worstRAFMilliseconds,source.worstTickerListenerMilliseconds,source.worstRawMilliseconds,source.worstMicrotaskMilliseconds,source.worstLayerCommitMilliseconds,source.rootHighWater,source.rawHighWater,source.rafHighWater,source.tickerListenerHighWater,source.renderDemandHighWater)
            NSLog("[CC_NATIVE_SCHEDULING] board=%d generation=%llu sourceDeliveries=%d sourceWorstGapMs=%.2f sourceDeliveryWorstMs=%.2f sourceDeadlineLateWorstMs=%.2f dragRendersWithoutPaint=%d dragRendersOnePaint=%d dragRendersMultiplePaints=%d dragPaintAgeWorstMs=%.2f queuedTouchAgeWorstMs=%.2f",engine.state.board,engine.state.generation,source.deliveries,source.worstGapMilliseconds,source.worstDeliveryMilliseconds,source.worstDeadlineLateMilliseconds,drag.rendersWithoutPaint,drag.rendersOnePaint,drag.rendersMultiplePaints,drag.worstPaintAgeMilliseconds,drag.worstQueuedTouchAgeMilliseconds)
        }
        NSLog("[CC_NATIVE_FRAME] board=%d generation=%llu callbacks=%d elapsedMs=%.1f worstGapMs=%.1f target=%.0f dragging=%d time15Ms=%.1f time30Ms=%.1f time60Ms=%.1f active60WorstGapMs=%.1f acceptedDrags=%d touchSamples=%d movePaints=%d anyDragging=%d activityCount=%d settledCount=%d activityLabels=%@ settledLabels=%@ moveCallbackWorstMs=%.2f updateCallbackWorstMs=%.2f cadenceStageWorstMs=%.2f idleStageWorstMs=%.2f handoffCallbackWorstMs=%.2f",engine.state.board,engine.state.generation,diagnosticFrameCount,diagnosticElapsed,diagnosticWorstGap,configuredFPS,draggedID == nil ? 0:1,diagnosticTime15,diagnosticTime30,diagnosticTime60,diagnosticActiveWorstGap,diagnosticDrags,diagnosticTouchSamples,diagnosticMoves,diagnosticAnyDragging ? 1:0,state.activityLeaseCount,state.settledMotionLeaseCount,labels.activity,labels.settled,diagnosticMoveWorstMs,diagnosticUpdateWorstMs,diagnosticCadenceWorstMs,diagnosticIdleWorstMs,diagnosticHandoffWorstMs)
        let input=diagnosticDragInput
        NSLog("[CC_NATIVE_DRAG_PHASE] board=%d generation=%llu arrivalGaps=%d arrivalOver20Ms=%d arrivalOver30Ms=%d arrivalGapWorstMs=%.2f phaseMinMs=%.2f phaseMaxMs=%.2f",engine.state.board,engine.state.generation,input.arrivalGaps,input.arrivalOver20,input.arrivalOver30,input.arrivalGapWorst,input.phaseMinimum ?? 0,input.phaseMaximum ?? 0)
        NSLog("[CC_NATIVE_DRAG_INPUT] board=%d generation=%llu osSamples=%d coalescedEvents=%d coalescedSamples=%d lastOSTimestampMs=%.2f lastCoalescedTimestampMs=%.2f osCallbackAgeWorstMs=%.2f osPaintAgeWorstMs=%.2f osRenderAgeWorstMs=%.2f coalescedCallbackAgeWorstMs=%.2f coalescedPaintAgeWorstMs=%.2f coalescedRenderAgeWorstMs=%.2f sceneGaps=%d sceneOver20Ms=%d sceneOver30Ms=%d sceneGapWorstMs=%.2f heldPositionChecks=%d heldPositionMismatches=%d heldPositionErrorWorstPoints=%.4f",engine.state.board,engine.state.generation,input.osSamples,input.coalescedEvents,input.coalescedSamples,input.osTimestampMs ?? -1,input.coalescedTimestampMs ?? -1,input.callbackAgeWorst,input.paintAgeWorst,input.renderAgeWorst,input.coalescedCallbackAgeWorst,input.coalescedPaintAgeWorst,input.coalescedRenderAgeWorst,input.sceneGaps,input.sceneOver20,input.sceneOver30,input.sceneGapWorst,input.positionChecks,input.positionMismatches,input.positionErrorWorst)
        diagnosticWindowStart=nowMs;resetDiagnosticFrameInterval()
    }

    private var sourcePopIn:NativeSourceFrameRuntime.Capture?
    private var sourcePreparedEntry:NativeSourceFrameRuntime.Capture?
    private var sourceExit:NativeSourceFrameRuntime.Capture?
    private var sourceHUDExit:NativeSourceFrameRuntime.Capture?
    private var sourceStars:NativeSourceFrameRuntime.Capture?
    private var sourceGameplay:[NativeSourceFrameRuntime.Key:NativeSourceFrameRuntime.Capture]=[:]
    private var sourcePopulation:Set<String>=[]
    private struct SourceSpawnScope {
        let tileID:String,actionKey:String,id:String,release:()->Void
        let interrupted:(()->Void)?
    }
    private var sourceSpawns:[String:SourceSpawnScope]=[:]
    private struct SourceOrdinaryOpenBounce {
        let id:String,node:NativeDiceNode,owner:NativeSourceAppSpawnBounceOwner
    }
    private var sourceOrdinaryOpenBounces:[String:SourceOrdinaryOpenBounce]=[:]
    private var sourceWildOpenBounces:[String:SourceOrdinaryOpenBounce]=[:]
    private var sourceWildLockedFaceActionIDs:Set<String>=[]
    private var sourceWildPrimaryFaceActionIDs:Set<String>=[]
    private var sourceWildHardPrimaryFaceActionIDs:Set<String>=[]
    private var sourceWildPublishedBounceActionIDs:Set<String>=[]
    private var sourceWildBonusPops:[String:NativeSourceLockedBonusPopOwner]=[:]
    var sourceWildBonusPopCount:Int{sourceWildBonusPops.count}
    private(set) var sourceWildPromiseArrivalEnqueuedCount=0
    private(set) var sourceWildPromiseArrivalDeliveredCount=0
    private var sourceWildCoroutineResumes:[String:UInt64]=[:]
    private var sourceDirectLockedBonusGuardResumes:[UUID:NativeSourceDirectLockedBonusGuardReceipt]=[:]
    private(set) var sourceDirectLockedBonusGuardAwaitDeliveredCount=0
    private(set) var sourceWildCoroutineResumeDeliveredCount=0
    private(set) var sourceWildCoroutineFinallyDeliveredCount=0
    private var sourceWildCoroutineFinallys:[String:UInt64]=[:]
    private var sourceWildSpawnClaims:[String:NativeSourceMergeSixSpawnOwner.Claim]=[:]
    private(set) var sourceWildSpawnOwnerBeginCount=0
    private(set) var sourceWildSpawnOwnerResetCount=0
    private var sourceDirectRetainedDestinations:[String:(NativeGameplayEngine.SourceRetainedDirectDestination,NativeDiceNode,UInt64,NativeWildMeterDropRuntime.SourceTileMarkers?)]=[:]
    private var sourceWildConstructorNodes:[String:NativeDiceNode]=[:]
    private var sourceWildConstructorBatch:NativeSourceAnimationClockService.SourceFrameLease?
    private var sourceWildConstructorEpoch:UInt64=0
    var sourceWildOpenBounceCount:Int {sourceWildOpenBounces.count}
    var sourceOrdinaryOpenBounceCount:Int {sourceOrdinaryOpenBounces.count}
    var sourceOrdinaryOpenBounceTileIDs:[String] {sourceOrdinaryOpenBounces.keys.sorted()}
    var sourceWrappedSpawnCount:Int {sourceSpawns.count}
    var sourceFrameSnapshot:NativeBoardFrameCadence.Snapshot {sourceFrames.snapshot}
    var sourceFrameBudget:NativeBoardFrameBudget.Snapshot {sourceFrames.budget.snapshot}
    private var sourceIdleScope:NativeGameplaySourceContext.Scope?
    private var sourceIdleGeneration:UInt64?
    private var sourceIdleWasScoped=false
    // Source resumes the captured restore list in order, never hash iteration.
    private var sourceEntryDeferredVariants:[NativeDiceNode]=[]
    private var sourceEntryDeferredBee:[NativeDiceNode]=[]
    private(set) var sourceRestoredWildSkinsConfigured=false
    var sourceSpecialIdleAdmissionOpen:Bool {
        guard sourceAnimationBindingAdmissionOpen,let scope=sourceIdleScope,scope.current,
            sourceIdleGeneration==engine.state.generation,scope.specialIdle.admissionOpen else{return false}
        return sourceAnimationBindingAdmissionOpen && sourceIdleScope === scope && scope.current && sourceIdleGeneration==engine.state.generation
    }
    @discardableResult func configureSourceSpecialIdle(scope:NativeGameplaySourceContext.Scope)->Bool {
        guard sourceAnimationBindingAdmissionOpen,scope.current,scope.specialIdle.admissionOpen,sourceIdleScope==nil,
            sourceOuterTimelineDriver === scope.timeline,sourceDragTweenDriver === scope.tween else{return false}
        sourceIdleScope=scope;sourceIdleGeneration=engine.state.generation;sourceIdleWasScoped=true
        scope.specialIdle.onStateChange={[weak self,weak scope] snapshot in
            guard let self,let scope,self.sourceSpecialIdleAdmissionOpen,self.sourceIdleScope === scope else{return}
            self.sourceCallbackTime();self.sourceFrames.setRegistrySuspended(snapshot.suspended)
            self.refreshSourceIdlePopulation()
            self.flushSourcePlainStarSheetStarts()
            self.onSpecialIdleSuspended?(snapshot.suspended || self.sourceFrames.isSpecialIdleSuspended)
        }
        for node in engine.state.tiles.compactMap({nodesByID[$0.id]}) {
            let startupVariant=sourceMicrotaskInstallation != nil && (node.variant=="bottle" || node.variant=="honey" || node.variant=="cubero" || node.kind=="wild-tnt" && node.variant==nil) && (!node.sourceIdleDeferred || node.sourceRestoredWildConstructorCurrent)
            if startupVariant {
                node.setSourceIdleDeferred(true)
                sourceEntryDeferredVariants.append(node)
            }
            let startupBee=sourceMicrotaskInstallation != nil && node.kind=="wild" && node.variant=="bee" && (!node.sourceIdleDeferred || node.sourceRestoredWildConstructorCurrent)
            if startupBee,(entryInProgress || node.sourceRestoreWildFacePending) {
                // Defer before registering: no transient idle start can capture
                // the entrance pose as its rest transform.
                node.setSourceIdleDeferred(true)
                sourceEntryDeferredBee.append(node)
            } else if startupBee,node.sourceRestoredWildConstructorCurrent,node.sourceIdleDeferred {
                node.setSourceIdleDeferred(false)
            }
            guard sourceSpecialIdleAdmissionOpen,node.configureSourceSpecialIdle(scope.specialIdle) else{retireSourceSpecialIdleBindings();return false}
            // Deferred meter nodes still wait for their genuine landed receipt.
            if startupBee {
                guard repairSourceWildSkin(tileID:node.tileID,scope:scope,startSourceIdle:{
                    self.prepareSourceBeeIdleFrames(tileID:node.tileID,scope:scope,completion:{[weak self,weak node,weak scope] ready in
                        guard let self,let node,let scope,self.sourceSpecialIdleAdmissionOpen,
                              self.sourceIdleScope === scope,self.nodesByID[node.tileID] === node else{return}
                        if !ready {self.onSourcePresentationFailure?("source_startup_bee_frames_rejected",self.engine.state.generation)}
                        self.onRenderingDemand?(!self.suspended)
                    })
                }),sourceSpecialIdleAdmissionOpen else {retireSourceSpecialIdleBindings();return false}
            }
        }
        guard sourceSpecialIdleAdmissionOpen else{retireSourceSpecialIdleBindings();return false}
        resumeSourceEntryDeferredVariantIdle()
        refreshSourceIdlePopulation();return true
    }
    /// One captured row-major resume order, independent of per-family resource
    /// completion. An earlier unfinished constructor cannot be overtaken.
    private func resumeSourceEntryDeferredIdle() {
        guard !entryInProgress,!sourceDeferredIdleResumeActive else{return}
        sourceDeferredIdleResumeActive=true;defer{sourceDeferredIdleResumeActive=false}
        guard sourceSpecialIdleAdmissionOpen,let scope=sourceIdleScope else {
            if !sourcePlainStarWaitsForSharedIdle {resumeSourceEntryDeferredPlainStars()};return
        }
        guard !sourceEntryDeferredPlainStars.isEmpty || !sourceEntryDeferredVariants.isEmpty || !sourceEntryDeferredBee.isEmpty else{return}
        let needsSharedAssetTask=sourceEntryDeferredVariants.contains(where:{$0.variant=="honey"}) ||
            sourcePlainStarWaitsForSharedIdle && !sourceEntryDeferredPlainStars.isEmpty
        if needsSharedAssetTask,scope.sourceMicrotaskTasks?.fifo.isAcceptingJobs != true {return}
        let captured=engine.state.tiles.sorted {
            $0.cell.row==$1.cell.row ? $0.cell.column<$1.cell.column:$0.cell.row<$1.cell.row
        }.compactMap{nodesByID[$0.id]}
        for node in captured {
            guard sourceSpecialIdleAdmissionOpen,sourceIdleScope === scope else{return}
            let plain=sourceEntryDeferredPlainStars.contains{$0 === node}
            let variant=sourceEntryDeferredVariants.contains{$0 === node}
            let bee=sourceEntryDeferredBee.contains{$0 === node}
            guard plain || variant || bee else{continue}
            guard node.sourceContactNodeAlive,node.parent != nil else{
                sourceEntryDeferredPlainStars.removeAll{$0 === node};sourceEntryDeferredVariants.removeAll{$0 === node};sourceEntryDeferredBee.removeAll{$0 === node};continue
            }
            if node.sourceRestoreWildFacePending {return}
            // Each callback is isolated like original forEach/try-catch. A
            // refused feature may report failure without skipping later slots.
            if plain {resumeSourceEntryDeferredPlainStars(only:node)}
            else if variant {resumeSourceEntryDeferredVariantIdle(only:node)}
            else {resumeSourceEntryDeferredBee(only:node)}
        }
    }
    private func resumeSourceEntryDeferredBee(only:NativeDiceNode) {
        guard sourceSpecialIdleAdmissionOpen,let scope=sourceIdleScope,!entryInProgress else{return}
        let captured=sourceEntryDeferredBee.filter{$0 === only};sourceEntryDeferredBee.removeAll{$0 === only}
        for node in captured {
            let id=node.tileID
            guard sourceSpecialIdleAdmissionOpen,nodesByID[id] === node,node.sourceGeneration==engine.state.generation,
                  node.kind=="wild",node.variant=="bee" else{continue}
            if node.sourceRestoreWildFacePending {sourceEntryDeferredBee.append(node);continue}
            node.setSourceIdleDeferred(false)
            guard repairSourceWildSkin(tileID:id,scope:scope,startSourceIdle:{
                self.prepareSourceBeeIdleFrames(tileID:id,scope:scope,completion:{[weak self,weak node,weak scope] ready in
                    guard let self,let node,let scope,self.sourceSpecialIdleAdmissionOpen,
                          self.sourceIdleScope === scope,self.nodesByID[id] === node else{return}
                    if !ready {self.onSourcePresentationFailure?("source_entry_bee_frames_rejected",self.engine.state.generation)}
                    self.onRenderingDemand?(!self.suspended)
                })
            }) else {onSourcePresentationFailure?("source_entry_bee_resume_rejected",engine.state.generation);return}
        }
    }
    private func resumeSourceEntryDeferredVariantIdle(only:NativeDiceNode?=nil){
        if only==nil {resumeSourceEntryDeferredIdle();return}
        guard sourceSpecialIdleAdmissionOpen,let scope=sourceIdleScope,!entryInProgress else{return}
        // A mixed restore list preserves its original tile order. No invented
        // input/asset task may activate Honey outside the actual caller boundary.
        if sourceEntryDeferredVariants.contains(where:{$0.variant=="honey"}),scope.sourceMicrotaskTasks?.fifo.isAcceptingJobs != true {return}
        let captured=sourceEntryDeferredVariants.filter{only==nil || $0 === only};sourceEntryDeferredVariants.removeAll{only==nil || $0 === only}
        for node in captured {
            guard sourceSpecialIdleAdmissionOpen,nodesByID[node.tileID] === node,
                  node.sourceGeneration==engine.state.generation,node.variant=="bottle" || node.variant=="honey" || node.variant=="cubero" || node.kind=="wild-tnt" && node.variant==nil else{continue}
            let variant=node.variant
            if node.sourceRestoreWildFacePending {sourceEntryDeferredVariants.append(node);continue}
            node.setSourceIdleDeferred(false,preserveSourceBottleBase:variant=="bottle",preserveSourceHoneyIdle:variant=="honey")
            let current:()->Bool = {[weak self,weak node,weak scope] in
                guard let self,let node,let scope else{return false}
                return self.sourceSpecialIdleAdmissionOpen && self.sourceIdleScope === scope &&
                    scope.current && self.nodesByID[node.tileID] === node &&
                    node.sourceGeneration==self.engine.state.generation && node.variant==variant
            }
            guard repairSourceWildSkin(tileID:node.tileID,scope:scope,startSourceIdle:{
                if variant==nil || variant=="cubero" {return node.configureSourceSpecialIdle(scope.specialIdle)}
                if variant=="honey" {
                    guard let tasks=scope.sourceMicrotaskTasks else{return false}
                    return node.beginSourceHoneyIdle(service:scope.service,scope:scope.specialIdle,assetTasks:tasks,
                        use2x:UIScreen.main.scale>1.5,current:current,
                        paintable:{[weak self] in self?.sourceFizzCanvasPaintable==true})
                }
                return node.beginSourceBottleIdle(service:scope.service,scope:scope.specialIdle,current:current,
                    paintable:{[weak self] in self?.sourceFizzCanvasPaintable==true})
            },currentSourceFaceAnchor:{[weak node] in
                guard let node,node.hasSourceBottleIdle else{return nil}
                return .init(x:node.sourceBaseAnchorX,y:1-node.sourceBaseAnchorY)
            }) else{onSourcePresentationFailure?("source_entry_variant_idle_rejected",engine.state.generation);return}
        }
    }
    /// Genuine constructor face completion can arrive after an interrupted
    /// entry/foreground. Reuse the same captured entry-deferred owner; no timer.
    func sourceRestoredWildFaceSettled(_ node:NativeDiceNode) {
        guard sourceAnimationBindingAdmissionOpen,nodesByID[node.tileID] === node,
              node.sourceRestoredWildConstructorCurrent,!node.sourceRestoreWildFacePending else{return}
        resumeSourceEntryDeferredIdle()
    }
    /// Static APP skin is a separate caller from board.setValue's raw face RAF.
    /// This does not admit the remaining exact non-Bee Source idle composers.
    @discardableResult func configureSourceRestoredWildSkins(scope:NativeGameplaySourceContext.Scope)->Bool {
        guard sourceAnimationBindingAdmissionOpen,scope.current,sourceMicrotaskBoundariesInstalled,
              sourceOuterTimelineDriver === scope.timeline,!sourceRestoredWildSkinsConfigured else{return false}
        let restored=engine.state.tiles.compactMap{nodesByID[$0.id]}.filter{$0.sourceRestoredWildConstructorCurrent}
        for node in restored {
            guard node.sourceIdleDeferred,
                  repairSourceWildSkin(tileID:node.tileID,scope:scope,startSourceIdle:{false}),
                  sourceAnimationBindingAdmissionOpen,scope.current else{return false}
        }
        sourceRestoredWildSkinsConfigured=true
        return true
    }
    func acquireSourceSpecialIdle(reason:String)->(()->Void)? {
        guard sourceSpecialIdleAdmissionOpen,let scope=sourceIdleScope else{return nil}
        let captured=scope.specialIdle.acquire(reason:reason)
        guard sourceSpecialIdleAdmissionOpen,sourceIdleScope === scope else{captured?();return nil}
        return captured
    }
    private func refreshSourceIdlePopulation(){
        if let scope=sourceIdleScope,sourceSpecialIdleAdmissionOpen {
            sourceFrames.registerPopulation(Set(scope.specialIdle.registeredKeys.compactMap{($0 as? NativeDiceNode)?.tileID}))
        } else {sourceFrames.registerPopulation(sourceIdleWasScoped ? []:sourcePopulation)}
    }
    private func retireSourceSpecialIdleBindings(){
        guard let captured=sourceIdleScope else{return}
        sourceIdleScope=nil;sourceIdleGeneration=nil;sourceEntryDeferredVariants.removeAll();sourceEntryDeferredBee.removeAll();captured.specialIdle.onStateChange=nil
        for node in Array(nodesByID.values){node.retireSourceSpecialIdleBinding(captured.specialIdle)}
        sourceCallbackTime();sourceFrames.setRegistrySuspended(false);refreshSourceIdlePopulation()
    }
    private func sourceCallbackTime() {sourceFrames.receiveCallbackTime(CACurrentMediaTime()*1000)}
    /// Caller is an actual authored owner, never a generic visual counter.
    func beginSourceMotion(_ kind:NativeSourceFrameRuntime.Kind,id:String,generation:UInt64)->(() -> Void)? {
        guard !sourceDisposalInProgress else {return nil}
        guard !disposed,engine.state.generation==generation else{return nil}
        sourceCallbackTime()
        let capture=sourceFrames.begin(.init(kind:kind,generation:generation,id:id))
        return { [weak self] in guard let self else{return};self.sourceCallbackTime();self.sourceFrames.end(capture) }
    }
    /// Initial/retry committed surface wrapper; Continue owns only pop-in.
    func prepareSourceBoardEntry() {
        guard !sourceDisposalInProgress else {return}
        guard !disposed,sourcePreparedEntry==nil else{return}
        sourceCallbackTime();sourcePreparedEntry=sourceFrames.begin(.init(kind:.boardEntry,generation:engine.state.generation,id:UUID().uuidString))
        if !entryInProgress {finishSourceEntry()}
    }
    private func finishSourceEntry() {
        sourceCallbackTime()
        if let capture=sourcePopIn {sourcePopIn=nil;sourceFrames.end(capture)}
        if let capture=sourcePreparedEntry {sourcePreparedEntry=nil;sourceFrames.end(capture)}
    }
    /// Exact accepted handoff begin/release observer for the separate endgame
    /// Date ledger. No Date value or meter-ledger write is manufactured here.
    var onSourceRegularHandoffMutation:((NativeSourceRegularHandoffMutationReceipt,NativeSourceRegularHandoffMutationReceipt.Phase)->Void)?
    var sourceEndgameMutationLedgerEnabled=false
    private var sourceEndgameMutationBinding:NativeSourceEndgameMutationLedger.Binding?
    private weak var sourceEndgameMutationScope:NativeGameplaySourceContext.Scope?
    var sourceEndgameMutationLedgerAdmissionOpen:Bool {sourceAnimationBindingAdmissionOpen && sourceEndgameMutationScope?.current==true && sourceEndgameMutationBinding?.retired==false}
    private var sourceEndgameMutationEpoch:UInt64=0
    @discardableResult func configureSourceEndgameMutationLedger(scope:NativeGameplaySourceContext.Scope)->Bool {
        guard sourceAnimationBindingAdmissionOpen,sourceEndgameMutationLedgerEnabled,scope.current,
            sourceSameNodeStackAbsorbsEnabled,sourceOuterTimelineDriver === scope.timeline,sourceDragTweenDriver === scope.tween,
            sourceEndgameMutationBinding==nil,onSourceRegularHandoffMutation==nil,
            !sourceGameplay.keys.contains(where:{$0.kind == .regularMergeHandoff}) else{return false}
        let generation=engine.state.generation,epoch=sourceEndgameMutationEpoch
        let seal:()->Bool = {[weak self,weak scope] in
            guard let self,let scope else{return false}
            return self.sourceAnimationBindingAdmissionOpen && self.sourceEndgameMutationLedgerEnabled && scope.current &&
                self.engine.state.generation==generation && self.sourceEndgameMutationEpoch==epoch &&
                self.sourceOuterTimelineDriver === scope.timeline && self.sourceDragTweenDriver === scope.tween
        }
        guard let binding=scope.bindEndgameMutations(current:seal) else{return false}
        guard seal(),sourceEndgameMutationBinding==nil,onSourceRegularHandoffMutation==nil else{scope.retireEndgameMutations(binding);return false}
        sourceEndgameMutationScope=scope;sourceEndgameMutationBinding=binding
        onSourceRegularHandoffMutation={[weak self,weak binding] receipt,phase in
            guard let self,let binding,seal(),self.sourceEndgameMutationBinding === binding,receipt.generation==generation else{return}
            _=binding.handoff(receipt,phase:phase)
        }
        return true
    }
    /// Default-off selected token begin. This does not advertise actual Source
    /// coroutine-finally, signature, repair or full input/save capability.
    struct SourceOrdinarySpawnCompanions {
        let releaseSpecialTransaction:()->Void
        let queueWildAfterGuardRelease:()->Void
    }
    var sourceOrdinarySixSpawnOwnerEnabled=false
    private(set) var sourceOrdinarySpawnOwnerBeginCount=0
    private(set) var sourceOrdinaryMinimumFinallyDeliveredCount=0
    private var sourceOrdinarySixSpawnScope:NativeGameplaySourceContext.Scope?
    private var sourceOrdinarySixSpawnResets:((String,UInt64)->SourceOrdinarySpawnCompanions?)?
    private var sourceOrdinarySixSpawnClaims:[String:NativeSourceMergeSixSpawnOwner.Claim]=[:]
    @discardableResult func configureSourceOrdinarySixSpawnOwner(scope:NativeGameplaySourceContext.Scope,
        resets:@escaping(String,UInt64)->SourceOrdinarySpawnCompanions?)->Bool {
        guard sourceAnimationBindingAdmissionOpen,sourceOrdinarySixSpawnOwnerEnabled,
            sourceOrdinarySixSameNodeEnabled,scope.current,sourceSixScope === scope,
            sourceEndgameMutationScope === scope,sourceEndgameMutationLedgerAdmissionOpen,
            sourceOrdinarySixSpawnScope==nil,sourceOrdinarySixSpawnResets==nil,
            sourceDragTweenDriver === scope.tween,sourceOuterTimelineDriver === scope.timeline,
            engine.stagedOrdinaryMoves,engine.stagedOrdinaryAssignments,
            !engine.sourceOrdinarySixSpawnBeginReceiptsEnabled,
            engine.pendingOrdinarySix==nil else{return false}
        sourceOrdinarySixSpawnScope=scope;sourceOrdinarySixSpawnResets=resets
        engine.sourceOrdinarySixSpawnBeginReceiptsEnabled=true;return true
    }
    private func acceptSourceOrdinarySixSpawnBegin(event:NativeGameplayEvent,generation:UInt64)->Bool {
        guard sourceAnimationBindingAdmissionOpen,sourceOrdinarySixSpawnOwnerEnabled,
            let scope=sourceOrdinarySixSpawnScope,scope.current,sourceSixScope === scope,
            sourceEndgameMutationScope === scope,let binding=sourceEndgameMutationBinding,
            let factory=sourceOrdinarySixSpawnResets,engine.state.generation==generation,
            let receipt=engine.pendingSourceOrdinarySixSpawnBeginReceipts.first(where:{$0.id.uuidString==event.reason}),
            receipt.generation==generation,sourceOrdinarySixSpawnClaims[receipt.ownerID]==nil else{return false}
        let epoch=sourceEndgameMutationEpoch
        let current:()->Bool = {[weak self,weak scope,weak binding] in
            guard let self,let scope,let binding else{return false}
            return self.sourceAnimationBindingAdmissionOpen && self.sourceOrdinarySixSpawnOwnerEnabled && scope.current &&
                self.sourceOrdinarySixSpawnScope === scope && self.sourceSixScope === scope &&
                self.sourceEndgameMutationScope === scope && self.sourceEndgameMutationBinding === binding &&
                self.sourceEndgameMutationEpoch==epoch && self.engine.state.generation==generation &&
                self.engine.sourceOrdinarySixSpawnBeginReceiptsEnabled && self.engine.sourceOrdinarySixSpawnBeginIsCurrent(receipt)
        }
        let external=factory(receipt.ownerID,generation)
        guard let external,current() else{return false}
        // The actual captured frame/idle lease was installed at contact. The
        // callback argument cannot replace that Scene-owned real companion.
        let companions=NativeSourceMergeSixSpawnOwner.ResetBindings(endResolutionFrames:{[weak self] in
            self?.finishSourceGameplay(.mergeSixResolution,id:receipt.ownerID,generation:generation)
        },releaseSpecialTransaction:external.releaseSpecialTransaction,
            queueWildAfterGuardRelease:external.queueWildAfterGuardRelease)
        guard let claim=binding.beginSpawn(receipt,service:scope.service,resets:companions,current:current),current(),
            sourceOrdinarySixSpawnClaims[receipt.ownerID]==nil else{return false}
        guard engine.acknowledgeSourceOrdinarySixSpawnBegin(receipt) else{return false}
        sourceOrdinarySixSpawnClaims[receipt.ownerID]=claim
        sourceOrdinarySpawnOwnerBeginCount+=1
        return true
    }
    /// Explicit captured Source coroutine finally endpoint. It is intentionally
    /// NOT called by Native releaseOrdinarySixIfReady/primary/visual completion.
    /// Normal minimum producer uses the captured FIFO; endgame producer and
    /// whole startup/physical admission remain OPEN.
    @discardableResult func sourceOrdinarySixSpawnCoroutineFinally(ownerID:String,generation:UInt64)->Bool {
        guard sourceAnimationBindingAdmissionOpen,sourceOrdinarySixSpawnOwnerEnabled,
            engine.state.generation==generation,let scope=sourceOrdinarySixSpawnScope,scope.current,
            sourceEndgameMutationScope === scope,let binding=sourceEndgameMutationBinding,
            let claim=sourceOrdinarySixSpawnClaims[ownerID],claim.generation==generation else{return false}
        sourceOrdinarySixSpawnClaims.removeValue(forKey:ownerID)
        let reset=binding.resetSpawn(claim)
        if reset {
            sourceOrdinaryMinimumFinallyDeliveredCount+=1
            if engine.state.generation==generation,sourceOrdinarySixSpawnScope === scope,scope.current {releaseOrdinarySixIfReady()}
        }
        return reset
    }
    private func retireSourceOrdinarySixSpawnOwner() {
        retireSourceSpawnVisualSafety()
        engine.sourceOrdinaryFreshConstructorEnabled=false;engine.sourceOrdinaryFreshConstructor=nil;engine.sourceOrdinaryFreshConstructorCurrent=nil
        engine.sourceOrdinaryEndgameCoroutineEnabled=false;engine.sourceOrdinaryPhysicalFinalSnapshotEnabled=false;engine.sourceOrdinaryHardPrimaryPublish=nil
        sourceOrdinaryPreconstructedIDs=[]
        let frames=sourceOrdinaryConstructorFrames;sourceOrdinaryConstructorFrames=[:];frames.values.forEach{$0.cancel()}
        let generation=engine.state.generation
        sourceOrdinarySixSpawnScope=nil;sourceOrdinarySixSpawnResets=nil;sourceOrdinarySixSpawnClaims=[:]
        sourceOrdinaryMinimumScope=nil;sourceOrdinaryMinimumOpacitySweep=nil;engine.sourceOrdinaryMinimumPhaseEnabled=false
        if let own=sourceOwnedOrdinaryMinimumTileAuthority,engine.sourceOrdinaryMinimumTileAuthority === own {
            engine.sourceOrdinaryMinimumTileAuthority=nil
        }
        if let own=sourceOwnedOrdinaryMinimumTileAuthority,engine.sourceWildMinimumTileAuthority === own {engine.sourceWildMinimumTileAuthority=nil}
        sourceOwnedOrdinaryMinimumTileAuthority=nil
        engine.sourceOrdinarySixSpawnBeginReceiptsEnabled=false
        engine.sourceOrdinarySixSpawnNormalOnly=false
        engine.retireSourceOrdinarySixSpawnBeginReceipts(generation:generation)
        // Actual captured binding retirement below owns token teardown. No
        // synthetic Date, arrival or native handoff completion is produced.
    }
    func captureSourceMergeSixSpawnInProgress()->Bool? {
        guard sourceEndgameMutationLedgerAdmissionOpen,let binding=sourceEndgameMutationBinding else{return nil}
        let value=binding.captureSpawnInProgress()
        return sourceEndgameMutationLedgerAdmissionOpen && sourceEndgameMutationBinding === binding ? value:nil
    }
    /// Publish only the actual installed writers, before idle/global readers.
    /// The fourth level-check Date writer remains independent and is published
    /// by its own caller after that complete awaited graph is mounted.
    @discardableResult func publishSourceInstalledSpawnWriters(scope:NativeGameplaySourceContext.Scope)->Bool {
        guard let binding=sourceEndgameMutationBinding else{return false}
        let generation=engine.state.generation
        let current:()->Bool = {[weak self,weak scope,weak binding] in
            guard let self,let scope,let binding else{return false}
            return self.sourceAnimationBindingAdmissionOpen && scope.current &&
                self.sourceEndgameMutationScope === scope && self.sourceEndgameMutationBinding === binding &&
                self.engine.state.generation==generation && !binding.retired &&
                self.onSourceRegularHandoffMutation != nil &&
                self.sourceOrdinarySixSpawnScope === scope && self.sourceOrdinarySixSpawnResets != nil &&
                self.engine.sourceOrdinarySixSpawnBeginReceiptsEnabled &&
                self.sourceDirectScope === scope && self.engine.sourceWildSpawnBegin != nil &&
                self.engine.sourceWildCoroutineResume != nil && self.engine.sourceWildCoroutineFinally != nil &&
                self.sourceTntMainScope === scope && self.engine.sourceTntSpawnBegin != nil &&
                self.engine.sourceTntCoroutineResume != nil && self.engine.sourceTntCoroutineFinally != nil
        }
        guard current() else{return false}
        return binding.publishInstalledWriters([.handoff,.ordinarySpawn,.wildSpawn,.tntSpawn],current:current)
    }
    private func retireSourceEndgameMutationLedger() {
        retireSourceOrdinarySixSpawnOwner()
        let captured=sourceEndgameMutationBinding,scope=sourceEndgameMutationScope
        sourceEndgameMutationBinding=nil;sourceEndgameMutationScope=nil;sourceEndgameMutationEpoch &+= 1
        if captured != nil {onSourceRegularHandoffMutation=nil}
        if let captured {if let scope {scope.retireEndgameMutations(captured)}else{captured.retire()}}
    }
    private var sourceRegularHandoffMutationReceipts:[NativeSourceFrameRuntime.Key:NativeSourceRegularHandoffMutationReceipt]=[:]
    private func beginSourceGameplay(_ kind:NativeSourceFrameRuntime.Kind,id:String,generation:UInt64) {
        let key=NativeSourceFrameRuntime.Key(kind:kind,generation:generation,id:id)
        guard sourceGameplay[key]==nil else{return}
        sourceCallbackTime();sourceGameplay[key]=sourceFrames.begin(key)
        if kind == .regularMergeHandoff,onSourceRegularHandoffMutation != nil {
            let receipt=NativeSourceRegularHandoffMutationReceipt(ownerID:id,generation:generation)
            sourceRegularHandoffMutationReceipts[key]=receipt
            onSourceRegularHandoffMutation?(receipt,.began)
        }
    }
    private func finishSourceGameplay(_ kind:NativeSourceFrameRuntime.Kind,id:String,generation:UInt64) {
        let key=NativeSourceFrameRuntime.Key(kind:kind,generation:generation,id:id)
        if let capture=sourceGameplay.removeValue(forKey:key) {
            let receipt=sourceRegularHandoffMutationReceipts.removeValue(forKey:key)
            sourceCallbackTime();sourceFrames.end(capture)
            if let receipt {onSourceRegularHandoffMutation?(receipt,.released)}
        }
        if kind == .mergeSixResolution,let release=sourceSixIdleReleases.removeValue(forKey:id) {release()}
    }
    private func finishSourceStars() {
        guard hudStarIDs.isEmpty,let capture=sourceStars else{return}
        sourceStars=nil;sourceCallbackTime();sourceFrames.end(capture)
    }
    private func retireSourceSpawns(tileID:String?=nil) {
        for (key,owner) in Array(sourceSpawns) where tileID==nil || owner.tileID==tileID {
            sourceSpawns.removeValue(forKey:key);owner.release()
            // Removing/merging a live replacement settles its accepted impact.
            // Whole-board retirement must never notify the departed gameplay.
            if tileID != nil {owner.interrupted?()}
        }
    }
    /// Only source-identified wrapped/app-spawn paths call this helper. The
    /// unported Wild meter drop must not acquire a substitute bounce scope.
    private func runSourceSpawn(_ node:NativeDiceNode,key:String,postDelay:Double=0,settleOnInterruption:Bool=false,completion:(()->Void)?=nil) {
        let ownerKey=node.tileID+":"+key,id=UUID().uuidString
        if let previous=sourceSpawns.removeValue(forKey:ownerKey) {previous.release();previous.interrupted?()}
        let release=beginSourceMotion(.spawnBounce,id:id,generation:engine.state.generation) ?? {}
        let generation=engine.state.generation,lifetime=visualLifetime,binding=sourceMicrotaskInstallation
        var settled=false
        let settle:(Bool)->Void = {[weak self,weak node] interrupted in
            guard !settled else{return};settled=true
            if interrupted,let node,node.sourceGeneration==generation {
                node.visual.removeAction(forKey:key);node.visual.setScale(1);node.visual.zRotation=0
            }
            release()
            if self?.sourceSpawns[ownerKey]?.id==id {self?.sourceSpawns.removeValue(forKey:ownerKey)}
            guard let completion else{return}
            let deliver:@MainActor @Sendable ()->Void = {[weak self,weak binding] in
                guard let self,!self.disposed,!self.sourceDisposalInProgress,
                      self.engine.state.generation==generation,self.visualLifetime==lifetime else{return}
                if let binding {guard binding.isCurrent,self.sourceMicrotaskInstallation === binding else{return}}
                else {guard self.sourceMicrotaskInstallation==nil else{return}}
                completion()
            }
            // Completion may commit/synchronize the board. Keep it outside the
            // current SpriteKit/synchronize mutation, using the actual APP FIFO.
            if let binding {
                if !binding.enqueue(deliver),binding.isCurrent,self?.engine.state.generation==generation {
                    self?.onSourcePresentationFailure?("source_spawn_completion_fifo_rejected",generation)
                }
            }
            else if interrupted {DispatchQueue.main.async(execute:deliver)}
            else {deliver()}
        }
        sourceSpawns[ownerKey]=SourceSpawnScope(tileID:node.tileID,actionKey:key,id:id,release:release,
            interrupted:settleOnInterruption ? {settle(true)}:nil)
        var actions:[SKAction]=[NativeBoardMotion.spawnBounce(),.run(release)]
        if postDelay>0 {actions.append(.wait(forDuration:postDelay))}
        actions.append(.run{
            if let binding {_=binding.renderActionTask{settle(false)}}
            else {settle(false)}
        })
        node.visual.run(.sequence(actions),withKey:key)
    }
    private func retireSourceOrdinaryOpenBounces() {
        let captured=sourceOrdinaryOpenBounces;sourceOrdinaryOpenBounces.removeAll()
        for entry in captured.values {
            entry.node.unbindSourceAppSpawnInterruption(id:entry.id)
            entry.owner.interrupt()
        }
    }
    /// Exact app-spawn regular bounce for the admitted locked opening caller.
    /// Independent raw setValue RAF was already queued by its assignment.
    /// Native SKAction spawn and other family paths keep their existing owners.
    private func startSourceOrdinaryOpenBounce(_ node:NativeDiceNode,timeScale:Double=1,completed:@escaping()->Void)->Bool {
        guard sourceAnimationBindingAdmissionOpen,sourceStackCoreFaceReceiptsEnabled,
            engine.sourceOrdinaryLockedSettlementsEnabled,let scope=sourceSixScope,scope.current,
            node.sourceOuterDriven,node.sourceContactNodeAlive,node.parent === canvasRoot,
            nodesByID[node.tileID] === node,node.sourceGeneration==engine.state.generation,
            !node.isSpecial,!node.sourceLocked,node.sourceValue>0,
            (node.sourceRegularFramePending || node.sourceMergeSixFaceReady(service:scope.service)),
            sourceOrdinaryOpenBounces[node.tileID]==nil else{return false}
        let id="ordinary-open:"+UUID().uuidString,generation=engine.state.generation
        let current:()->Bool = {[weak self,weak node,weak scope] in
            guard let self,let node,let scope else{return false}
            return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceSixScope === scope &&
                self.engine.state.generation==generation && self.nodesByID[node.tileID] === node &&
                node.parent === self.canvasRoot && node.sourceContactNodeAlive && node.sourceGeneration==generation &&
                self.sourceOrdinaryOpenBounces[node.tileID]?.id==id
        }
        let owner=NativeSourceAppSpawnBounceOwner(service:scope.service,hooks:.init(current:current,
            readRotation:{[weak node] in node.map{Double($0.dragInnerTilt)}},
            paintScale:{[weak node] scale in node?.paintSourceOuterScale(.init(x:scale,y:scale))},
            paintRotation:{[weak node] angle in node?.dragInnerTilt=CGFloat(angle)},
            ensureFullOpacity:{[weak node] in node?.ensureSourceAppSpawnFullOpacity()},random:{scope.mathRandom.next()},
            acquireFrames:{[weak self] in guard current() else{return nil};return self?.beginSourceMotion(.spawnBounce,id:id,generation:generation)},
            finished:{[weak self,weak node] outcome in
                guard let self,let node,self.sourceOrdinaryOpenBounces[node.tileID]?.id==id else{return}
                let wasCurrent=current()
                self.sourceOrdinaryOpenBounces.removeValue(forKey:node.tileID)
                node.unbindSourceAppSpawnInterruption(id:id)
                guard wasCurrent else{return}
                if outcome == .unavailable {self.onSourcePresentationFailure?("source_ordinary_open_bounce_unavailable",generation)}
                else {completed()}
            }),timeScale:timeScale)
        sourceOrdinaryOpenBounces[node.tileID] = .init(id:id,node:node,owner:owner)
        guard node.bindSourceAppSpawnInterruption(id:id,pickup:{[weak owner] in owner?.removeChildrenForPickup()},
            interrupted:{[weak owner] in owner?.interrupt()}),current(),owner.start(),current() else {
            sourceOrdinaryOpenBounces.removeValue(forKey:node.tileID)
            node.unbindSourceAppSpawnInterruption(id:id);owner.interrupt();return false
        }
        return true
    }
    var onBoardEntry: ((TimeInterval, [TimeInterval]) -> Void)?
    var onBoardExit: ((TimeInterval) -> Void)?
    var onHUDDrop: ((UInt64) -> Void)?
    // Default-OFF genuine fresh/restored-regular sweetPopIn caller. The
    // constructor objects, APP clock/Math/FIFO and authored sound are mandatory.
    var sourceBoardEntryEnabled=false
    private weak var sourceBoardEntryScope:NativeGameplaySourceContext.Scope?
    private var sourceBoardEntrySound:((Double,UInt64,UInt64)->(()->Void)?)?
    private var sourceBoardEntryCompleted:((NativeSourceBoardEntryOwner.Completion)->Void)?
    private var sourceBoardEntryOwner:NativeSourceBoardEntryOwner?
    private var sourceSmokePoolWarmup:NativeSourceSmokePoolWarmup?
    var sourceSmokePoolWarmupCompletedTargets:[Int]{sourceSmokePoolWarmup?.completedTargets ?? []}
    private var sourceBoardEntryNodes:[String:NativeDiceNode]=[:]
    private var sourceBoardEntryEpoch:UInt64=0,sourceBoardEntrySoundReceipt:UInt64=0
    private(set) var completedSourceBoardEntry:NativeSourceBoardEntryOwner.Completion?
    var sourceBoardEntryAdmissionOpen:Bool {
        guard sourceAnimationBindingAdmissionOpen,sourceBoardEntryEnabled,let scope=sourceBoardEntryScope,
            scope.current,sourceOuterTimelineDriver === scope.timeline,sourceDragTweenDriver === scope.tween,
            scope.service.sourceFrameTransportAdmissionOpen,
            let installation=sourceMicrotaskInstallation,installation.isCurrent,
            installation.tasks === scope.sourceMicrotaskTasks,sourceBoardEntrySound != nil else{return false}
        return sourceAnimationBindingAdmissionOpen && sourceBoardEntryScope === scope && scope.current
    }
    @discardableResult func configureSourceBoardEntry(scope:NativeGameplaySourceContext.Scope,
        sound:@escaping(Double,UInt64,UInt64)->(()->Void)?,
        completed:@escaping(NativeSourceBoardEntryOwner.Completion)->Void)->Bool {
        guard sourceBoardEntryEnabled,sourceAnimationBindingAdmissionOpen,scope.current,
            sourceBoardEntryScope==nil,sourceBoardEntryOwner==nil,sourceInitialConstruction?.isCurrent==true,
            sourceOuterTimelineDriver === scope.timeline,sourceDragTweenDriver === scope.tween,
            scope.service.sourceFrameTransportAdmissionOpen,
            let installation=sourceMicrotaskInstallation,installation.isCurrent,
            installation.tasks === scope.sourceMicrotaskTasks else{return false}
        sourceBoardEntryScope=scope;sourceBoardEntrySound=sound;sourceBoardEntryCompleted=completed
        sourceDisposalSealingEnabled=true
        return sourceBoardEntryAdmissionOpen
    }
    private func sourceBoardEntryOwns(_ node:NativeDiceNode)->Bool {
        guard let owner=sourceBoardEntryOwner,owner.phase == .running,
            sourceBoardEntryNodes[node.tileID] === node,nodesByID[node.tileID] === node,
            node.sourceContactNodeAlive,node.sourceGeneration==owner.generation,node.parent === canvasRoot,
            node.sourceBoardEntryBinding==owner.id else{return false}
        return sourceBoardEntryAdmissionOpen
    }
    // SpriteKit stores node positions as Float32. Compare the exact stored
    // canonical pose, rather than accepting an unrelated near-by position.
    static func sourceBoardEntryStoredPosition(_ point:CGPoint)->CGPoint {
        CGPoint(x:CGFloat(Float(point.x)),y:CGFloat(Float(point.y)))
    }
    private func startSourceBoardEntry(tiles:[NativeTile],geometry:NativeBoardGeometry)->Bool {
        guard sourceBoardEntryAdmissionOpen,sourceBoardEntryOwner==nil,let scope=sourceBoardEntryScope,
            let installation=sourceMicrotaskInstallation,let initial=sourceInitialConstruction,initial.isCurrent,
            tiles.count==engine.state.tiles.count,tiles.allSatisfy({tile in
                guard !tile.pendingRemoval,let node=nodesByID[tile.id],node.sourceBoardEntryIdentityAdmitted else{return false}
                return tile.isWild ? node.sourceRestoredWildConstructorCurrent:(tile.variant==nil && tile.gameplayArchetype==nil)
            }),
            let sound=sourceBoardEntrySound else{return false}
        let generation=engine.state.generation,epoch=sourceBoardEntryEpoch
        var captures:[NativeSourceBoardEntryOwner.Capture]=[],nodes:[String:NativeDiceNode]=[:]
        for tile in tiles {
            guard let node=nodesByID[tile.id],node.parent === canvasRoot,node.sourceGeneration==generation,
                node.sourceContactNodeAlive,node.value==tile.value,node.locked==tile.locked,
                node.position==Self.sourceBoardEntryStoredPosition(geometry.center(row:tile.cell.row,column:tile.cell.column)) else{return false}
            nodes[tile.id]=node
            captures.append(.init(node:node,parent:canvasRoot,generation:generation,
                sourcePosition:CGPoint(x:tile.cell.column*148+64,y:tile.cell.row*148+64),
                nativePosition:node.position,sourceRotation:-Double(node.zRotation),geometryScale:Double(geometry.scale),
                locked:node.locked,value:node.value))
        }
        let current:()->Bool = {[weak self,weak scope,weak installation,weak initial] in
            guard let self,let scope,let installation,let initial,self.sourceBoardEntryAdmissionOpen,
                self.sourceBoardEntryScope === scope,self.sourceBoardEntryEpoch==epoch,
                self.sourceMicrotaskInstallation === installation,installation.isCurrent,
                self.sourceInitialConstruction === initial,initial.isCurrent,self.engine.state.generation==generation else{return false}
            return self.sourceBoardEntryAdmissionOpen && self.sourceBoardEntryEpoch==epoch && self.engine.state.generation==generation
        }
        sourceBoardEntrySoundReceipt &+= 1;let audioReceipt=sourceBoardEntrySoundReceipt
        guard let owner=NativeSourceBoardEntryOwner(service:scope.service,captures:captures,generation:generation,
            timeouts:sourceAppTimeouts,random:{[weak scope] in guard let scope,current() else{return nil};return scope.mathRandom.next()},
            current:current,acquireFrames:{[weak self] in self?.beginSourceMotion(.boardPopIn,id:"source-board-entry:\(epoch)",generation:generation)},
            sound:{duration in guard current() else{return nil};return sound(duration,audioReceipt,generation)},
            half:{[weak self] in guard let self,current(),let receipt=self.hudEntryReceipt else{return};self.hudEntryReveal.midpoint(receipt)},
            haptic:{[weak self] in guard current() else{return};self?.onHaptic?("protected-light")},
            syncZ:{node,animating in guard current(),nodes[node.tileID] === node,node.parent === captures.first?.parent else{return};node.zPosition=node.locked ? (animating ? 80:5):(animating ? 120:20)},
            drawBG:{[weak self] in guard let self,current() else{return};self.renderGhosts(state:self.engine.state,geometry:geometry)},
            finished:{[weak self,weak installation] completion in
                guard let self,self.sourceBoardEntryOwner?.id==completion.id,self.sourceBoardEntryEpoch==epoch else{return}
                self.sourceBoardEntryOwner=nil;self.sourceBoardEntryNodes.removeAll()
                self.entryInProgress=false;self.entryOwners=0;self.finishSourceEntry()
                guard completion.outcome == .normal || completion.outcome == .forced else{self.inputAdmitted=false;return}
                guard current(),let installation,self.sourceMicrotaskInstallation === installation,
                    installation.enqueue({[weak self] in
                        guard let self,current(),self.sourceBoardEntryOwner==nil,self.sourceBoardEntryEpoch==epoch else{return}
                        self.completedSourceBoardEntry=completion;self.inputAdmitted=true
                        // Immutable v9 warms the app-lived Wild smoke pool in
                        // ten tracked APP wall batches after sweetPopIn. These
                        // jobs neither advance gameplay nor draw visual RNG.
                        if self.sourceSmokePoolWarmup==nil {
                            let warmup=NativeSourceSmokePoolWarmup(timeouts:self.sourceAppTimeouts,generation:generation,
                                current:{[weak self,weak scope] in
                                    guard let self,let scope else{return false}
                                    return self.sourceBoardEntryAdmissionOpen && self.sourceBoardEntryScope === scope &&
                                        scope.current && scope.service.sourceForegroundAdmissionOpen &&
                                        self.sourceBoardEntryEpoch==epoch && self.engine.state.generation==generation &&
                                        self.completedSourceBoardEntry?.id==completion.id
                                },session:scope.smokeSession)
                            self.sourceSmokePoolWarmup=warmup
                            _=warmup.start()
                        }
                        self.resumeSourceEntryDeferredIdle()
                        if self.sourceTutorialActivationEnabled,!self.startSourceTutorialActivation(completion) {
                            self.inputAdmitted=false;self.onPresentationFailure?("source_tutorial_activation_not_bound");return
                        }
                        self.sourceBoardEntryCompleted?(completion)
                        guard current(),self.sourceBoardEntryEpoch==epoch else{return}
                        self.evaluate()
                    }) else{self.inputAdmitted=false;return}
            }),current() else{return false}
        sourceBoardEntryOwner=owner;sourceBoardEntryNodes=nodes;completedSourceBoardEntry=nil
        entryInProgress=true;entryOwners=tiles.count;inputAdmitted=false
        let hudReceipt=hudEntryReveal.begin(generation:generation,tileCount:tiles.count)
        hudEntryReceipt=hudReceipt;isHUDRevealPending=true
        primeHUDForBoardEntry()
        let started=owner.start(groupedHaptics:true)
        guard started,current(),sourceBoardEntryOwner === owner || owner.phase == .finished else {
            if sourceBoardEntryOwner === owner {sourceBoardEntryOwner=nil;sourceBoardEntryNodes.removeAll()}
            owner.retire();entryInProgress=false;inputAdmitted=false;return false
        }
        // No yield or extra frame: reveal only after the real captured main is
        // installed; queued original constructor/face RAFs retain their order.
        initial.releaseToExistingNativeEntry()
        return true
    }
    var sourceTutorialActivationEnabled=false
    private var sourceTutorialMeterHUD:NativeWildMeterHUDPresentation?
    private weak var sourceMeterHUDScope:NativeGameplaySourceContext.Scope?
    private var sourceTutorialMeterRect:CGRect?,sourceTutorialMeterRatio:Double?
    private var sourceTutorialSmokeFrozen=true
    private var sourceTutorialSmokeResumeTimer:NativeSourceAppTimeoutOwner.Receipt?
    var sourceTutorialMeterSmokeFrozen:Bool{sourceTutorialSmokeFrozen}
    var sourceTutorialMeterHUDReady:Bool{sourceTutorialMeterHUD != nil}
    var sourceTutorialMeterSmokeCount:Int{sourceTutorialMeterHUD?.activeSmokeCount ?? 0}
    @discardableResult func configureSourceTutorialMeterHUD(scope:NativeGameplaySourceContext.Scope)->Bool {
        if sourceTutorialMeterHUD != nil {return sourceMeterHUDScope === scope && scope.current}
        guard sourceAnimationBindingAdmissionOpen,scope.current,
            let tasks=scope.sourceMicrotaskTasks,sourceAppTimeouts.sourceMicrotaskTasks === tasks else{return false}
        let generation=engine.state.generation,rect=NativeGameplayChromePlan.make(viewport:size,safeTop:safeInsets.top).meterRect
        sourceMeterHUDScope=scope;sourceTutorialSmokeFrozen=engine.state.tutorial?.active==true
        let owner=NativeWildMeterHUDPresentation(hudStage:hud,service:scope.service,timeouts:sourceAppTimeouts,generation:generation,
            maximum:Double(rect.width),isPad:size.width>=768,sourceOrigin:.init(x:rect.minX,y:size.height-rect.maxY),
            sourceToNative:{[weak self] point in .init(x:point.x,y:(self?.size.height ?? 0)-point.y)},
            nativeToSource:{[weak self] point in .init(x:point.x,y:(self?.size.height ?? 0)-point.y)},
            smokeDisabled:{[weak self] in self?.sourceTutorialSmokeFrozen != false},
            current:{[weak self,weak scope] in guard let self,let scope else{return false};return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceMeterHUDScope === scope && self.engine.state.generation==generation},
            visualRandom:{[scope] in scope.mathRandom.next()})
        owner.setCanvasShakeOffset(canvasRoot.position)
        sourceTutorialMeterHUD=owner;sourceTutorialMeterRect=rect;sourceTutorialMeterRatio=engine.state.wildMeter
        // One loader replaces the two prototype top-level shapes. Its original
        // loader role is now captured by the actual tutorial HUD dim owner.
        meter.removeFromParent();meterBackground.removeFromParent()
        owner.setProgress(engine.state.wildMeter,animated:false)
        return sourceAnimationBindingAdmissionOpen && scope.current && sourceMeterHUDScope === scope && sourceTutorialMeterHUD === owner
    }
    func sourceTutorialSetMeterSmokeFrozen(_ frozen:Bool){
        sourceTutorialSmokeFrozen=frozen;sourceTutorialMeterHUD?.stopSmoke()
        guard !frozen,let scope=sourceTutorialScope,scope.current else{return}
        // Literal resumeWildMeterBoil compatibility hook is intentionally empty:
        // the original v915 meter smoke is event-bound, without idle emission.
        if let old=sourceTutorialSmokeResumeTimer{_=sourceAppTimeouts.cancel(old)}
        let epoch=sourceTutorialEpoch,generation=engine.state.generation
        sourceTutorialSmokeResumeTimer=sourceAppTimeouts.schedule(sourceID:"tutorial-meter-smoke-resume180",generation:generation,delayMilliseconds:180,elapsed:{[weak self,weak scope] in
            guard let self else{return};self.sourceTutorialSmokeResumeTimer=nil
            guard let scope,scope.current,self.sourceTutorialScope === scope,self.sourceTutorialEpoch==epoch,self.engine.state.generation==generation else{return}
            // Original compatibility hook: no new smoke or renderer work.
        })
    }
    private func retireSourceTutorialMeterHUD(){if let timer=sourceTutorialSmokeResumeTimer{_=sourceAppTimeouts.cancel(timer)};sourceTutorialSmokeResumeTimer=nil;let old=sourceTutorialMeterHUD;sourceTutorialMeterHUD=nil;sourceMeterHUDScope=nil;sourceTutorialMeterRect=nil;sourceTutorialMeterRatio=nil;old?.dispose()}
    var onSourceTutorialRetired:(()->Void)?
    var sourceTutorialSubsequentPresentationEnabled=false
    private var sourceTutorialObjectOrder:[NativeDiceNode]=[]
    private var sourceTutorialBoardRestore:NativeSourceTutorialBoardRestoreOwner?
    private(set) var sourceTutorialSecondPresentationActive=false
    private(set) var sourceTutorialThirdPresentationActive=false
    var sourceTutorialFirstStepMonitorEnabled=false
    private(set) var sourceTutorialFirstStepPresentationActive=false
    private var sourceTutorialSecondPreparation:NativeSourceTutorialSecondStepPreparation?
    var sourceTutorialHUDEnabled=false
    private var sourceTutorialHUD:NativeSourceTutorialHUDOwner?
    var sourceTutorialHUDActive:Bool{sourceTutorialHUD != nil}
    var sourceTutorialHUDAlphas:[CGFloat]{hud.children.filter{$0 !== noMoves}.map(\.alpha)}
    var onSourceTutorialPrepared:(()->Void)?
    private weak var sourceTutorialScope:NativeGameplaySourceContext.Scope?
    private var sourceTutorialReceipt:NativeSourceTutorialDemoActivationReceipt?
    private var sourceTutorialActivation:NativeSourceTutorialActivationOwner?
    private var sourceTutorialPreparation:NativeSourceTutorialStepOnePreparation?
    private var sourceTutorialEpoch:UInt64=0
    var sourceTutorialActivationPhase:NativeSourceTutorialActivationOwner.Phase?{sourceTutorialActivation?.phase}
    var sourceTutorialIntroTimeouts:NativeSourceAppTimeoutOwner{sourceAppTimeouts}
    var sourceTutorialPreparationReady:Bool{sourceTutorialPreparation?.prepared==true || sourceTutorialSecondPreparation != nil || (sourceTutorialThirdPresentationActive && (sourceTutorialBoardRestore != nil || sourceTutorialFourthExitAlpha != nil))}
    var sourceTutorialSecondPreparationReady:Bool{sourceTutorialSecondPreparation != nil}
    @discardableResult func configureSourceTutorialActivation(scope:NativeGameplaySourceContext.Scope)->Bool {
        guard sourceTutorialActivationEnabled,sourceBoardEntryAdmissionOpen,sourceTutorialScope==nil,
            scope === sourceBoardEntryScope,scope.current,let receipt=engine.pendingSourceTutorialDemoActivation,
            receipt.generation==engine.state.generation else{return false}
        sourceTutorialSubsequentPresentationEnabled=engine.sourceTutorialSubsequentPresentationEnabled
        sourceTutorialScope=scope;sourceTutorialReceipt=receipt;return true
    }
    private func sourceTutorialCurrent(_ epoch:UInt64)->Bool {
        guard sourceAnimationBindingAdmissionOpen,sourceTutorialEpoch==epoch,
            let scope=sourceTutorialScope,scope.current,sourceBoardEntryScope === scope,
            let receipt=sourceTutorialReceipt,engine.state.generation==receipt.generation,
            engine.state.tutorial?.active==true,(engine.state.tutorial?.step == .stack || (sourceTutorialFirstStepPresentationActive && engine.state.tutorial?.step == .mergeSix)) else{return false}
        return sourceAnimationBindingAdmissionOpen && sourceTutorialEpoch==epoch && scope.current
    }
    private func startSourceTutorialActivation(_ entry:NativeSourceBoardEntryOwner.Completion)->Bool {
        guard sourceTutorialActivationEnabled,sourceTutorialActivation==nil,
            entry.outcome == .normal || entry.outcome == .forced,
            completedSourceBoardEntry==entry,let receipt=sourceTutorialReceipt,
            receipt.generation==entry.generation,engine.pendingSourceTutorialDemoActivation==receipt,
            let scope=sourceTutorialScope,sourceTutorialCurrent(sourceTutorialEpoch) else{return false}
        let epoch=sourceTutorialEpoch
        let owner=NativeSourceTutorialActivationOwner(service:scope.service,timeouts:sourceAppTimeouts,generation:entry.generation,
            activateImmediately:true,
            current:{[weak self] in self?.sourceTutorialCurrent(epoch)==true},
            ready:{[weak self] in guard let self,self.sourceTutorialCurrent(epoch),let initial=self.sourceInitialConstruction else{return false};return initial.pendingFaceCount==0 && self.geometry != nil && !self.nodesByID.isEmpty},
            prepare:{[weak self] in self?.prepareSourceTutorialStepOne(epoch)==true},
            activated:{[weak self] in guard let self,self.sourceTutorialCurrent(epoch) else{return};self.onSourceTutorialPrepared?();self.startSourceTutorialHUD()})
        guard let owner else{return false};sourceTutorialActivation=owner
        return owner.start()
    }
    private func prepareSourceTutorialStepOne(_ epoch:UInt64)->Bool {
        guard sourceTutorialCurrent(epoch),sourceTutorialPreparation==nil,
            let receipt=sourceTutorialReceipt,engine.pendingSourceTutorialDemoActivation==receipt,
            let scope=sourceTutorialScope,let geometry else{return false}
        let positions=Dictionary(uniqueKeysWithValues:engine.state.tiles.map{($0.id,geometry.center(row:$0.cell.row,column:$0.cell.column))})
        let owner=NativeSourceTutorialStepOnePreparation(engine:engine,receipt:receipt,service:scope.service,
            random:{[scope] in scope.mathRandom.next()},nodes:nodesByID,parent:canvasRoot,positions:positions,
            current:{[weak self] in self?.sourceTutorialCurrent(epoch)==true},
            layoutBoard:{[weak self] in guard let self,self.sourceTutorialCurrent(epoch) else{return};self.applyBoardShake(self.boardShake)},
            updateFocus:{[weak self] in guard let self,self.sourceTutorialCurrent(epoch) else{return};self.onSourceTutorialPrepared?()})
        guard let owner,sourceTutorialCurrent(epoch) else{return false}
        sourceTutorialPreparation=owner
        guard owner.prepare(),sourceTutorialCurrent(epoch) else {
            if sourceTutorialPreparation === owner{sourceTutorialPreparation=nil};owner.dispose();return false
        }
        sourceTutorialFirstStepPresentationActive=sourceTutorialFirstStepMonitorEnabled
        return true
    }
    private func startSourceTutorialHUD(){
        guard sourceTutorialHUDEnabled,sourceTutorialHUD==nil,sourceTutorialPreparationReady,
            let scope=sourceTutorialScope,scope.current,let receipt=sourceTutorialReceipt else{return}
        let owner=NativeSourceTutorialHUDOwner(root:hud,rootFinalAlpha:hud.action(forKey:"hud-enter") == nil ? nil:1,excludedTargets:[noMoves],service:scope.service,timeouts:sourceAppTimeouts,generation:receipt.generation,
            current:{[weak self,weak scope] in guard let self,let scope else{return false};return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceBoardEntryScope === scope && self.engine.state.generation==receipt.generation && self.engine.state.tutorial?.active==true && (self.engine.state.tutorial?.step == .stack || self.engine.state.tutorial?.step == .mergeSix || self.sourceTutorialSecondPresentationActive || self.sourceTutorialThirdPresentationActive)})
        guard let owner else{onPresentationFailure?("source_tutorial_hud_not_admitted");return}
        sourceTutorialHUD=owner
        if !owner.start(){sourceTutorialHUD=nil;owner.dispose();onPresentationFailure?("source_tutorial_hud_start_rejected")}
    }
    func sourceTutorialFirstStepTargets()->[NativeDiceNode]? {
        guard sourceTutorialFirstStepMonitorEnabled,sourceTutorialFirstStepPresentationActive,sourceTutorialCurrent(sourceTutorialEpoch),
            let receipt=sourceTutorialReceipt,let three=nodesByID[receipt.threeID],let two=nodesByID[receipt.twoID] else{return nil}
        return [three,two]
    }
    var sourceTutorialCapturedParent:SKNode{canvasRoot}
    var sourceTutorialCapturedLiveNodes:[NativeDiceNode]{sourceTutorialObjectOrder.filter{sourceTutorialTargetCurrent($0)}}
    /// Literal Source getActiveTiles/findWildTile ordering. The first Star is
    /// chosen before asking whether it drops; a later dropping Star cannot
    /// bypass an earlier resting Star. Captured object order breaks equal cells.
    var onTutorialSpecialDropLanded:((NativeDiceNode)->Void)?
    var onTutorialSpecialDropStarted:((NativeDiceNode)->Void)?
    func sourceTutorialFourthDroppingWild()->NativeDiceNode? {
        guard sourceAnimationBindingAdmissionOpen,sourceTutorialSubsequentPresentationEnabled,
            sourceTutorialThirdPresentationActive,let scope=sourceTutorialScope,scope.current,
            engine.state.tutorial?.active==true,let caller=sourceMeterCaller else{return nil}
        let candidates=sourceTutorialObjectOrder.enumerated().compactMap { index,node -> (Int,NativeDiceNode,NativeCell)? in
            guard node.sourceContactNodeAlive,node.parent != nil,nodesByID[node.tileID] === node,
                node.sourceGeneration==engine.state.generation,!node.sourceLocked,node.sourceValue>0,
                let tile=engine.state.tiles.first(where:{$0.id==node.tileID}) else{return nil}
            let finale=node.variant.flatMap{NativeSpecialDiceRegistry.variants[$0]?.visualFinale}
            let star=finale == .star || (finale==nil && !node.sourceWildStateCleared && (node.kind=="wild" || node.sourceResidualWildPresence))
            guard star else{return nil}
            return (index,node,tile.cell)
        }.sorted { a,b in
            if a.2.row != b.2.row{return a.2.row>b.2.row}
            if a.2.column != b.2.column{return a.2.column<b.2.column}
            return a.0<b.0
        }
        guard let first=candidates.first?.1,caller.sourceTutorialWildDropping(first) else{return nil}
        return first
    }
    private var sourceTutorialFourthFocus:NativeSourceTutorialFocusOwner?
    /// Genuine fourth preparation prefix: canonical placement first, then the
    /// same physical Wild RAF owner, immediate target pips and exact focus.
    @discardableResult func prepareSourceTutorialFourthStep(_ wild:NativeDiceNode,ownerID:String)->Bool {
        guard !ownerID.isEmpty,sourceTutorialFourthFocus==nil,sourceTutorialFourthWildFrames==nil,
            sourceAnimationBindingAdmissionOpen,sourceTutorialSubsequentPresentationEnabled,
            sourceTutorialThirdPresentationActive,let scope=sourceTutorialScope,scope.current,
            sourceStarHaloScope === scope,let geometry,sourceTutorialTargetCurrent(wild),
            wild.sourceTutorialPlainStarFaceReady,engine.sourceTutorialFourthPreparation==nil else{return false}
        let generation=engine.state.generation,epoch=sourceTutorialEpoch
        let destroyed=Set(engine.state.tiles.compactMap{tile in nodesByID[tile.id]?.sourceContactNodeAlive==true ? nil:tile.id})
        guard let selection=NativeTutorialRules.sourceFourthTarget(state:engine.state,wildID:wild.tileID,destroyedIDs:destroyed),
            let target=nodesByID[selection.id],sourceTutorialTargetCurrent(target),target.kind=="regular",target.variant==nil else{return false}
        let result=engine.prepareSourceTutorialFourthStep(ownerID:ownerID,generation:generation,wildID:wild.tileID,targetID:target.tileID)
        guard result.accepted,let receipt=engine.sourceTutorialFourthPreparation else{return false}
        var completed=false,capturedFrames:NativeSourceTutorialFourthWildFrames?,capturedFocus:NativeSourceTutorialFocusOwner?
        defer {
            if !completed {
                if let capturedFrames {
                    if sourceTutorialFourthWildFrames === capturedFrames{sourceTutorialFourthWildFrames=nil}
                    capturedFrames.dispose()
                }
                if let capturedFocus {
                    if sourceTutorialFourthFocus === capturedFocus{sourceTutorialFourthFocus=nil}
                    capturedFocus.dispose()
                }
                // Canonical state is never rolled back after presentation has
                // started. A current failure follows the existing fail-visible
                // path; retirement must not overwrite a successor route.
                if sourceAnimationBindingAdmissionOpen,scope.current,sourceTutorialScope === scope,
                    sourceTutorialEpoch==epoch,engine.state.generation==generation {
                    onSourcePresentationFailure?("source_tutorial_fourth_preparation_interrupted",generation)
                }
            }
        }
        wild.position=geometry.center(row:receipt.wildCell.row,column:receipt.wildCell.column)
        guard beginSourceTutorialFourthWildFrames(wild) else{return false}
        capturedFrames=sourceTutorialFourthWildFrames
        guard target.setSourceTutorialInitialValue(receipt.targetValue) else{return false}
        let current:()->Bool = {[weak self,weak scope] in
            guard let self,let scope else{return false}
            return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceTutorialScope === scope &&
                self.sourceTutorialEpoch==epoch && self.engine.state.generation==generation &&
                self.engine.sourceTutorialFourthPreparation==receipt && self.sourceTutorialThirdPresentationActive
        }
        let focus=NativeSourceTutorialFocusOwner(service:scope.service,random:{[scope] in scope.mathRandom.next()},current:current)
        sourceTutorialFourthFocus=focus;capturedFocus=focus
        for node in sourceTutorialCapturedLiveNodes {
            guard current(),let tile=engine.state.tiles.first(where:{$0.id==node.tileID}) else{return false}
            let allowed=node === wild || (!node.sourceLocked && !node.isSpecial && node.sourceValue>0 && tile.cell.row<=min(engine.state.rows-1,5))
            guard focus.focusFourth(node,focused:allowed) else{return false}
        }
        completed=current();return completed
    }
    private var sourceTutorialFourthWildFrames:NativeSourceTutorialFourthWildFrames?
    /// After actual canonical fourth placement, attach the original nested RAF
    /// sequence to the same roster object. This does not admit the whole monitor.
    @discardableResult func beginSourceTutorialFourthWildFrames(_ wild:NativeDiceNode)->Bool {
        guard sourceTutorialFourthWildFrames==nil,sourceAnimationBindingAdmissionOpen,
            sourceTutorialSubsequentPresentationEnabled,sourceTutorialThirdPresentationActive,
            let scope=sourceTutorialScope,scope.current,sourceStarHaloScope === scope,
            let receipt=engine.sourceTutorialFourthPreparation,receipt.generation==engine.state.generation,
            receipt.wildID==wild.tileID,sourceTutorialTargetCurrent(wild),wild.sourceTutorialPlainStarFaceReady else{return false}
        let epoch=sourceTutorialEpoch,generation=receipt.generation
        let current:()->Bool = {[weak self,weak scope,weak wild] in
            guard let self,let scope,let wild else{return false}
            return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceTutorialScope === scope &&
                self.sourceStarHaloScope === scope && self.sourceTutorialEpoch==epoch &&
                self.engine.state.generation==generation && self.engine.sourceTutorialFourthPreparation==receipt &&
                self.sourceTutorialThirdPresentationActive && self.sourceTutorialTargetCurrent(wild)
        }
        let owner=NativeSourceTutorialFourthWildFrames(service:scope.service,generation:generation,current:current,
            commitFields:{[weak wild] in wild?.commitSourceTutorialWildFields(generation:generation)==true},
            paintFace:{[weak wild] in wild?.paintSourceTutorialWildFace(generation:generation,current:current)==true},
            startHalo:{[weak self,weak wild] in guard let self,let wild,current() else{return false};return self.beginSourcePlainStarHalo(wild,introBounce:true)})
        guard let owner else{return false};sourceTutorialFourthWildFrames=owner
        guard owner.start(),current() else{if sourceTutorialFourthWildFrames === owner{sourceTutorialFourthWildFrames=nil};owner.dispose();return false}
        return true
    }
    func sourceTutorialFourthPointerPlan(_ wild:NativeDiceNode)->NativeSourceTutorialFourthPointerPlan? {
        guard sourceAnimationBindingAdmissionOpen,sourceTutorialThirdPresentationActive,
            let scope=sourceTutorialScope,scope.current,sourceTutorialTargetCurrent(wild),
            let receipt=engine.sourceTutorialFourthPreparation,receipt.wildID==wild.tileID else{return nil}
        let generation=engine.state.generation,epoch=sourceTutorialEpoch
        func current()->Bool{sourceAnimationBindingAdmissionOpen && scope.current && sourceTutorialScope === scope && sourceTutorialEpoch==epoch && engine.state.generation==generation && engine.sourceTutorialFourthPreparation==receipt && sourceTutorialTargetCurrent(wild)}
        func rect(_ node:NativeDiceNode)->CGRect? {
            guard current(),sourceTutorialTargetCurrent(node) else{return nil}
            let bounds=node.calculateAccumulatedFrame(),center=canvasRoot.convert(CGPoint(x:bounds.midX,y:bounds.midY),to:self)
            guard bounds.width>0,bounds.height>0,center.x.isFinite,center.y.isFinite else{return nil}
            let width=max(52,bounds.width),height=max(52,bounds.height)
            return CGRect(x:center.x-width/2,y:size.height-center.y-height/2,width:width,height:height)
        }
        let sourceRect=rect(wild)
        var candidates=sourceTutorialObjectOrder.enumerated().compactMap{index,node -> (Int,NativeDiceNode,NativeCell)? in
            guard node !== wild,sourceTutorialTargetCurrent(node),!node.sourceLocked,!node.isSpecial,node.sourceValue>0,
                let tile=engine.state.tiles.first(where:{$0.id==node.tileID}),tile.cell.row<=min(engine.state.rows-1,5) else{return nil}
            return (index,node,tile.cell)
        }.sorted{a,b in
            if a.2.row != b.2.row{return a.2.row>b.2.row}
            if a.2.column != b.2.column{return a.2.column<b.2.column}
            return a.0<b.0
        }
        if candidates.count>1 {for i in stride(from:candidates.count-1,through:1,by:-1){
            guard current() else{return nil};let draw=scope.mathRandom.next()
            guard current(),draw.isFinite,draw>=0,draw<1 else{return nil}
            candidates.swapAt(i,Int(floor(draw*Double(i+1))))
        }}
        guard current(),let sourceRect,let candidate=candidates.first,let targetRect=rect(candidate.1) else{return nil}
        return .init(from:sourceRect,to:targetRect)
    }
    /// Literal isFourthStepComplete reads the actual prepared physical roster,
    /// including the original Wild object after its logical slot disappears.
    func sourceTutorialFourthStepIsComplete(_ wild:NativeDiceNode)->Bool {
        guard sourceAnimationBindingAdmissionOpen,sourceTutorialThirdPresentationActive,
            let scope=sourceTutorialScope,scope.current,let receipt=engine.sourceTutorialFourthPreparation,
            receipt.generation==engine.state.generation,receipt.wildID==wild.tileID else{return false}
        if !wild.sourceContactNodeAlive{return true}
        let starLike = !wild.sourceWildStateCleared && (wild.kind=="wild" || wild.sourceResidualWildPresence || wild.variant.flatMap{NativeSpecialDiceRegistry.variants[$0]?.visualFinale} == .star)
        if !starLike{return true}
        return sourceTutorialObjectOrder.contains{node in
            guard sourceTutorialTargetCurrent(node),!node.sourceLocked,!node.isSpecial,node.sourceValue==6,
                let tile=engine.state.tiles.first(where:{$0.id==node.tileID}) else{return false}
            return tile.cell.row<=min(engine.state.rows-1,5)
        }
    }
    func sourceTutorialWildIsDropping(_ node:NativeDiceNode)->Bool {
        sourceTutorialTargetCurrent(node) && sourceMeterCaller?.sourceTutorialWildDropping(node)==true
    }
    func sourceWildDropTileMarkers(_ node:NativeDiceNode)->NativeWildMeterDropRuntime.SourceTileMarkers? {
        let generation=engine.state.generation,caller=sourceMeterCaller
        func current()->Bool {
            sourceAnimationBindingAdmissionOpen && nodesByID[node.tileID] === node &&
            engine.state.generation==generation && node.sourceGeneration==generation &&
            node.sourceContactNodeAlive && sourceMeterCaller === caller
        }
        guard current() else{return nil}
        if let receipt=engine.sourceRetainedDirectDestination,let scope=sourceDirectScope,
           let retained=sourceDirectRetainedDestinations[receipt.ownerID],retained.0==receipt,
           retained.1 === node,receipt.generation==generation,node.parent === canvasRoot,
           scope.current,sourceDirectScope === scope,engine.sourceRetainedDirectDestination==receipt,
           scope.mergeSixDestinationCleanup.owns(node,token:retained.2),
           let settled=retained.3,current() {
            return settled // same actual object/cleanup claim, never a cell-derived fallback
        }
        let captured=caller?.captureSourceTileDropMarkers(node)
        guard current() else{return nil}
        if let captured {return captured}
        let restored=node.captureSourceRestoredWildDropMarkers()
        return current() ? restored:nil
    }
    func captureSourceWildDropActiveCount()->Int? {
        guard sourceAnimationBindingAdmissionOpen,let caller=sourceMeterCaller,
              let count=caller.captureSourceDropActiveCount(),sourceAnimationBindingAdmissionOpen,
              sourceMeterCaller === caller else{return nil}
        return count
    }
    func captureSourceNonFinalMergeSixGuardActive()->Bool? {
        guard sourceAnimationBindingAdmissionOpen,let scope=sourceSixScope,scope.current else{return nil}
        let generation=engine.state.generation
        guard let active=scope.captureNonFinalMergeSixGuardActive(),sourceAnimationBindingAdmissionOpen,
              sourceSixScope === scope,scope.current,engine.state.generation==generation else{return nil}
        return active
    }
    func sourceTutorialTargetCurrent(_ node:NativeDiceNode)->Bool {
        sourceAnimationBindingAdmissionOpen && node.parent === canvasRoot && nodesByID[node.tileID] === node &&
            node.sourceContactNodeAlive && node.sourceGeneration==engine.state.generation && engine.state.tiles.contains{$0.id==node.tileID}
    }
    @discardableResult func prepareSourceTutorialSecondStep(_ merged:NativeDiceNode)->Bool {
        guard sourceTutorialFirstStepPresentationActive,sourceTutorialCurrent(sourceTutorialEpoch),let scope=sourceTutorialScope,
            let barrier=engine.pendingSourceTutorialPresentationBarrier,barrier.generation==engine.state.generation,
            barrier.mergedID==merged.tileID,sourceTutorialTargetCurrent(merged),merged.sourceValue==5,
            let one=nodesByID[barrier.oneID],let oneTile=engine.state.tiles.first(where:{$0.id==barrier.oneID}),
            let geometry,let first=sourceTutorialPreparation else{return false}
        let ordered=first.orderedSurvivingNodes
        if sourceTutorialSubsequentPresentationEnabled{sourceTutorialObjectOrder=ordered;sourceTutorialSecondPresentationActive=true}
        first.dispose();sourceTutorialPreparation=nil;sourceTutorialFirstStepPresentationActive=false
        let epoch=sourceTutorialEpoch
        let owner=NativeSourceTutorialSecondStepPreparation(service:scope.service,random:{[scope] in scope.mathRandom.next()},nodes:ordered,merged:merged,one:one,
            parent:canvasRoot,generation:barrier.generation,onePosition:geometry.center(row:oneTile.cell.row,column:oneTile.cell.column),
            current:{[weak self,weak scope] in guard let self,let scope else{return false};return self.sourceAnimationBindingAdmissionOpen && self.sourceTutorialEpoch==epoch && scope.current && self.sourceTutorialScope === scope && self.engine.state.generation==barrier.generation && self.engine.state.tutorial?.active==true && (self.engine.state.tutorial?.step == .mergeSix || (self.sourceTutorialSecondPresentationActive && self.engine.state.tutorial?.step == .freePlay))})
        guard let owner else{return false};sourceTutorialSecondPreparation=owner
        guard owner.prepare(),engine.completeSourceTutorialPresentationBarrier(barrier) else{owner.dispose();sourceTutorialSecondPreparation=nil;return false}
        return true
    }
    private func captureSourceTutorialObject(_ node:NativeDiceNode){
        guard sourceTutorialSubsequentPresentationEnabled,sourceTutorialSecondPresentationActive || sourceTutorialThirdPresentationActive,
            !sourceTutorialObjectOrder.contains(where:{$0 === node}) else{return}
        sourceTutorialObjectOrder.append(node)
    }
    func sourceTutorialSecondTargets()->[NativeDiceNode]? {
        guard sourceTutorialSecondPresentationActive,let pair=engine.state.tutorial?.guidedPair,pair.count==2,
            let five=nodesByID[pair[0]],let one=nodesByID[pair[1]] else{return nil};return [five,one]
    }
    func sourceTutorialFreePlayPlan()->NativeSourceTutorialFreePlayPlan? {
        guard sourceAnimationBindingAdmissionOpen,sourceTutorialThirdPresentationActive,let scope=sourceTutorialScope,scope.current,let geometry else{return nil}
        let generation=engine.state.generation,epoch=sourceTutorialEpoch
        let current:()->Bool = {[weak self,weak scope] in guard let self,let scope else{return false};return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceTutorialScope === scope && self.sourceTutorialEpoch==epoch && self.engine.state.generation==generation && self.sourceTutorialThirdPresentationActive && self.engine.state.tutorial?.active==true && self.engine.state.tutorial?.step == .freePlay}
        var candidates:[NativeSourceTutorialFreePlayPlan.Candidate]=[]
        for node in sourceTutorialObjectOrder where sourceTutorialTargetCurrent(node) && !node.sourceLocked && !node.isSpecial && node.sourceValue>0 {
            guard let tile=engine.state.tiles.first(where:{$0.id==node.tileID}),tile.cell.row<=min(engine.state.rows-1,4) else{continue}
            let bounds=node.calculateAccumulatedFrame(),center=canvasRoot.convert(CGPoint(x:bounds.midX,y:bounds.midY),to:self)
            let width=max(52,bounds.width),height=max(52,bounds.height)
            candidates.append(.init(id:node.tileID,column:tile.cell.column,row:tile.cell.row,rect:CGRect(x:center.x-width/2,y:size.height-center.y-height/2,width:width,height:height)))
        }
        return NativeSourceTutorialFreePlayPlan.make(candidates:candidates,columns:engine.state.columns,rows:engine.state.rows,random:{[scope] in scope.mathRandom.next()},cellRect:{[weak self] column,row in
            guard let self,current() else{return nil};let center=geometry.center(row:row,column:column),size=max(52,NativeBoardGeometry.tile)
            return CGRect(x:center.x-size/2,y:self.size.height-center.y-size/2,width:size,height:size)
        },current:current)
    }
    var sourceTutorialHasUnlockedSix:Bool{nodesByID.values.contains{sourceTutorialTargetCurrent($0) && !$0.sourceLocked && $0.sourceValue==6}}
    @discardableResult func prepareSourceTutorialThirdStep()->Bool {
        guard sourceAnimationBindingAdmissionOpen,sourceTutorialSubsequentPresentationEnabled,sourceTutorialSecondPresentationActive,
            let scope=sourceTutorialScope,scope.current,let barrier=engine.pendingSourceTutorialPresentationBarrier,barrier.phase == .secondMerge,
            engine.state.generation==barrier.generation,engine.state.tutorial?.step == .freePlay else{return false}
        let ordered=sourceTutorialCapturedLiveNodes
        let old=sourceTutorialSecondPreparation;sourceTutorialSecondPreparation=nil;old?.dispose()
        sourceTutorialSecondPresentationActive=false;sourceTutorialThirdPresentationActive=true
        let epoch=sourceTutorialEpoch
        let owner=NativeSourceTutorialBoardRestoreOwner(service:scope.service,random:{[scope] in scope.mathRandom.next()},nodes:ordered,parent:canvasRoot,generation:barrier.generation,
            current:{[weak self,weak scope] in guard let self,let scope else{return false};return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceTutorialScope === scope && self.sourceTutorialEpoch==epoch && self.sourceTutorialThirdPresentationActive && self.engine.state.generation==barrier.generation && self.engine.state.tutorial?.active==true && self.engine.state.tutorial?.step == .freePlay})
        guard let owner else{return false};sourceTutorialBoardRestore=owner
        guard owner.restore(immediate:false,continuous:true),sourceTutorialHUD?.stop(animateRestore:true,continuous:true,random:{[scope] in scope.mathRandom.next()},hudLocked:engine.state.tutorial?.shouldLockHUD==true,isLockedControl:{[weak self] in $0 === self?.closeButton || $0.name=="native-game-help"},cleanupSmoke:{[weak self] in self?.sourceTutorialMeterHUD?.stopSmoke()}) != false else{return false}
        for node in ordered{node.sourceEventMode = !node.sourceLocked && node.sourceValue>0 ? "static":"none"}
        return engine.completeSourceTutorialPresentationBarrier(barrier)
    }
    /// Actual third-dismiss caller, after the genuine CTA exit. Keep the
    /// captured presentation live until the fourth monitor takes ownership.
    @discardableResult func restoreSourceTutorialAfterThirdDismiss()->Bool {
        restoreSourceTutorialImmediate(unfreezeSmoke:true,hudLocked:engine.state.tutorial?.shouldLockHUD==true)
    }
    private func restoreSourceTutorialImmediate(unfreezeSmoke:Bool,hudLocked:Bool,preserveScale:Bool=false)->Bool {
        guard sourceAnimationBindingAdmissionOpen,sourceTutorialSubsequentPresentationEnabled,sourceTutorialThirdPresentationActive,
            let scope=sourceTutorialScope,scope.current,engine.state.tutorial?.active==true else{return false}
        if unfreezeSmoke{sourceTutorialSetMeterSmokeFrozen(false)}
        let ordered=sourceTutorialCapturedLiveNodes
        let old=sourceTutorialBoardRestore;sourceTutorialBoardRestore=nil;old?.dispose()
        let epoch=sourceTutorialEpoch,generation=engine.state.generation
        let owner=NativeSourceTutorialBoardRestoreOwner(service:scope.service,random:{[scope] in scope.mathRandom.next()},nodes:ordered,parent:canvasRoot,generation:generation,
            current:{[weak self,weak scope] in guard let self,let scope else{return false};return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceTutorialScope === scope && self.sourceTutorialEpoch==epoch && self.sourceTutorialThirdPresentationActive && self.engine.state.generation==generation && self.engine.state.tutorial?.active==true})
        guard let owner else{return false};sourceTutorialBoardRestore=owner
        guard owner.restore(immediate:true,preserveScale:preserveScale),sourceTutorialHUD?.stop(random:{[scope] in scope.mathRandom.next()},hudLocked:hudLocked,isLockedControl:{[weak self] in $0 === self?.closeButton || $0.name=="native-game-help"},cleanupSmoke:{[weak self] in self?.sourceTutorialMeterHUD?.stopSmoke()}) != false else{return false}
        for node in ordered {
            guard sourceTutorialTargetCurrent(node) else{continue}
            node.sourceEventMode = !node.sourceLocked && node.sourceValue>0 ? "static":"none"
            if !node.sourceLocked && node.sourceValue>0{node.alpha=1;node.isHidden=false}
        }
        return scope.current && sourceTutorialScope === scope && sourceTutorialEpoch==epoch
    }
    /// Source completeFourthStep restores once before normal drag/assist,
    /// then completeFirstPlayTutorial restores again and restores HUD again.
    @MainActor private final class TutorialFourthExitAlpha:NativeSourceAnimationParticipant {
        struct Target {let node:SKNode,parent:SKNode?,from:CGFloat,to:CGFloat}
        let targets:[Target],current:()->Bool
        var progress:CGFloat=0
        init(targets:[Target],current:@escaping()->Bool){self.targets=targets;self.current=current}
        func advanceSourceAnimation(seconds:Double){guard current() else{return};progress=CGFloat(pow(max(0,min(1,seconds/0.28)),3));paint()}
        func paint(){guard current() else{return};for target in targets where target.node.parent === target.parent{target.node.alpha=target.from+(target.to-target.from)*progress}}
    }
    private var sourceTutorialFourthExitAlpha:TutorialFourthExitAlpha?
    private var sourceTutorialFourthExitAlphaLease:NativeSourceAnimationClockService.Lease?
    @discardableResult func beginSourceTutorialFourthExitFade(ownerID:String)->Bool {
        guard sourceTutorialFourthExitAlpha==nil,let receipt=engine.sourceTutorialFourthPreparation,receipt.ownerID==ownerID,
            receipt.generation==engine.state.generation,let scope=sourceTutorialScope,scope.current else{return false}
        let focus=sourceTutorialFourthFocus;sourceTutorialFourthFocus=nil;focus?.dispose()
        let frames=sourceTutorialFourthWildFrames;sourceTutorialFourthWildFrames=nil;frames?.dispose()
        sourceTutorialBoardRestore?.dispose();sourceTutorialBoardRestore=nil
        // Retain the HUD interaction/restore owner but stop its periodic dim writer.
        guard sourceTutorialHUD?.stop(restore:false,stopPresentationWrites:true,random:{0},hudLocked:true,isLockedControl:{_ in false},cleanupSmoke:{}) != false else{return false}
        let generation=engine.state.generation,epoch=sourceTutorialEpoch
        let targets=nodesByID.values.map{TutorialFourthExitAlpha.Target(node:$0,parent:$0.parent,from:$0.alpha,to:$0.sourceLocked ? 0.2:1)} +
            hud.children.map{node in
                let locked=engine.state.tutorial?.shouldLockHUD==true && node.name != "wildLoader" && node !== meter && node !== meterBackground
                return TutorialFourthExitAlpha.Target(node:node,parent:node.parent,from:locked ? min(node.alpha,0.2):node.alpha,to:locked ? 0.2:1)
            }
        let owner=TutorialFourthExitAlpha(targets:targets,current:{[weak self,weak scope] in guard let self,let scope else{return false};return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceTutorialScope === scope && self.sourceTutorialEpoch==epoch && self.engine.state.generation==generation})
        sourceTutorialFourthExitAlpha=owner
        guard let lease=scope.service.register(participant:owner,duration:0.28,domain:.sourceGSAP(.timeline),cleanup:{_ in}) else{sourceTutorialFourthExitAlpha=nil;return false}
        sourceTutorialFourthExitAlphaLease=lease;return true
    }
    private func retireSourceTutorialFourthExitFade(){let lease=sourceTutorialFourthExitAlphaLease;sourceTutorialFourthExitAlphaLease=nil;sourceTutorialFourthExitAlpha=nil;lease?.cancel(success:false)}
    @discardableResult func restoreSourceTutorialAfterFourthExit(ownerID:String)->Bool {
        guard let receipt=engine.sourceTutorialFourthPreparation,receipt.ownerID==ownerID,
            receipt.generation==engine.state.generation else{return false}
        let focus=sourceTutorialFourthFocus;sourceTutorialFourthFocus=nil;focus?.dispose()
        let frames=sourceTutorialFourthWildFrames;sourceTutorialFourthWildFrames=nil;frames?.dispose()
        let preserveScale=sourceTutorialFourthExitAlpha != nil
        retireSourceTutorialFourthExitFade()
        guard restoreSourceTutorialImmediate(unfreezeSmoke:false,hudLocked:engine.state.tutorial?.shouldLockHUD==true,preserveScale:preserveScale),
            restoreSourceTutorialImmediate(unfreezeSmoke:false,hudLocked:engine.state.tutorial?.shouldLockHUD==true,preserveScale:preserveScale),
            let scope=sourceTutorialScope,scope.current else{return false}
        return sourceTutorialHUD?.stop(random:{[scope] in scope.mathRandom.next()},hudLocked:engine.state.tutorial?.shouldLockHUD==true,
            isLockedControl:{[weak self] in $0 === self?.closeButton || $0.name=="native-game-help"},
            cleanupSmoke:{[weak self] in self?.sourceTutorialMeterHUD?.stopSmoke()}) != false
    }
    func failSourceTutorialFourthPresentation(_ reason:String,generation:UInt64){
        guard sourceAnimationBindingAdmissionOpen,engine.state.generation==generation,
            sourceTutorialThirdPresentationActive,let scope=sourceTutorialScope,scope.current else{return}
        onSourcePresentationFailure?(reason,generation)
    }
    func finishSourceTutorialPresentation(){
        retireSourceTutorialFourthExitFade()
        sourceTutorialThirdPresentationActive=false
        let restore=sourceTutorialBoardRestore;sourceTutorialBoardRestore=nil;restore?.dispose()
        retireSourceTutorialHUD()
        sourceTutorialSetMeterSmokeFrozen(false)
    }
    @discardableResult func repairSourceTutorialSecondStep()->Bool{sourceTutorialSecondPreparation?.repair()==true}
    private func retireSourceTutorialHUD(){let old=sourceTutorialHUD;sourceTutorialHUD=nil;old?.dispose()}
    private func sourceTutorialOwns(_ node:NativeDiceNode)->Bool {
        (sourceTutorialCurrent(sourceTutorialEpoch) && sourceTutorialPreparation?.owns(node)==true && engine.state.tiles.first(where:{$0.id==node.tileID})?.value==node.value) || (sourceTutorialSecondPreparation?.owns(node)==true && engine.state.tiles.first(where:{$0.id==node.tileID})?.value==node.value) || sourceTutorialBoardRestore?.owns(node)==true
    }
    private func retireSourceTutorialActivation() {
        retireSourceTutorialFourthExitFade()
        let fourthFocus=sourceTutorialFourthFocus;sourceTutorialFourthFocus=nil;fourthFocus?.dispose()
        let fourthFrames=sourceTutorialFourthWildFrames;sourceTutorialFourthWildFrames=nil;fourthFrames?.dispose()
        let retirePresentation=sourceTutorialFirstStepPresentationActive || sourceTutorialSecondPreparation != nil || sourceTutorialThirdPresentationActive
        sourceTutorialSecondPresentationActive=false;sourceTutorialThirdPresentationActive=false
        sourceTutorialObjectOrder.removeAll();sourceTutorialBoardRestore?.dispose();sourceTutorialBoardRestore=nil
        sourceTutorialEpoch &+= 1
        sourceTutorialFirstStepPresentationActive=false
        let second=sourceTutorialSecondPreparation;sourceTutorialSecondPreparation=nil;second?.dispose()
        if let barrier=engine.pendingSourceTutorialPresentationBarrier{_=engine.retireSourceTutorialPresentationBarrier(barrier)}
        let activation=sourceTutorialActivation,preparation=sourceTutorialPreparation,receipt=sourceTutorialReceipt
        sourceTutorialActivation=nil;sourceTutorialPreparation=nil;sourceTutorialScope=nil;sourceTutorialReceipt=nil
        activation?.dispose();preparation?.dispose()
        if retirePresentation{onSourceTutorialRetired?()}
        if let receipt{_=engine.cancelSourceTutorialDemoActivation(receiptID:receipt.id,generation:receipt.generation)}
    }
    private func retireSourceBoardEntry() {
        let warmup=sourceSmokePoolWarmup;sourceSmokePoolWarmup=nil;warmup?.dispose()
        retireSourceTutorialHUD()
        retireSourceTutorialActivation()
        retireSourceTutorialMeterHUD()
        sourceBoardEntryEpoch &+= 1
        let captured=sourceBoardEntryOwner;sourceBoardEntryOwner=nil
        sourceBoardEntryNodes.removeAll();completedSourceBoardEntry=nil
        sourceBoardEntryScope=nil;sourceBoardEntrySound=nil;sourceBoardEntryCompleted=nil
        if captured != nil {entryInProgress=false;entryOwners=0;inputAdmitted=false}
        captured?.retire() // Paint-preserving route retirement, not abort settle.
    }
    // One finite tutorial focus lease; the real meter stays in its existing HUD.
    var onTutorialSpecialBarSettled:(()->Void)? {didSet {if onTutorialSpecialBarSettled != nil {requestRendering(true)}}}
    private var tutorialSpecialBarFocus:[(SKNode,CGFloat,ObjectIdentifier?)]=[]
    var onTutorialSpecialBarInteraction:((NativeTile)->Bool)?
    var onTutorialSpecialBarFocusProgress:((Double)->Void)?
    private var tutorialSpecialBarFocusProgress=1.0
    var tutorialSpecialBarFocusValue:Double{tutorialSpecialBarFocusProgress}
    private var tutorialSpecialBarFocusCancel:(()->Void)?
    private var tutorialSpecialBarIdleWasActive=false
    private func tutorialSpecialBarTargets()->[SKNode] {
        let outside=children.filter{$0 !== canvasRoot && $0 !== hud}
        let board=canvasRoot.children.filter{$0 !== hud}
        let controls=hud.children.filter{$0.name != "wildLoader" && $0.name != "wild-meter-smoke" && $0 !== meter && $0 !== meterBackground}
        return outside + board + controls
    }
    private func applyTutorialSpecialBarFocus() {
        guard !tutorialSpecialBarFocus.isEmpty else{return}
        let known=Set(tutorialSpecialBarFocus.map{ObjectIdentifier($0.0)})
        for node in tutorialSpecialBarTargets() where !known.contains(ObjectIdentifier(node)) {
            tutorialSpecialBarFocus.append((node,node.alpha,node.parent.map(ObjectIdentifier.init)))
        }
        for (node,alpha,parent) in tutorialSpecialBarFocus where node.parent.map(ObjectIdentifier.init)==parent {
            node.alpha=alpha+(min(alpha,0.2)-alpha)*CGFloat(tutorialSpecialBarFocusProgress)
        }
    }
    var tutorialSpecialBarSettled:Bool {
        !disposed && !suspended && !sourceDisposalInProgress && !entryInProgress &&
        draggedID == nil && !engine.isDragging && visualOwners == 0 &&
        !navigationLocked && !sourceNoMovesCandidateActive &&
        !engine.flags.isWaiting && !engine.hasUnsavableSourceGameplayState &&
        engine.pendingHUDStars.isEmpty && engine.pendingMeterRewards.isEmpty &&
        engine.state.terminal == nil && pendingTerminal == nil &&
        !engine.state.activeTiles.contains { tile in
            guard let node=nodesByID[tile.id] else{return true}
            let owners=node.sourceOuterOwners
            return owners.snapBack || owners.mergeImpact || owners.isBeingSpawned || owners.pendingRemoval ||
                owners.beingRemoved || owners.cleanupQueued || owners.wildSpawnDropping
        }
    }
    @discardableResult func showTutorialSpecialBarFocus()->Bool {
        guard tutorialSpecialBarFocus.isEmpty,tutorialSpecialBarSettled else{return false}
        // Stop the original board idle owner and its admitted white smoke.
        tutorialSpecialBarIdleWasActive=sourceRegularIdleOwner?.active==true
        stopSourceRegularIdle();sourceRegularIdleScope?.smoke.cleanup(tag:"tile-idle-smoke")
        // HUD is nested in canvasRoot; dim its siblings, never the meter's ancestor.
        tutorialSpecialBarFocus=tutorialSpecialBarTargets().map{($0,$0.alpha,$0.parent.map(ObjectIdentifier.init))}
        tutorialSpecialBarFocusProgress=0
        if let service=sourceTutorialScope?.service {
            tutorialSpecialBarFocusCancel=NativeWildMeterSourceDriver(service:service).start(duration:0.42,paint:{[weak self] seconds in
                guard let self,!self.tutorialSpecialBarFocus.isEmpty else{return}
                self.tutorialSpecialBarFocusProgress=sin(min(1,max(0,seconds/0.42))*Double.pi/2)
                self.applyTutorialSpecialBarFocus();self.onTutorialSpecialBarFocusProgress?(self.tutorialSpecialBarFocusProgress)
            },completed:{[weak self] in self?.tutorialSpecialBarFocusCancel=nil},interrupted:{[weak self] in self?.tutorialSpecialBarFocusCancel=nil})
        }
        if tutorialSpecialBarFocusCancel==nil {tutorialSpecialBarFocusProgress=1;applyTutorialSpecialBarFocus()}
        sourceTutorialMeterHUD?.startTutorialPulse()
        requestRendering(true);return true
    }
    func beginTutorialSpecialBarFocusExit() {
        guard !tutorialSpecialBarFocus.isEmpty else{return}
        sourceTutorialMeterHUD?.stopTutorialPulse()
        let cancel=tutorialSpecialBarFocusCancel;tutorialSpecialBarFocusCancel=nil;cancel?()
        guard let service=sourceTutorialScope?.service else{return}
        let from=tutorialSpecialBarFocusProgress
        tutorialSpecialBarFocusCancel=NativeWildMeterSourceDriver(service:service).start(duration:0.28,paint:{[weak self] seconds in
            guard let self,!self.tutorialSpecialBarFocus.isEmpty else{return}
            self.tutorialSpecialBarFocusProgress=from*(1-pow(min(1,max(0,seconds/0.28)),3))
            self.applyTutorialSpecialBarFocus();self.onTutorialSpecialBarFocusProgress?(self.tutorialSpecialBarFocusProgress)
        },completed:{[weak self] in self?.tutorialSpecialBarFocusCancel=nil},interrupted:{[weak self] in self?.tutorialSpecialBarFocusCancel=nil})
    }
    func restoreTutorialSpecialBarFocus() {
        onTutorialSpecialBarInteraction=nil
        sourceTutorialMeterHUD?.stopTutorialPulse()
        let cancel=tutorialSpecialBarFocusCancel;tutorialSpecialBarFocusCancel=nil;cancel?()
        onTutorialSpecialBarFocusProgress?(0);onTutorialSpecialBarFocusProgress=nil
        guard !tutorialSpecialBarFocus.isEmpty else{return}
        let captured=tutorialSpecialBarFocus;tutorialSpecialBarFocus=[]
        let resumeIdle=tutorialSpecialBarIdleWasActive;tutorialSpecialBarIdleWasActive=false
        if resumeIdle,!disposed,!sourceDisposalInProgress,!exitInProgress{_=restartSourceRegularIdle()}
        for (node,alpha,parent) in captured where node.parent.map(ObjectIdentifier.init) == parent {node.alpha=alpha}
        if !disposed && !sourceDisposalInProgress {requestRendering(true)}
    }
    private let textures: NativeBoardTextures
    private let closeStageFont:UIFont
    private var closeButton:NativeHUDCloseNode?
    private let fontName: String
    private let finaleFontName: String
    private var nodesByID: [String: NativeDiceNode] = [:]
    private let canvasRoot:SKNode
    private var sourceInitialConstruction:NativeSourceInitialBoardConstruction?
    private var sourceInitialEntryPending=false
    private var sourceInitialStartupRejected=false
    var sourceInitialStartupReady:Bool {!sourceInitialStartupRejected && (sourceInitialConstruction == nil || sourceInitialConstruction?.isCurrent==true)}
    private let ghosts = SKNode()
    private var ghostNodesByCell:[NativeCell:SKSpriteNode]=[:]
    private let hud = SKNode()
    private let dragTrail=NativeDragTrail()
    private var sourceDragTrailRelease:(()->Void)?
    private let effects = SKNode()
    private let hudStarFlights = SKNode()
    private var hudStarNodes:[String:SKNode]=[:]
    private var hudStarIDs = Set<String>()
    private var meterTimeoutIDs=Set<String>()
    private var hudStarVisualReceipts: [String:UInt64] = [:]
    private let score = SKLabelNode()
    private let scoreArt = SKSpriteNode()
    private let comboArt = SKSpriteNode()
    private let comboArtImage = SKSpriteNode()
    private lazy var comboHUDMotion = NativeComboHUDMotion(artwork:comboArtImage)
    private let comboX = SKLabelNode()
    private let comboNumber = SKLabelNode()
    private lazy var comboNumberMotion = NativeComboNumberMotion(number:comboNumber)
    private var scoreHitRect = CGRect.zero
    private var comboHitRect = CGRect.zero
    private let roundIndicator: NativeRoundIndicator
    private let noMoves = SKLabelNode()
    private let meter = SKShapeNode()
    private let meterBackground = SKShapeNode()
    private let hover = SKShapeNode()
    private var hoverTargetID: String?
    private var hoverVisualTargetID: String?
    private var hoverGeometryKey:CGSize?
    private var dragHoverCadence=NativeDragHoverCadence()
    private var geometry: NativeBoardGeometry?
    var boardGeometry: NativeBoardGeometry? { geometry }
    private var safeInsets = UIEdgeInsets.zero
    private var activeTouch: UITouch?
    private var sourceDragMoves:NativeSourceDragMoveQueue?
    private var sourceDragTransport:NativeSourceAnimationClockService.DirectManipulationTransportLease?
    private var sourceRendererDragTransport:NativeSourceAnimationClockService.RendererDragTransportLease?
    private var draggedID: String?
    private var dragMoved = false
    private var fingerOffset = CGPoint.zero
    private var touchStart = CGPoint.zero
    private var lastTouchPoint = CGPoint.zero
    private var lastPointerTime:TimeInterval=0
    private var pointerVelocity=CGPoint.zero
    private var lastFrame: TimeInterval?
    private var lastGeneration: UInt64?
    private var terminalPresentedGeneration: UInt64?
    private var pendingTerminal: NativeResolution?
    private var pendingTerminalGeneration: UInt64?
    private var visualLifetime: UInt64 = 0
    private var visualOwners = 0
    private var ordinaryAbsorbs:[String:(SKNode,UInt64)] = [:]
    private var ordinaryPostchecks=Set<String>()
    // PRIVATE canonical save endpoint. No generic state-change debounce.
    private var sourceCanonicalSaveBinding:NativeSourceCanonicalSaveOwner<NativeBoardState>.Binding?
    private var sourceCanonicalSaveEpoch:UInt64=0
    @discardableResult func configureSourceCanonicalSave(scope:NativeGameplaySourceContext.Scope,binding:NativeSourceCanonicalSaveOwner<NativeBoardState>.Binding)->Bool {
        guard sourceAnimationBindingAdmissionOpen else{return false}
        sourceCanonicalSaveEpoch &+= 1;let e=sourceCanonicalSaveEpoch
        let initialScope=scope.current
        guard initialScope,sourceAnimationBindingAdmissionOpen,sourceCanonicalSaveEpoch==e else{return false}
        let initialBinding=binding.current
        guard initialBinding,sourceAnimationBindingAdmissionOpen,sourceCanonicalSaveEpoch==e else{return false}
        let previous=sourceCanonicalSaveBinding;sourceCanonicalSaveBinding=nil;previous?.retire()
        let scopeReady=scope.current
        guard scopeReady,sourceAnimationBindingAdmissionOpen,sourceCanonicalSaveEpoch==e,sourceCanonicalSaveBinding==nil else{return false}
        let saveReady=binding.current
        guard saveReady,sourceAnimationBindingAdmissionOpen,sourceCanonicalSaveEpoch==e,sourceCanonicalSaveBinding==nil else{return false}
        sourceCanonicalSaveBinding=binding;sourceDisposalSealingEnabled=true;return true
    }
    func scheduleSourceCanonicalSaveWall(milliseconds:Int,generation:UInt64,elapsed:@escaping()->Void)->(()->Void)? {
        guard sourceAnimationBindingAdmissionOpen,engine.state.generation==generation else{return nil}
        let receipt=sourceAppTimeouts.schedule(sourceID:"source-canonical-game-save",generation:generation,delayMilliseconds:milliseconds,elapsed:elapsed)
        return{[weak self] in _=self?.sourceAppTimeouts.cancel(receipt)}
    }
    private func retireSourceCanonicalSave() {
        sourceCanonicalSaveEpoch &+= 1;let captured=sourceCanonicalSaveBinding;sourceCanonicalSaveBinding=nil;captured?.retire()
    }
    // PRIVATE Source NO MOVES splice. Defaults OFF; owners are mandatory.
    var sourceNoMovesPresentationEnabled=false
    var sourceNoMovesRuntimeAuthorityEnabled=false
    private var sourceNoMovesCallerInvocationBound=false
    private var sourceNoMovesOwnedRuntimeAuthority:NativeSourceNoMovesRuntimeAuthority?
    var sourceNoMovesDepletedCallersEnabled=false
    private var sourceNoMovesCallerAdmission:NativeSourceNoMovesCallerAdmission?
    private var sourceNoMovesCallerFlow:NativeSourceNoMovesDepletedCallerFlow?
    private var sourceNoMovesCallerCompletion:NativeSourceNoMovesCallerCompletionBinding?
    private var sourceNoMovesCallerReplies:[String:(UUID,()->Void)]=[:]
    private var sourceNoMovesCallerEpoch:UInt64=0
    var sourceOrdinaryPreDebitPresentationEnabled=false
    private var sourceOrdinaryPreDebitEpoch:UInt64=0
    private var sourceOrdinaryPreDebitFlow:NativeSourceOrdinaryPreDebitFlow?
    private var sourceOrdinaryPreDebitAdmission:NativeSourceOrdinaryPreDebitAdmission?
    private var sourceOrdinaryPreDebitBindings:NativeSourceOrdinaryPreDebitBindings?
    private var sourcePreDebitDeferredMain:Set<String>=[]
    private struct SourcePreDebitContact {
        let source:NativeDiceNode,destination:NativeDiceNode
        let sourceSpecial:String?,destinationSpecial:String?,effectiveSum:Int
        let visibleBefore:Int,physicalBefore:Int,bothCapturedActive:Bool
        let generation:UInt64,epoch:UInt64
    }
    private var sourcePreDebitContacts:[String:SourcePreDebitContact]=[:]
    private var sourcePreDebitMain:[String:NativeSourcePostcheckMainCapture]=[:]
    private var sourcePreDebitRequests:[String:NativeSourceOrdinaryPreDebitReceipt]=[:]

    private var sourceNoMovesBridge:NativeSourceNoMovesSceneBridge?
    private var sourceNoMovesTerminalRegistry:NativeSourceNoMovesTerminalRegistryEndpoint?
    private var sourceNoMovesBindings:NativeSourceNoMovesSceneBindings?
    private var sourceNoMovesGeneration:UInt64?
    private var sourceNoMovesConfigurationEpoch:UInt64=0
    private var sourceNoMovesRetirement:(()->Void)?
    private var sourceNoMovesDestroyed=false
    var sourceNoMovesCandidateActive:Bool {sourceNoMovesBridge?.hasActiveCandidate == true}
    @discardableResult
    func configureSourceNoMoves(bindings:NativeSourceNoMovesSceneBindings,
        showText:@escaping(NativeNoMovesCandidateOwner.Plan,UInt64)->Void,
        beginTextExit:@escaping(UInt64,@escaping(Bool)->Void)->Void,
        clearText:@escaping()->Void,
        confirmedBoardExit:@escaping(UInt64,@escaping(Bool)->Void)->Void,
        terminalRegistry:NativeSourceNoMovesTerminalRegistryEndpoint?=nil,
        callerInvocationReceiptBound:Bool=false)->Bool {
        guard sourceAnimationBindingAdmissionOpen,!sourceNoMovesDestroyed,sourceNoMovesPresentationEnabled,engine.stagedSourceNoMoves,
            !sourceNoMovesCandidateActive else{return false}
        sourceDisposalSealingEnabled=true
        let expectedEpoch=sourceNoMovesConfigurationEpoch &+ 1
        retireSourceNoMoves()
        guard sourceAnimationBindingAdmissionOpen,sourceNoMovesConfigurationEpoch==expectedEpoch,
            sourceNoMovesPresentationEnabled,engine.stagedSourceNoMoves else{return false}
        let generation=engine.state.generation
        let priorRuntimeAuthority=engine.sourceNoMovesRuntimeAuthority
        let admitted=bindings.admitted(generation)
        guard admitted,sourceAnimationBindingAdmissionOpen,sourceNoMovesConfigurationEpoch==expectedEpoch,
            engine.state.generation==generation,sourceNoMovesPresentationEnabled,engine.stagedSourceNoMoves else{return false}
        let authority=sourceNoMovesRuntimeAuthorityEnabled ? bindings.runtimeAuthority:nil
        if sourceNoMovesRuntimeAuthorityEnabled {
            guard engine.sourceNoMovesRuntimeAuthority === priorRuntimeAuthority,let authority else{return false}
            let current=authority.isCurrent()
            guard current,engine.sourceNoMovesRuntimeAuthority === priorRuntimeAuthority,sourceNoMovesRuntimeAuthorityEnabled,sourceAnimationBindingAdmissionOpen,sourceNoMovesConfigurationEpoch==expectedEpoch,
                engine.state.generation==generation,sourceNoMovesPresentationEnabled,engine.stagedSourceNoMoves else{return false}
        }
        sourceNoMovesBindings=bindings;sourceNoMovesGeneration=generation
        let bridge=NativeSourceNoMovesSceneBridge(engine:engine,hooks:.init(
            current:{[weak self] gen in
                guard let self,self.sourceAnimationBindingAdmissionOpen,self.engine.state.generation==gen,
                    self.sourceNoMovesGeneration==gen,self.sourceNoMovesConfigurationEpoch==expectedEpoch,
                    terminalRegistry?.current ?? true else{return false}
                let accepted=bindings.admitted(gen)
                return self.sourceAnimationBindingAdmissionOpen && self.sourceNoMovesGeneration==gen && self.sourceNoMovesConfigurationEpoch==expectedEpoch && self.engine.state.generation==gen && accepted && (terminalRegistry?.current ?? true)
            },refreshSourceRuntime:bindings.refreshRuntime,
            appWait:{[weak self] key,gen,ms,elapsed,cancelled in
                guard let self,self.sourceAnimationBindingAdmissionOpen,self.sourceNoMovesGeneration==gen else{return}
                self.sourceAppTimeouts.schedule(sourceID:key,generation:gen,delayMilliseconds:ms,elapsed:elapsed,cancelled:cancelled)
            },navigation:{[weak self] value in self?.navigationLocked=value},
            stopIdleAndIdleSmoke:bindings.stopIdleAndIdleSmoke,persistStuckState:bindings.persistStuckState,
            resetHint:bindings.resetHint,showText:showText,beginTextExit:beginTextExit,clearText:clearText,
            terminalFields:{active,ttl in
                if let terminalRegistry {_ = terminalRegistry.terminalFields(active:active,ttlMilliseconds:ttl,observer:bindings.terminalFields)}
                else {bindings.terminalFields(active,ttl)}
            },restartIdle:bindings.restartIdle,
            queueGuardRelease:bindings.queueGuardRelease,scheduleGSAPRecheck:bindings.scheduleGSAPRecheck,
            confirmedBoardExit:confirmedBoardExit,confirmedResult:{[weak self] result in
                guard let self,self.sourceAnimationBindingAdmissionOpen,self.engine.state.generation==generation else{return}
                self.consume(result,previous:self.engine.state)
            },exitFailure:bindings.exitFailure))
        sourceNoMovesRetirement=clearText
        sourceNoMovesTerminalRegistry=terminalRegistry
        sourceNoMovesBridge=bridge
        if let authority {
            guard sourceAnimationBindingAdmissionOpen,sourceNoMovesBridge === bridge,
                sourceNoMovesConfigurationEpoch==expectedEpoch,engine.state.generation==generation else{return false}
            let bound:()->Bool = {[weak self,weak bridge] in
                guard let self,let bridge else{return false}
                return self.sourceAnimationBindingAdmissionOpen && self.sourceNoMovesRuntimeAuthorityEnabled &&
                    self.sourceNoMovesBridge === bridge && self.sourceNoMovesConfigurationEpoch==expectedEpoch &&
                    self.sourceNoMovesOwnedRuntimeAuthority != nil &&
                    self.engine.sourceNoMovesRuntimeAuthority === self.sourceNoMovesOwnedRuntimeAuthority &&
                    self.sourceNoMovesGeneration==generation && self.engine.state.generation==generation
            }
            let captured=NativeSourceNoMovesRuntimeAuthority(isCurrent:{
                guard bound() else{return false};let accepted=authority.isCurrent();return accepted && bound()
            },capture:{
                guard bound() else{return nil};let result=authority.capture();return bound() ? result:nil
            })
            sourceNoMovesOwnedRuntimeAuthority=captured;engine.sourceNoMovesRuntimeAuthority=captured
        }
        sourceNoMovesCallerInvocationBound=callerInvocationReceiptBound
        bridge.enabled=true;return true
    }
    /// The VC has received true from configure. Confirm only that exact captured
    /// publication; an unconfirmed endpoint deliberately refuses candidate use.
    @discardableResult func confirmSourceNoMovesTerminalRegistry(_ endpoint:NativeSourceNoMovesTerminalRegistryEndpoint)->Bool {
        guard sourceAnimationBindingAdmissionOpen,sourceNoMovesTerminalRegistry === endpoint,
            let bridge=sourceNoMovesBridge,let generation=sourceNoMovesGeneration else{return false}
        let epoch=sourceNoMovesConfigurationEpoch
        let accepted=endpoint.confirmPublication(current:{[weak self,weak bridge,weak endpoint] in
            guard let self,let bridge,let endpoint else{return false}
            return self.sourceAnimationBindingAdmissionOpen && self.sourceNoMovesBridge === bridge &&
                self.sourceNoMovesTerminalRegistry === endpoint && self.sourceNoMovesGeneration==generation &&
                self.sourceNoMovesConfigurationEpoch==epoch && self.engine.state.generation==generation
        })
        return accepted && sourceAnimationBindingAdmissionOpen && sourceNoMovesBridge === bridge &&
            sourceNoMovesTerminalRegistry === endpoint && sourceNoMovesConfigurationEpoch==epoch && engine.state.generation==generation
    }
    /// Captured owner removal never retires a replacement bridge C.
    @discardableResult func retireSourceNoMovesTerminalRegistry(_ endpoint:NativeSourceNoMovesTerminalRegistryEndpoint)->Bool {
        guard sourceNoMovesTerminalRegistry === endpoint else{return false}
        retireSourceNoMoves();return true
    }
    func makeSourceCompleteNoMovesBindings(scope:NativeGameplaySourceContext.Scope,persist:@escaping()->Void,
        visibleCue:@escaping(UInt64,UInt64)->Void)->NativeSourceNoMovesSceneBindings? {
        guard let authority=makeSourceNoMovesRuntimeAuthority(scope:scope),scope.current else{return nil}
        let generation=engine.state.generation
        let current:()->Bool = {[weak self,weak scope] in guard let self,let scope else{return false};return self.sourceAnimationBindingAdmissionOpen && scope.current && self.engine.state.generation==generation && !self.exitInProgress}
        return .init(runtimeAuthority:authority,visibleShowCue:visibleCue,admitted:{gen in gen==generation && current()},
            refreshRuntime:{[weak self] in guard current(),let self else{return};_=self.captureSourcePhysicalBoard()},
            ordinaryCallerReady:{[weak self] id,gen in guard current(),let self else{return false};return self.engine.pendingOrdinaryPostchecks.contains{$0.id==id && $0.generation==gen}},
            levelEndPreflight:{[weak self] in self?.sourceLevelEndConfirmedPreflight()},
            stopIdleAndIdleSmoke:{[weak self,weak scope] in guard current() else{return};self?.stopSourceRegularIdle();scope?.smoke.cleanup(tag:"tile-idle-smoke")},
            restartIdle:{[weak self] in guard current() else{return};_=self?.restartSourceRegularIdle()},persistStuckState:persist,
            resetHint:{[weak self] in self?.onEndgameHintEvaluation?(NativeResolution(.wait,reason:"no_moves_hint_reset"))},
            terminalFields:{[weak self] active,_ in guard current() else{return};self?.navigationLocked=active},
            queueGuardRelease:{[weak self] _ in guard current() else{return};self?.requestSourceMeterQueueAfterGuardRelease(scope:scope,generation:generation)},
            scheduleGSAPRecheck:{[weak self] ms,_ in guard current() else{return};if let self {_=self.scheduleSourceLevelEndGSAP(scope:scope,milliseconds:ms,elapsed:{[weak self] in self?.evaluate()},cancelled:{})}},
            exitFailure:{[weak self] in guard current() else{return};self?.onSourcePresentationFailure?("source_no_moves_exit_failed",generation)})
    }
    private func sourceLevelEndConfirmedPreflight()->NativeSourceNoMovesLevelEndPreflight? {
        guard let signature=sourceLevelEndCaller?.confirmedSignature,
            captureSourceLevelEndSignature()?.key==signature else{return nil}
        return .init(generation:engine.state.generation,signature:engine.sourceGameplaySignature.key,
            stableStuckRechecksCompleted:true,tutorialRescueDeclined:true,recentTntMutationRecheckCompleted:true,sourceCallerWaitsCompleted:true,extraWaitMilliseconds:0)
    }
    @discardableResult func configureSourceCompleteNoMovesCallers(scope:NativeGameplaySourceContext.Scope)->Bool {
        guard scope.current,let authority=engine.sourceNoMovesRuntimeAuthority else{return false}
        let generation=engine.state.generation
        let current:()->Bool = {[weak self,weak scope] in guard let self,let scope else{return false};return self.sourceAnimationBindingAdmissionOpen && scope.current && self.engine.state.generation==generation && self.engine.sourceNoMovesRuntimeAuthority === authority}
        let fresh:()->NativeSourceNoMovesRuntimeSnapshot?={guard current(),authority.isCurrent() else{return nil};let value=authority.capture();return current() ? value:nil}
        let repair:(String,Bool,@escaping(Bool?)->Void)->Void = {[weak self] reason,single,reply in
            guard let self,current(),let installation=self.sourceMicrotaskInstallation,installation.isCurrent else{reply(nil);return}
            if self.engine.state.tutorial?.completionAssist==true && self.engine.state.tutorial?.done != true {
                self.performSourceTutorialRepair(scope:scope,reason:reason,singleOnly:single,reply:reply)
            } else {_=installation.enqueue{guard current() else{reply(nil);return};reply(false)}}
        }
        let wild:(String)->Bool? = {[weak self] _ in guard let snapshot=fresh() else{return nil};if snapshot.wildContinuationPending {self?.requestSourceMeterQueueAfterGuardRelease(scope:scope,generation:generation)};return snapshot.wildContinuationPending}
        sourceNoMovesDepletedCallersEnabled=true;sourceOrdinaryPreDebitPresentationEnabled=true
        guard configureSourceNoMovesDepletedCallers(.init(kinds:[.ordinaryMovesDepleted,.mergeMovesDepleted],admitted:{gen,_ in gen==generation && current()},busyEnding:{[weak self] in current() ? self?.engine.flags.busyEnding:nil},ensureTutorialSingleTile:{receipt,reply in repair("moves_depleted_single_regular_tile",true,reply)},forceFresh:{_ in
            guard let snapshot=fresh() else{return nil};var state=snapshot.state;state.moves=0
            return NativeSourceEndgameChecker.check(state:state,runtime:snapshot.tiles,endgameGuard:snapshot.endgameGuardActive,nonFinalGuard:snapshot.nonFinalMergeSixGuardActive)
        },resetHint:{[weak self] in self?.sourceNoMovesBindings?.resetHint()},deferWild:wild,tutorialFinalChance:{reason,reply in repair(reason,false,reply)},cleanVisibility:{[weak self] in guard current(),let self else{return nil};guard let host=self.gameplayRenderHost?.renderView,host.window != nil,!host.isHidden,host.alpha>0.01,!self.suspended,!self.exitInProgress,self.isBoardEntryComplete else{return nil};return (false,false)},clean:{[weak self] reason in self?.handleResolution(NativeResolution(.complete,reason:reason))})) else{return false}
        let roster:()->NativeSourcePostcheckRoster? = {[weak self] in guard current(),let self,let board=self.captureSourcePhysicalBoard() else{return nil};var values:[NativeSourcePostcheckTile]=[]
            guard self.scanSourceSynchronousPhysicalBoard(board,current:current,readsExternalOwner:{$0.isSpecial || $0.sourceResidualWildPresence},read:{model,node in
                guard let markers=self.captureSourceGameplayTileMarkers(model.id),let physical=board.tiles[model.id] else{return nil}
                values.append(.init(object:node,id:model.id,value:model.value,depth:model.stackDepth,locked:model.locked,destroyed:markers.destroyed,isWildLike:model.isWild,active:NativeSourceEndgameChecker.active(model,runtime:markers.noMovesRuntime(eventMode:physical.eventMode))))
                return false
            }) != nil else{return nil}
            return .init(tiles:values,moves:board.observedState.moves,complete:true)
        }
        guard configureSourceOrdinaryPreDebit(.init(markerCapabilities:Set(NativeSourceNoMovesRuntimeSnapshot.Capability.allCases),admitted:{gen in gen==generation && current()},captureBefore:roster,stateRoster:roster,reread:{held in guard let captured=roster() else{return nil};return captured.tiles.first{$0.id==held.id && $0.object === held.object}},busyEnding:{[weak self] in current() ? self?.engine.flags.busyEnding:nil},forceFresh:{request in
            guard let snapshot=fresh() else{return nil};var state=snapshot.state;let ids=Set(request.roster.tiles.map(\.id));state.tiles.removeAll{!ids.contains($0.id)};state.moves=request.roster.moves
            return NativeSourceEndgameChecker.check(state:state,runtime:snapshot.tiles,endgameGuard:snapshot.endgameGuardActive,nonFinalGuard:snapshot.nonFinalMergeSixGuardActive)
        },clearEndGameCache:{/* Native forced checker is stateless: no cached result exists. */},resetHint:{[weak self] in self?.sourceNoMovesBindings?.resetHint()},deferStackWild:wild,ensureTutorialSingleTile:{reason,reply in repair(reason,true,reply)},tutorialFinalChance:{reason,reply in repair(reason,false,reply)})) else{return false}
        return configureSourceLevelEndCaller(scope:scope)
    }
    @MainActor private final class SourceLevelEndDelayParticipant:NativeSourceAnimationParticipant {
        func advanceSourceAnimation(seconds:Double) {}
    }
    private var sourceLevelEndDelays:[UUID:(SourceLevelEndDelayParticipant,NativeSourceAnimationClockService.Lease)]=[:]
    private func scheduleSourceLevelEndGSAP(scope:NativeGameplaySourceContext.Scope,milliseconds:Int,
        elapsed:@escaping()->Void,cancelled:@escaping()->Void)->(()->Void) {
        let id=UUID(),participant=SourceLevelEndDelayParticipant()
        guard scope.current,sourceAnimationBindingAdmissionOpen,let lease=scope.service.register(participant:participant,
            duration:Double(max(0,milliseconds))/1000,domain:.sourceGSAP(.defaultLazyTween),cleanup:{[weak self] success in
                guard let self,self.sourceLevelEndDelays.removeValue(forKey:id) != nil else{return}
                if success,scope.current {elapsed()} else{cancelled()}
            }) else{cancelled();return {}}
        sourceLevelEndDelays[id]=(participant,lease)
        return {[weak self] in let held=self?.sourceLevelEndDelays.removeValue(forKey:id);held?.1.cancel()}
    }
    private var sourceMandatoryCellOwner:NativeSourceMandatoryMergeCellOwner?
    private var sourceMandatoryCellWriterID:UUID?
    private var sourceLevelEndCaller:NativeSourceLevelEndCallerFlow?
    private var sourceLevelEndCallerGeneration:UInt64?
    private var sourceStuckWildDeferral=NativeSourceStuckWildDeferral()
    /// Actual Source repair transport may be mounted for active tutorial runs.
    /// Normal completed/no-tutorial policy declines through the actual APP FIFO.
    var sourceLevelEndTutorialRepair:((String,@escaping(Bool?)->Void)->Void)?
    @discardableResult func configureSourceLevelEndCaller(scope:NativeGameplaySourceContext.Scope)->Bool {
        guard sourceAnimationBindingAdmissionOpen,scope.current,sourceEndgameMutationScope === scope,
            let ledger=sourceEndgameMutationBinding,let installation=sourceMicrotaskInstallation,installation.isCurrent,
            sourceLevelEndCaller==nil,engine.sourceNoMovesRuntimeAuthority != nil else{return false}
        let generation=engine.state.generation
        let current:()->Bool = {[weak self,weak scope,weak ledger] in
            guard let self,let scope,let ledger else{return false}
            return self.sourceAnimationBindingAdmissionOpen && !self.exitInProgress && scope.current &&
                self.sourceEndgameMutationBinding === ledger && !ledger.retired &&
                self.engine.state.generation==generation && self.sourceMicrotaskInstallation === installation && installation.isCurrent
        }
        let repair:(String,@escaping(Bool?)->Void)->Void = {[weak self] reason,reply in
            guard let self,current() else{reply(nil);return}
            if let endpoint=self.sourceLevelEndTutorialRepair {endpoint(reason,reply);return}
            // The Source helpers return false before any mutation when no live
            // tutorial completion-assist policy exists. Still await APP reaction.
            let tutorial=self.engine.state.tutorial
            guard tutorial==nil || tutorial?.done==true || tutorial?.completionAssist==false else{
                self.performSourceTutorialRepair(scope:scope,reason:reason,singleOnly:reason.contains("single_regular_tile"),reply:reply);return
            }
            _=installation.enqueue{guard current(),self.engine.state.tutorial==tutorial else{reply(nil);return};reply(false)}
        }
        guard engine.sourceMandatoryMergeCellMutation==nil,engine.sourceMandatoryMergeCellWriterID==nil else{return false}
        let mandatory=NativeSourceMandatoryMergeCellOwner(date:{scope.captureSourceDateMilliseconds() ?? .nan},current:current)
        let mandatoryID=UUID();sourceMandatoryCellOwner=mandatory;sourceMandatoryCellWriterID=mandatoryID
        engine.sourceMandatoryMergeCellWriterID=mandatoryID
        engine.sourceMandatoryMergeCellMutation={[weak self,weak mandatory] owner,generation,cell,began in
            guard let self,let mandatory,current(),self.sourceMandatoryCellOwner === mandatory,
                self.engine.sourceMandatoryMergeCellWriterID==mandatoryID else{return false}
            return began ? mandatory.begin(ownerID:owner,generation:generation,cell:cell):mandatory.verifiedActive(ownerID:owner,generation:generation,cell:cell)
        }
        let flow=NativeSourceLevelEndCallerFlow(hooks:.init(current:current,wait:{[weak self] ms,elapsed,cancelled in
            guard let self,current() else{cancelled();return {}}
            let receipt=self.sourceAppTimeouts.schedule(sourceID:"level-end:"+UUID().uuidString,generation:generation,
                delayMilliseconds:ms,elapsed:elapsed,cancelled:cancelled)
            return {[weak self] in _=self?.sourceAppTimeouts.cancel(receipt)}
        },delayed:{[weak self] ms,elapsed,cancelled in guard let self,current() else{cancelled();return {}};return self.scheduleSourceLevelEndGSAP(scope:scope,milliseconds:ms,elapsed:elapsed,cancelled:cancelled)},preflight:{[weak self] in guard let self,current() else{return nil};return self.sourceLevelEndGate(scope:scope)},
        tutorialSingleTile:{reply in repair("check_level_end_single_regular_tile",reply)},
        physicalSignature:{[weak self] in guard current() else{return nil};return self?.captureSourceLevelEndSignature()?.key},
        writeSignature:{[weak self,weak ledger] key in
            guard let self,let ledger,current(),let captured=self.captureSourceLevelEndSignature(),captured.key==key else{return nil}
            let written=ledger.observeLevelCheckSignature(key,current:current)
            guard let written,current() else{return nil}
            if written,let date=ledger.snapshot?.lastMutationAt,date.isFinite,date>=Double(Int64.min),date<Double(Int64.max) {
                _=self.engine.recordSourceMeterBoardMutation(.checkLevelEndSignatureObserved(captured.signature),generation:generation,sourceDateMilliseconds:Int64(date))
            }
            return current() ? written:nil
        },resolve:{[weak self] in
            guard let self,current(),let authority=self.engine.sourceNoMovesRuntimeAuthority,authority.isCurrent(),
                let snapshot=authority.capture(),current() else{return nil}
            if snapshot.freshResult.kind != .fail {self.sourceStuckWildDeferral.reset()}
            switch snapshot.freshResult.kind {
            case .continue:return .continued
            case .complete:return .clean(snapshot.freshResult.reason)
            case .fail:return .stuck(snapshot.freshResult.reason)
            default:return .wait(250,"resolver-wait")
            }
        },stableRecheck:{[weak self] in guard let self,current() else{return nil};return self.sourceLevelEndGate(scope:scope)},
        stuckAdmission:{[weak self,weak ledger] _ in
            guard let self,let ledger,current() else{return nil}
            self.sourceNoMovesBindings?.resetHint()
            guard current(),let authority=self.engine.sourceNoMovesRuntimeAuthority,authority.isCurrent(),
                let runtime=authority.capture(),current(),let now=scope.captureSourceDateMilliseconds(),current(),
                let wildDecision=self.sourceStuckWildDeferral.decide(pending:runtime.wildContinuationPending,now:now),
                let snapshot=ledger.snapshot else{return nil}
            if wildDecision == .deferFail {
                self.requestSourceMeterQueueAfterGuardRelease(scope:scope,generation:generation)
                return current() ? .retry(350,"stuck-wild-continuation-defer"):nil
            }
            // Source resets after both no-continuation and bounded force-fail,
            // before the lingering-Six/cooldown/stability branch proceeds.
            self.sourceStuckWildDeferral.reset()
            let age=snapshot.lastMutationAt == 0 ? Double.infinity:now-snapshot.lastMutationAt
            if age<700{return .retry(250,"recent-board-mutation-cooldown")}
            // A lingering nonfinal Six needs its genuine repair owner. Refuse
            // instead of converting/removing through the generic Raw resolver.
            if let tile=self.engine.state.tiles.first(where:{$0.value==6 && !$0.locked && $0.gameplayArchetype==nil && !$0.pendingRemoval}) {
                self.performSourceLingeringSixRepair(scope:scope,tileID:tile.id);return .stop
            }
            return .ready
        },tutorialFinalChance:{reason,reply in repair(reason,reply)},finalAdmission:{[weak self] in
            guard let self,current() else{return nil}
            if self.engine.flags.busyEnding {return .retry(350,"busy-ending-during-stuck")}
            guard current(),let now=scope.captureSourceDateMilliseconds(),let dates=scope.captureTntBonusDates() else{return nil}
            let age=dates.lastChangeAt == 0 ? Double.infinity:now-dates.lastChangeAt
            return age<1000 ? .retry(max(120,Int(1000-age)),"recent-tnt-bonus-mutation"):.ready
        },clean:{[weak self] reason,reply in
            guard let self,current() else{reply();return};self.handleResolution(NativeResolution(.complete,reason:reason));reply()
        },noMoves:{[weak self] reply in guard let self,current() else{reply();return};_=self.beginSourceNoMovesFromLevelEndCaller();reply()},
        continued:{[weak self] in guard let self,current() else{return};_=self.sourceCanonicalSaveBinding?.notify(.levelCheckContinue);self.onStateChange?(self.engine.state)}))
        guard current() else{flow.dispose();return false}
        sourceLevelEndCaller=flow;sourceLevelEndCallerGeneration=generation
        guard ledger.connectLevelCheckWriter(current:{[weak self] in current() && self?.sourceLevelEndCaller === flow}) else{sourceLevelEndCaller=nil;sourceLevelEndCallerGeneration=nil;flow.dispose();return false}
        return true
    }
    private func performSourceMandatoryCellRepair(scope:NativeGameplaySourceContext.Scope,owner:NativeSourceMandatoryMergeCellOwner,
        claim:NativeSourceMandatoryMergeCellOwner.Claim) {
        let generation=claim.generation
        let current:()->Bool = {[weak self,weak owner] in
            guard let self,let owner else{return false}
            return scope.current && self.engine.state.generation==generation &&
                self.sourceMandatoryCellOwner === owner && owner.pending==claim
        }
        // nil is actual retirement/cancellation. Only a current failed repair
        // releases the matching mandatory claim, as Source's false Promise does.
        func construct()->NativeDiceNode? {
            guard current() else{return nil}
            let before=engine.state
            guard let begun=engine.beginSourceMandatoryCellRepair(cell:claim.cell,generation:generation),
                let holder=begun.state.tiles.first(where:{$0.cell==claim.cell && $0.locked && $0.value==0}),current() else{return nil}
            for old in before.tiles where old.cell==claim.cell {if let node=nodesByID.removeValue(forKey:old.id){node.dispose()}}
            guard current(),let node=constructSourceOrdinaryZeroHolder(tile:holder,generation:generation),current() else{return nil}
            sourceOrdinaryPreconstructedIDs.insert(holder.id)
            guard let result=engine.openSourceLingeringSixRepair(tileID:holder.id,generation:generation),current(),
                prepareSourceOrdinaryFreshOpenFace(result,id:holder.id,generation:generation),current() else{return nil}
            synchronize();return current() ? node:nil
        }
        func confirmed(){
            guard current() else{return}
            if let board=captureSourcePhysicalBoard(),board.isStillCurrent(),
                board.observedState.tiles.contains(where:{tile in
                    guard tile.cell==claim.cell,let physical=board.tiles[tile.id],let markers=captureSourceGameplayTileMarkers(tile.id) else{return false}
                    return NativeSourceEndgameChecker.active(tile,runtime:markers.noMovesRuntime(eventMode:physical.eventMode))
                }),board.isStillCurrent(),current() {_=owner.verifiedActive(claim)}
            evaluate()
        }
        if let node=construct(),current(),startSourceOrdinaryOpenBounce(node,timeScale:2,completed:confirmed){
            onStateChange?(engine.state);return
        }
        guard current() else{return}
        // Source hardFallbackSpawnAtCell creates a SECOND fresh zero, then
        // performs the ordinary replacement bounce without awaiting it. Its
        // options equal this authored owner at timeScale1 (.30/1.08/.96/1.02,
        // wiggle .035, full opacity), rather than the normal repair's scale2.
        if let node=construct(),current(),startSourceOrdinaryOpenBounce(node,timeScale:1,completed:{}) {
            onStateChange?(engine.state);confirmed();return
        }
        guard current(),owner.repairFailed(claim) else{return}
        evaluate()
    }
    private func performSourceLingeringSixRepair(scope:NativeGameplaySourceContext.Scope,tileID:String) {
        let generation=engine.state.generation
        guard scope.current,let begun=engine.beginSourceLingeringSixRepair(tileID:tileID,generation:generation),
            let holder=begun.state.tiles.first(where:{$0.value==0 && $0.locked && !nodesByID.keys.contains($0.id)}) else{return}
        guard let mandatory=sourceMandatoryCellOwner,mandatory.begin(ownerID:"lingering-repair:"+holder.id,generation:generation,cell:holder.cell) else{return}
        if let old=nodesByID.removeValue(forKey:tileID){old.dispose()}
        guard let node=constructSourceOrdinaryZeroHolder(tile:holder,generation:generation) else{return}
        sourceOrdinaryPreconstructedIDs.insert(holder.id)
        guard let result=engine.openSourceLingeringSixRepair(tileID:holder.id,generation:generation),
            prepareSourceOrdinaryFreshOpenFace(result,id:holder.id,generation:generation) else{return}
        synchronize()
        _=startSourceOrdinaryOpenBounce(node,timeScale:2,completed:{[weak self] in
            guard let self,scope.current,self.engine.state.generation==generation else{return}
            _=self.sourceAppTimeouts.schedule(sourceID:"lingering-repair140:"+UUID().uuidString,generation:generation,delayMilliseconds:140,elapsed:{[weak self] in self?.evaluate()})
        })
        onStateChange?(engine.state)
    }
    private func performSourceTutorialRepair(scope:NativeGameplaySourceContext.Scope,reason:String,singleOnly:Bool,reply:@escaping(Bool?)->Void) {
        guard sourceAnimationBindingAdmissionOpen,scope.current,let board=captureSourcePhysicalBoard(),board.isStillCurrent(),
            let six=captureSourceMergeSixSpawnInProgress(),let drop=captureSourceWildDropActiveCount(),
            let pull=captureSourceMagnetPullInProgress(scope:scope),let installation=sourceMicrotaskInstallation,installation.isCurrent else{reply(nil);return}
        if !singleOnly {sourceNoMovesBindings?.resetHint()}
        let before=engine.state,generation=before.generation
        let result=engine.beginSourceTutorialRepair(physical:board.observedState,singleOnly:singleOnly,blocked:six || drop>0 || pull)
        guard let result else{
            // preventTutorialFailWithFinalChance always suppresses failure while
            // assist is enabled, even when the exact spawn is unavailable.
            _=installation.enqueue{[weak self] in guard let self,scope.current,self.engine.state.generation==generation else{reply(nil);return}
                if !singleOnly {self.scheduleSourceLevelEndRetry(350)};reply(!singleOnly)
            };return
        }
        guard let tile=result.state.tiles.first(where:{new in !before.tiles.contains(where:{$0.id==new.id})}) else{reply(nil);return}
        for old in before.tiles where old.cell==tile.cell {if let node=nodesByID.removeValue(forKey:old.id){node.dispose()}}
        guard prepareSourceOrdinaryFreshOpenFace(result,id:tile.id,generation:generation),let node=nodesByID[tile.id] else{
            _=engine.rollbackSourceTutorialRepair(generation:generation,tileID:tile.id);reply(nil);return
        }
        synchronize()
        guard startSourceOrdinaryOpenBounce(node,timeScale:2,completed:{[weak self] in
            guard let self,self.sourceAnimationBindingAdmissionOpen,scope.current,self.engine.state.generation==generation else{reply(nil);return}
            _=self.sourceAppTimeouts.schedule(sourceID:"tutorial-repair140:"+UUID().uuidString,generation:generation,delayMilliseconds:140,elapsed:{[weak self] in
                guard let self,scope.current,self.engine.state.generation==generation else{reply(nil);return}
                self.scheduleSourceLevelEndRetry(120);_=installation.enqueue{reply(true)}
            },cancelled:{reply(false)})
        }) else{_=engine.rollbackSourceTutorialRepair(generation:generation,tileID:tile.id);reply(nil);return}
        onStateChange?(engine.state)
    }
    private func scheduleSourceLevelEndRetry(_ ms:Int) {
        let generation=engine.state.generation
        _=sourceAppTimeouts.schedule(sourceID:"level-end-retry:"+UUID().uuidString,generation:generation,delayMilliseconds:ms,elapsed:{[weak self] in
            guard let self,self.engine.state.generation==generation else{return};self.evaluate()
        })
    }
    func sourceLevelEndDiagnostic()->String {
        let gate=sourceSixScope.map { "registry=\(String(describing:$0.registries.snapshot(isWild:false)));dates=\(String(describing:$0.captureTntBonusDates()))" } ?? "no-scope"
        let board=captureSourcePhysicalBoard()
        let markers=board?.tiles.keys.sorted().map { "\($0)=\(String(describing:captureSourceGameplayTileMarkers($0)))" }.joined(separator:";") ?? "physical-unavailable"
        return "gate=\(gate);flow=\(sourceLevelEndCaller != nil);phase=\(sourceLevelEndCaller?.diagnosticPhase ?? "none");delays=\(sourceLevelEndDelays.count);confirmed=\(String(describing:sourceLevelEndCaller?.confirmedSignature));six=\(String(describing:captureSourceMergeSixSpawnInProgress()));drop=\(String(describing:captureSourceWildDropActiveCount()));runtime=\(String(describing:engine.sourceNoMovesRuntimeAuthority?.capture()));markers=\(markers)"
    }
    private func sourceLevelEndGate(scope:NativeGameplaySourceContext.Scope)->NativeSourceLevelEndCallerFlow.Gate? {
        guard sourceAnimationBindingAdmissionOpen,scope.current,let registry=scope.registries.snapshot(isWild:false) else{return nil}
        if registry.failScreenPending || engine.flags.busyEnding{return .stop}
        if registry.special != nil{return .retry(200,"special-transaction")}
        if registry.endgameGuard.active{return .retry(250,"external-endgame-guard")}
        if engine.isDragging{return .retry(250,"active-drag")}
        guard let six=captureSourceMergeSixSpawnInProgress(),let drop=captureSourceWildDropActiveCount(),
            let dates=scope.captureTntBonusDates(),let now=scope.captureSourceDateMilliseconds(),
            let board=captureSourcePhysicalBoard(),board.isStillCurrent() else{return nil}
        if six{return .retry(500,"merge-six-spawn")}
        if dates.guardUntil>now{return .retry(400,"tnt-animation-or-bonus")}
        if drop>0{return .retry(300,"wild-drop")}
        // Source updates STACK IT before tilesNotReady, including boards with
        // locked ghost/spawning neighbors. The retained VC hint owner performs
        // its actual physical active-tile read; the resolution argument is unused.
        onEndgameHintEvaluation?(NativeResolution(.wait,reason:"source_level_end_hint_before_tiles_not_ready"))
        guard sourceAnimationBindingAdmissionOpen,scope.current,board.isStillCurrent() else{return nil}
        for (id,physical) in board.tiles {
            guard let markers=captureSourceGameplayTileMarkers(id),board.isStillCurrent() else{return nil}
            if physical.tile.value>0 && physical.tile.locked || markers.ccSpawnAnimating || markers.spawnAnimating || markers.isSpawning || markers.spawnTweenActive {
                return .retry(500,"tiles-not-ready")
            }
        }
        guard let mandatory=sourceMandatoryCellOwner,engine.sourceMandatoryMergeCellWriterID==sourceMandatoryCellWriterID else{return nil}
        if let pending=mandatory.pending {
            guard pending.generation==engine.state.generation else{return nil}
            let active=board.observedState.tiles.contains {tile in
                guard tile.cell==pending.cell,let physical=board.tiles[tile.id],let markers=captureSourceGameplayTileMarkers(tile.id) else{return false}
                return NativeSourceEndgameChecker.active(tile,runtime:markers.noMovesRuntime(eventMode:physical.eventMode))
            }
            guard board.isStillCurrent() else{return nil}
            if active {_=mandatory.verifiedActive(pending)}
            else if now<pending.expiresAt {return .retry(250,"mandatory-merge-cell-pending")}
            else {
                guard let renewed=mandatory.renewForRepair(pending) else{return nil}
                performSourceMandatoryCellRepair(scope:scope,owner:mandatory,claim:renewed)
                return .stop
            }
        }
        return .ready
    }
    private func captureSourceLevelEndSignature()->(key:String,signature:NativeSourceMeterEndgameSignature)? {
        guard let board=captureSourcePhysicalBoard() else{return nil}
        var entries:[NativeSourceMeterEndgameSignature.Entry]=[]
        guard scanSourceSynchronousPhysicalBoard(board,current:{self.sourceAnimationBindingAdmissionOpen},readsExternalOwner:{$0.isSpecial || $0.sourceResidualWildPresence},read:{model,_ in
            guard let physical=board.tiles[model.id],let markers=self.captureSourceGameplayTileMarkers(model.id) else{return nil}
            if NativeSourceEndgameChecker.active(model,runtime:markers.noMovesRuntime(eventMode:physical.eventMode)) {
                entries.append(.init(value:model.value,special:model.archetype?.rawValue,locked:model.locked,depth:model.stackDepth,x:model.cell.column,y:model.cell.row,eventMode:physical.eventMode))
            }
            return false
        }) != nil else{return nil}
        let signature=NativeSourceMeterEndgameSignature(activeEntries:entries)
        return (Self.sourceLevelEndSignatureKey(signature),signature)
    }
    static func sourceLevelEndSignatureKey(_ signature:NativeSourceMeterEndgameSignature)->String {
        sourceLevelEndSignatureFormatting(signature).key
    }
    static func sourceLevelEndSignatureFormatting(_ signature:NativeSourceMeterEndgameSignature)->(key:String,encodedStringCount:Int) {
        // Fixed field order is the literal Source JSON.stringify object order.
        // Only pure escaped fragments are reused within this synchronous call.
        // Every caller still captures/revalidates its own live physical roster.
        var quotedFragments:[String:String]=[:],encodedStringCount=0
        func quote(_ value:String?)->String {
            guard let value else{return "null"}
            if let quoted=quotedFragments[value]{return quoted}
            encodedStringCount+=1
            let bytes=try? JSONSerialization.data(withJSONObject:[value],options:[.fragmentsAllowed,.withoutEscapingSlashes])
            guard let bytes,let string=String(data:bytes,encoding:.utf8) else{return "null"}
            let quoted=String(string.dropFirst().dropLast());quotedFragments[value]=quoted
            return quoted
        }
        let key="["+signature.entries.map {e in "{\"v\":\(e.value),\"s\":\(quote(e.special)),\"l\":\(e.locked),\"d\":\(e.depth),\"x\":\(e.x.map(String.init) ?? "null"),\"y\":\(e.y.map(String.init) ?? "null"),\"e\":\(quote(e.eventMode))}"}.joined(separator:",")+"]"
        return (key,encodedStringCount)
    }
    /// Genuine checkLevelEnd caller preflight, never a resolver .fail inference.
    @discardableResult func beginSourceNoMovesFromLevelEndCaller()->Bool {
        guard sourceAnimationBindingAdmissionOpen,sourceNoMovesPresentationEnabled,engine.stagedSourceNoMoves,
            let bridge=sourceNoMovesBridge,let bindings=sourceNoMovesBindings,
            let proof=sourceLevelEndConfirmedPreflight() ?? bindings.levelEndPreflight(),!disposed,
            sourceNoMovesBridge === bridge,proof.admits(engine),!disposed,
            sourceNoMovesBridge === bridge,sourceNoMovesGeneration==engine.state.generation else{return false}
        let effect=bridge.begin(origin:.levelEnd)
        if case .candidate=effect{return true};return false
    }
    @discardableResult func refuseUnsupportedSourceNoMovesCaller(_ caller:NativeSourceNoMovesUnsupportedCaller)->Bool {
        // These callers never consume a postcheck or allocate ownership.
        false
    }
    func scheduleSourceNoMovesExitFallback(generation:UInt64,elapsed:@escaping()->Void)->(()->Void) {
        guard sourceAnimationBindingAdmissionOpen,engine.state.generation==generation else{return {}}
        let receipt=sourceAppTimeouts.schedule(sourceID:"no-moves-text1190:"+UUID().uuidString,
            generation:generation,delayMilliseconds:1190,elapsed:elapsed)
        return {[weak self] in _=self?.sourceAppTimeouts.cancel(receipt)}
    }
    @discardableResult func configureSourceNoMovesDepletedCallers(_ bindings:NativeSourceNoMovesDepletedCallerBindings)->Bool {
        guard sourceAnimationBindingAdmissionOpen,sourceNoMovesDepletedCallersEnabled,sourceNoMovesPresentationEnabled,
            sourceNoMovesRuntimeAuthorityEnabled,sourceNoMovesCallerInvocationBound,engine.stagedSourceNoMoves,sourceNoMovesCallerFlow==nil,
            let bridge=sourceNoMovesBridge,let authority=sourceNoMovesOwnedRuntimeAuthority,
            engine.sourceNoMovesRuntimeAuthority === authority,engine.sourceNoMovesCallerAdmission==nil,
            engine.sourceNoMovesCallerCompletionBinding==nil,let tasks=sourceAppTimeouts.sourceMicrotaskTasks,
            let installation=sourceMicrotaskInstallation,installation.isCurrent,installation.tasks === tasks,
            !bindings.kinds.isEmpty,bindings.kinds.isSubset(of:[.ordinaryMovesDepleted,.mergeMovesDepleted]) else{return false}
        if bindings.kinds.contains(.ordinaryMovesDepleted) {
            guard sourceSameNodeStackAbsorbsEnabled,sourceDragTweenDriver != nil,engine.stagedOrdinaryMoves else{return false}
        }
        if bindings.kinds.contains(.mergeMovesDepleted) {
            guard sourceOrdinarySixSameNodeEnabled,sourceSixScope?.current==true,engine.stagedOrdinaryAssignments,
                engine.sourceMergeSixAutoCenterHook === sourceSixAutoHook else{return false}
        }
        let generation=engine.state.generation,epoch=sourceNoMovesCallerEpoch
        let stackDriver=sourceDragTweenDriver,sixScope=sourceSixScope,sixHook=sourceSixAutoHook
        // Pure captured endpoint seal. Presence callbacks cannot change the
        // selected Scene/Core producer and still publish A's capability.
        let prerequisitesMatch:()->Bool = {[weak self] in
            guard let self else{return false}
            if bindings.kinds.contains(.ordinaryMovesDepleted) {
                guard self.sourceSameNodeStackAbsorbsEnabled,self.engine.stagedOrdinaryMoves,
                    stackDriver != nil,self.sourceDragTweenDriver === stackDriver else{return false}
            }
            if bindings.kinds.contains(.mergeMovesDepleted) {
                guard self.sourceOrdinarySixSameNodeEnabled,self.engine.stagedOrdinaryAssignments,
                    sixScope != nil,sixHook != nil,self.sourceSixScope === sixScope,self.sourceSixAutoHook === sixHook,
                    self.engine.sourceMergeSixAutoCenterHook === sixHook else{return false}
            }
            return true
        }
        guard prerequisitesMatch() else{return false}
        let accepted=bindings.admitted(generation,bindings.kinds)
        guard accepted,prerequisitesMatch(),sourceAnimationBindingAdmissionOpen,sourceNoMovesDepletedCallersEnabled,
            sourceNoMovesPresentationEnabled,sourceNoMovesRuntimeAuthorityEnabled,engine.stagedSourceNoMoves,
            sourceNoMovesCallerEpoch==epoch,sourceNoMovesBridge === bridge,sourceNoMovesCallerFlow==nil,
            sourceNoMovesOwnedRuntimeAuthority === authority,sourceAppTimeouts.sourceMicrotaskTasks === tasks,
            sourceMicrotaskInstallation === installation,sourceNoMovesCallerInvocationBound,
            engine.state.generation==generation,engine.sourceNoMovesRuntimeAuthority === authority,
            engine.sourceNoMovesCallerAdmission==nil,engine.sourceNoMovesCallerCompletionBinding==nil else{return false}
        let admission=NativeSourceNoMovesCallerAdmission(generation:generation,kinds:bindings.kinds)
        let current:(NativeSourceNoMovesCallerReceipt)->Bool = {[weak self,weak bridge] receipt in
            guard let self,let bridge,prerequisitesMatch(),self.sourceAnimationBindingAdmissionOpen,self.sourceNoMovesDepletedCallersEnabled,
                self.sourceNoMovesPresentationEnabled,self.sourceNoMovesRuntimeAuthorityEnabled,self.engine.stagedSourceNoMoves,
                self.sourceNoMovesCallerAdmission === admission,self.sourceNoMovesBridge === bridge,
                self.sourceNoMovesOwnedRuntimeAuthority === authority,self.engine.sourceNoMovesRuntimeAuthority === authority,
                self.sourceAppTimeouts.sourceMicrotaskTasks === tasks,
                self.sourceNoMovesCallerEpoch==epoch,self.engine.state.generation==generation,
                self.engine.sourceNoMovesCallerIsCurrent(receipt) else{return false}
            let result=bindings.admitted(generation,bindings.kinds)
            return result && prerequisitesMatch() && self.sourceAnimationBindingAdmissionOpen && self.sourceNoMovesCallerAdmission === admission &&
                self.sourceNoMovesPresentationEnabled && self.sourceNoMovesRuntimeAuthorityEnabled && self.engine.stagedSourceNoMoves &&
                self.sourceNoMovesBridge === bridge && self.sourceNoMovesOwnedRuntimeAuthority === authority &&
                self.engine.sourceNoMovesRuntimeAuthority === authority && self.sourceAppTimeouts.sourceMicrotaskTasks === tasks &&
                self.sourceNoMovesCallerEpoch==epoch && self.engine.state.generation==generation && self.engine.sourceNoMovesCallerIsCurrent(receipt)
        }
        let flow=NativeSourceNoMovesDepletedCallerFlow(hooks:.init(current:current,busyEnding:bindings.busyEnding,wait:{[weak self] key,gen,ms,elapsed,cancelled in
            guard let self,self.sourceAnimationBindingAdmissionOpen,self.sourceNoMovesCallerAdmission === admission,
                self.engine.state.generation==gen else{return {}}
            let timer=self.sourceAppTimeouts.schedule(sourceID:key,generation:gen,delayMilliseconds:ms,elapsed:elapsed,cancelled:cancelled)
            return {[weak self] in _=self?.sourceAppTimeouts.cancel(timer)}
        },ensureTutorialSingleTile:bindings.ensureTutorialSingleTile,fresh:bindings.forceFresh,resetHint:bindings.resetHint,
            deferWild:bindings.deferWild,tutorialFinalChance:bindings.tutorialFinalChance,cleanVisibility:bindings.cleanVisibility,
            clean:bindings.clean,beginNoMoves:{[weak self,weak bridge] receipt,reply in
                guard let self,let bridge,current(receipt),self.sourceNoMovesBridge === bridge else{return}
                self.sourceNoMovesCallerReplies[receipt.id]=(admission.id,reply)
                let effect=bridge.capturedCaller(receipt)
                guard self.sourceNoMovesCallerAdmission === admission,self.sourceNoMovesBridge === bridge,
                    self.sourceNoMovesCallerEpoch==epoch,self.engine.state.generation==generation else{return}
                if case .candidate=effect {return} // actual final/rollback receipt owns reply
                if let completion=self.sourceNoMovesCallerCompletion,completion.admissionID==admission.id {
                    // Async Source returns/deferrals still resolve via one actual
                    // Promise reaction. Never inline a caller continuation.
                    completion.deliver(receipt)
                }
            },continueMergeSix:{[weak self] receipt in
                guard let self,current(receipt) else{return};let previous=self.engine.state
                let result=self.engine.continueSourceMergeSixAfterNoMovesCaller(receipt)
                guard self.sourceAnimationBindingAdmissionOpen,self.sourceNoMovesCallerAdmission === admission,
                    self.engine.state.generation==generation,result.accepted else{return}
                self.consume(result,previous:previous);self.releaseOrdinarySixIfReady()
            },returned:{[weak self] receipt,reason in
                guard let self else{return}
                if reason == .unsupported {_=self.engine.refuseSourceNoMovesCaller(receipt)}
                else {_=self.engine.retireSourceNoMovesCaller(receipt)}
            }))
        let completion=NativeSourceNoMovesCallerCompletionBinding(admissionID:admission.id,deliver:{[weak self] receipt in
            guard let self,self.sourceNoMovesCallerAdmission === admission,self.sourceNoMovesCallerEpoch==epoch,
                self.engine.state.generation==generation,let pending=self.sourceNoMovesCallerReplies[receipt.id],
                pending.0==admission.id else{return}
            let enqueued=installation.enqueue{[weak self] in
                guard let self,self.sourceNoMovesCallerAdmission === admission,self.sourceNoMovesCallerEpoch==epoch,
                    self.engine.state.generation==generation,
                    let captured=self.sourceNoMovesCallerReplies[receipt.id],captured.0==pending.0 else{return}
                self.sourceNoMovesCallerReplies.removeValue(forKey:receipt.id);captured.1()
            }
            if !enqueued {_=self.engine.refuseSourceNoMovesCaller(receipt)}
        })
        sourceNoMovesCallerAdmission=admission;sourceNoMovesCallerFlow=flow;sourceNoMovesCallerCompletion=completion
        engine.sourceNoMovesCallerAdmission=admission;engine.sourceNoMovesCallerCompletionBinding=completion
        engine.sourceNoMovesCallerReceiptsEnabled=true;return true
    }
    @discardableResult func configureSourceOrdinaryPreDebit(_ bindings:NativeSourceOrdinaryPreDebitBindings)->Bool {
        guard bindings.markerCapabilities == Set(NativeSourceNoMovesRuntimeSnapshot.Capability.allCases),
            sourceAnimationBindingAdmissionOpen,sourceOrdinaryPreDebitPresentationEnabled,
            sourceSameNodeStackAbsorbsEnabled,engine.stagedOrdinaryMoves,engine.stagedSourceNoMoves,
            sourceNoMovesPresentationEnabled,sourceNoMovesRuntimeAuthorityEnabled,sourceNoMovesCallerInvocationBound,
            let callerAdmission=sourceNoMovesCallerAdmission,callerAdmission.kinds.contains(.ordinaryMovesDepleted),
            let completion=sourceNoMovesCallerCompletion,engine.sourceNoMovesCallerAdmission === callerAdmission,
            engine.sourceNoMovesCallerCompletionBinding === completion,let bridge=sourceNoMovesBridge,
            let authority=sourceNoMovesOwnedRuntimeAuthority,engine.sourceNoMovesRuntimeAuthority === authority,
            let driver=sourceDragTweenDriver,let installation=sourceMicrotaskInstallation,installation.isCurrent,
            let tasks=sourceAppTimeouts.sourceMicrotaskTasks,installation.tasks === tasks,
            sourceOrdinaryPreDebitFlow==nil,engine.sourceOrdinaryPreDebitAdmission==nil else{return false}
        let gen=engine.state.generation,epoch=sourceOrdinaryPreDebitEpoch,callerEpoch=sourceNoMovesCallerEpoch
        let seal:()->Bool = {[weak self,weak bridge] in
            guard let self,let bridge else{return false}
            return self.sourceAnimationBindingAdmissionOpen && self.sourceOrdinaryPreDebitPresentationEnabled &&
                self.sourceSameNodeStackAbsorbsEnabled && self.engine.stagedOrdinaryMoves && self.engine.stagedSourceNoMoves &&
                self.sourceNoMovesPresentationEnabled && self.sourceNoMovesRuntimeAuthorityEnabled && self.sourceNoMovesCallerInvocationBound &&
                self.engine.state.generation==gen && self.sourceOrdinaryPreDebitEpoch==epoch && self.sourceNoMovesCallerEpoch==callerEpoch &&
                self.sourceNoMovesCallerAdmission === callerAdmission && self.engine.sourceNoMovesCallerAdmission === callerAdmission && !callerAdmission.retired &&
                self.sourceNoMovesCallerCompletion === completion && self.engine.sourceNoMovesCallerCompletionBinding === completion &&
                self.sourceNoMovesBridge === bridge && self.sourceNoMovesOwnedRuntimeAuthority === authority && self.engine.sourceNoMovesRuntimeAuthority === authority &&
                self.sourceDragTweenDriver === driver && self.sourceMicrotaskInstallation === installation && installation.isCurrent &&
                self.sourceAppTimeouts.sourceMicrotaskTasks === tasks
        }
        guard seal() else{return false}
        let admitted=bindings.admitted(gen);guard admitted,seal(),sourceOrdinaryPreDebitFlow==nil,engine.sourceOrdinaryPreDebitAdmission==nil else{return false}
        let endpoint=NativeSourceOrdinaryPreDebitAdmission(callerAdmissionID:callerAdmission.id,generation:gen,isCurrent:{
            guard seal() else{return false};let accepted=bindings.admitted(gen);return accepted && seal()
        })
        let current:(NativeSourceOrdinaryPreDebitReceipt)->Bool = {[weak self,weak endpoint] receipt in
            guard let self,let endpoint,seal(),self.sourceOrdinaryPreDebitAdmission === endpoint,
                self.engine.sourceOrdinaryPreDebitAdmission === endpoint,!endpoint.retired else{return false}
            return self.engine.sourceOrdinaryPreDebitIsCurrent(receipt) && seal() && self.sourceOrdinaryPreDebitAdmission === endpoint
        }
        let enqueue:(@escaping()->Void)->Void = {body in _=installation.enqueue{guard seal() else{return};body()}}
        let flow=NativeSourceOrdinaryPreDebitFlow(hooks:.init(current:current,mainCapture:{[weak self] receipt in
            guard let self,current(receipt) else{return nil};return self.sourcePreDebitMain[receipt.ownerID]
        },busyEnding:bindings.busyEnding,wait:{[weak self] key,generation,ms,elapsed,cancelled in
            guard let self,seal() else{return {}}
            let token=self.sourceAppTimeouts.schedule(sourceID:key,generation:generation,delayMilliseconds:ms,elapsed:elapsed,cancelled:cancelled)
            return {[weak self] in _=self?.sourceAppTimeouts.cancel(token)}
        },stateRoster:{[weak self] in
            guard let self,seal() else{return nil};let roster=bindings.stateRoster()
            guard seal(),let roster,self.sourcePreDebitRosterMatches(roster) else{return nil};return roster
        },reread:{[weak self] held in
            guard let self,seal() else{return nil};let tile=bindings.reread(held)
            guard seal(),let tile,tile.object === held.object,self.sourcePreDebitTileMatches(tile) else{return nil};return tile
        },fresh:bindings.forceFresh,clearEndGameCache:bindings.clearEndGameCache,resetHint:bindings.resetHint,
            deferStackWild:bindings.deferStackWild,ensureTutorialSingleTile:{reason,reply in
                bindings.ensureTutorialSingleTile(reason,{value in enqueue{reply(value)}})
            },tutorialFinalChance:{reason,reply in
                bindings.tutorialFinalChance(reason,{value in enqueue{reply(value)}})
            },beginNoMoves:{[weak self,weak bridge] receipt,trigger,reply in
                guard let self,let bridge,current(receipt),let caller=self.engine.prepareSourceOrdinaryPreDebitNoMoves(receipt,trigger:trigger),current(receipt) else{return}
                self.sourceNoMovesCallerReplies[caller.id]=(callerAdmission.id,reply)
                let effect=bridge.capturedCaller(caller)
                guard seal(),current(receipt) else{return}
                if case .candidate=effect {return} // actual invocation/rollback reply owns continuation
                completion.deliver(caller) // same genuine Source FIFO completion endpoint
            },finished:{[weak self] receipt,reason in
                guard let self,current(receipt),self.sourcePreDebitRequests[receipt.ownerID]==receipt else{return}
                if reason == .unsupported {_=self.engine.refuseSourceOrdinaryPreDebit(receipt);return}
                let outcome:NativeSourceOrdinaryPreDebitOutcome = reason == .continueToDebit ? .continueToDebit:(reason == .cancelled ? .cancelled:.returned)
                let previous=self.engine.state
                let result=self.engine.finishSourceOrdinaryPreDebit(receipt,outcome:outcome)
                guard seal(),result.accepted else{return}
                self.sourcePreDebitRequests.removeValue(forKey:receipt.ownerID);self.sourcePreDebitContacts.removeValue(forKey:receipt.ownerID);self.sourcePreDebitMain.removeValue(forKey:receipt.ownerID)
                let callers=self.engine.pendingSourceNoMovesCallerReceipts.filter{$0.ownerID==receipt.ownerID && $0.isPreDebit}
                for caller in callers {_=self.engine.retireSourceNoMovesCaller(caller)}
                if outcome == .continueToDebit {self.startSourceNoMovesDepletedCaller(ownerID:receipt.ownerID,kind:.ordinaryMovesDepleted,generation:receipt.generation)}
                self.consume(result,previous:previous)
            }))
        guard seal(),sourceOrdinaryPreDebitFlow==nil,engine.sourceOrdinaryPreDebitAdmission==nil else{endpoint.retire();flow.dispose();return false}
        sourceOrdinaryPreDebitBindings=bindings;sourceOrdinaryPreDebitAdmission=endpoint;sourceOrdinaryPreDebitFlow=flow
        engine.sourceOrdinaryPreDebitAdmission=endpoint;engine.sourceOrdinaryPreDebitEnabled=true;return true
    }
    private func sourcePreDebitTileMatches(_ tile:NativeSourcePostcheckTile)->Bool {
        guard let node=tile.object as? NativeDiceNode,nodesByID[tile.id] === node,node.parent === canvasRoot,
            node.sourceGeneration==engine.state.generation,node.sourceContactNodeAlive,
            node.sourceValue==tile.value,node.sourceStackDepth==tile.depth,node.sourceLocked==tile.locked else{return false}
        // actual wild-like marker predicate is supplied by its covered observer;
        // special nil/default Star texture alone is not a regular-kind proof.
        return true
    }
    private func sourcePreDebitRosterMatches(_ roster:NativeSourcePostcheckRoster)->Bool {
        roster.complete && roster.tiles.map(\.id)==engine.state.tiles.map(\.id) && roster.tiles.allSatisfy(sourcePreDebitTileMatches)
    }
    private func captureSourcePreDebitContact(sourceID:String,destinationID:String,generation:UInt64)->SourcePreDebitContact? {
        guard sourceAnimationBindingAdmissionOpen,engine.state.generation==generation,
            let bindings=sourceOrdinaryPreDebitBindings,let endpoint=sourceOrdinaryPreDebitAdmission,
            engine.sourceOrdinaryPreDebitAdmission === endpoint,let source=nodesByID[sourceID],let destination=nodesByID[destinationID],
            source.parent === canvasRoot,destination.parent === canvasRoot,source.sourceGeneration==generation,destination.sourceGeneration==generation,
            source.sourceContactNodeAlive,destination.sourceContactNodeAlive else{return nil}
        let epoch=sourceOrdinaryPreDebitEpoch,roster=bindings.captureBefore()
        guard sourceAnimationBindingAdmissionOpen,sourceOrdinaryPreDebitEpoch==epoch,sourceOrdinaryPreDebitAdmission === endpoint,
            engine.state.generation==generation,let roster,sourcePreDebitRosterMatches(roster),nodesByID[sourceID] === source,nodesByID[destinationID] === destination else{return nil}
        let active=roster.tiles.filter(\.active)
        guard let s=roster.tiles.first(where:{$0.object === source}),let d=roster.tiles.first(where:{$0.object === destination}),
            !s.isWildLike,!d.isWildLike,!source.isSpecial,!destination.isSpecial,
            !source.sourceResidualWildPresence,!destination.sourceResidualWildPresence,source.variant==nil,destination.variant==nil else{return nil}
        return SourcePreDebitContact(source:source,destination:destination,sourceSpecial:nil,destinationSpecial:nil,
            effectiveSum:s.value+d.value,visibleBefore:active.count,physicalBefore:active.reduce(0){$0+max(1,$1.depth)},
            bothCapturedActive:active.contains{$0.object === source} && active.contains{$0.object === destination},generation:generation,epoch:epoch)
    }
    private func captureSourcePreDebitMain(id:String,generation:UInt64) {
        guard sourceAnimationBindingAdmissionOpen,sourceOrdinaryPreDebitPresentationEnabled,let contact=sourcePreDebitContacts[id],
            contact.generation==generation,contact.epoch==sourceOrdinaryPreDebitEpoch,engine.state.generation==generation,
            nodesByID[contact.source.tileID] === contact.source,nodesByID[contact.destination.tileID] === contact.destination,
            contact.source.parent === canvasRoot,contact.destination.parent === canvasRoot,
            contact.source.sourceContactNodeAlive,contact.destination.sourceContactNodeAlive else{return}
        sourcePreDebitMain[id]=NativeSourcePostcheckMainCapture(source:contact.source,destination:contact.destination,
            sourceID:contact.source.tileID,destinationID:contact.destination.tileID,effectiveSum:contact.effectiveSum,
            sourceValue:contact.source.sourceValue,destinationValue:contact.destination.sourceValue,
            sourceSpecial:contact.sourceSpecial,destinationSpecial:contact.destinationSpecial,
            sourceDepth:max(1,contact.source.sourceStackDepth),destinationDepth:max(1,contact.destination.sourceStackDepth),
            visibleBefore:contact.visibleBefore,physicalBefore:contact.physicalBefore,bothCapturedActive:contact.bothCapturedActive)
    }
    private func retireSourceOrdinaryPreDebit() {
        let flow=sourceOrdinaryPreDebitFlow,endpoint=sourceOrdinaryPreDebitAdmission,requests=Array(sourcePreDebitRequests.values)
        sourceOrdinaryPreDebitFlow=nil;sourceOrdinaryPreDebitAdmission=nil;sourceOrdinaryPreDebitBindings=nil
        sourcePreDebitRequests=[:];sourcePreDebitContacts=[:];sourcePreDebitMain=[:];sourcePreDebitDeferredMain=[];sourceOrdinaryPreDebitEpoch &+= 1
        if let endpoint,engine.sourceOrdinaryPreDebitAdmission === endpoint {engine.sourceOrdinaryPreDebitAdmission=nil;engine.sourceOrdinaryPreDebitEnabled=false}
        endpoint?.retire();flow?.dispose()
        for receipt in requests {_=engine.retireSourceOrdinaryPreDebit(receipt)}
    }
    @discardableResult func sourceNoMovesConfirmedCallerInvocation(planToken:UInt64,generation:UInt64)->Bool {
        guard sourceAnimationBindingAdmissionOpen,sourceNoMovesCallerInvocationBound,
            sourceNoMovesCallerAdmission != nil,engine.state.generation==generation,let bridge=sourceNoMovesBridge else{return false}
        return bridge.confirmedCallerInvocation(planToken:planToken,generation:generation)
    }
    private func startSourceNoMovesDepletedCaller(ownerID:String,kind:NativeSourceNoMovesCallerReceipt.Kind,generation:UInt64) {
        guard sourceAnimationBindingAdmissionOpen,sourceNoMovesDepletedCallersEnabled,let flow=sourceNoMovesCallerFlow,
            let receipt=engine.sourceNoMovesCaller(ownerID:ownerID,generation:generation,kind:kind) else{return}
        if !flow.start(receipt) {_=engine.refuseSourceNoMovesCaller(receipt)}
    }
    private func retireSourceNoMovesDepletedCallers() {
        retireSourceOrdinaryPreDebit()
        let flow=sourceNoMovesCallerFlow,admission=sourceNoMovesCallerAdmission,completion=sourceNoMovesCallerCompletion
        sourceNoMovesCallerFlow=nil;sourceNoMovesCallerAdmission=nil;sourceNoMovesCallerCompletion=nil
        sourceNoMovesCallerReplies=[:];sourceNoMovesCallerEpoch &+= 1
        if let completion,engine.sourceNoMovesCallerCompletionBinding === completion {engine.sourceNoMovesCallerCompletionBinding=nil}
        if let admission,engine.sourceNoMovesCallerAdmission === admission {
            engine.sourceNoMovesCallerAdmission=nil;engine.sourceNoMovesCallerReceiptsEnabled=false
        }
        let captured=engine.pendingSourceNoMovesCallerReceipts.filter{$0.admissionID==admission?.id}
        admission?.retire();flow?.dispose()
        for receipt in captured {_=engine.retireSourceNoMovesCaller(receipt)}
    }
    func retireSourceNoMoves() {
        let authority=sourceNoMovesOwnedRuntimeAuthority;sourceNoMovesOwnedRuntimeAuthority=nil
        if let authority,engine.sourceNoMovesRuntimeAuthority === authority {engine.sourceNoMovesRuntimeAuthority=nil}
        let captured=sourceNoMovesBridge,clear=sourceNoMovesRetirement,terminal=sourceNoMovesTerminalRegistry
        sourceNoMovesRetirement=nil
        sourceNoMovesConfigurationEpoch &+= 1
        sourceNoMovesBridge=nil;sourceNoMovesBindings=nil;sourceNoMovesGeneration=nil;sourceNoMovesTerminalRegistry=nil;sourceNoMovesCallerInvocationBound=false
        retireSourceNoMovesDepletedCallers()
        terminal?.retire();captured?.retireObsolete();clear?()
    }
    private var ordinarySpawnVisuals:[String:UInt64] = [:]
    private var ordinaryDeferred=Set<String>()
    private var sourceLockedBounceActionIDs=Set<String>()
    private var sourceLockedSlotMarkerNodes:[String:NativeDiceNode]=[:]
    var onLevelFlowBounceCompletion:((String,UInt64)->Void)?
    private var ordinaryPrimaryVisuals:[String:(String,String,UInt64)] = [:]
    private struct OrdinarySixVisual {
        let id:String,generation:UInt64,receipt:UInt64
        var committed=false,consuming=false
    }
    var onFishIdleFrames:(([String:NativeFishIdleFrame],UInt64,Bool)->Void)?
    var onJourneyBottomDecorShake:((CGPoint,UInt64)->Void)?
    var captureSourceScreenOverlayShake:((String,String?,UInt64)->NativeSourceScreenShakeOverlayTarget?)?
    private var sourceCoreTntShakeTargets:[String:NativeSourceScreenShakeOverlayTarget]=[:]
    private var sourceScreenShakeTargets:[UUID:(String,String?,UInt64,NativeSourceScreenShakeOverlayTarget?)]=[:]
    var reducedBoardEffects=false
    var onPresentationFailure:((String)->Void)?
    var onSourcePresentationFailure:((String,UInt64)->Void)?
    private var regularSixPresentations:[String:NativeRegularSixSpritePresentation]=[:]
    private var regularSixShakeID:String?
    private var boardShake=NativeRegularSixSpritePresentation.ShakeReceipt(canvas:.zero,indicator:.zero,bottomDecor:.zero)
    private var ordinarySixVisual:OrdinarySixVisual?
    private var specialPresentationIDs = Set<String>()
    private var laserSpawnCallbacks:[String:() -> Void] = [:]
    private let sourceAppTimeouts=NativeSourceAppTimeoutOwner()
    private var sourceMicrotaskInstallation:NativeSourceSceneMicrotaskInstallation?
    private var sourceMicrotaskConfigurationEpoch:UInt64=0
    var sourceMicrotaskBoundariesInstalled:Bool{sourceMicrotaskInstallation?.isCurrent==true}
    /// All four real producer paths are installed by this Scene, but FIFO/tasks
    /// are borrowed from the app scope. No creation or service mutation here.
    @discardableResult func configureSourceMicrotaskBoundaries(scope:NativeGameplaySourceContext.Scope,
        fifo:NativeSourceMicrotaskFIFO)->Bool {
        guard sourceAnimationBindingAdmissionOpen,sourceMicrotaskInstallation==nil,
              sourceMeterCaller==nil,sourceMeterQueue==nil,sourceMeterLanding==nil,
              scope.current,let tasks=scope.sourceMicrotaskTasks,tasks.isBound(to:fifo),
              scope.service.sourceMicrotaskTasks === tasks,scope.service.sourceMicrotaskRAFBoundaryInstalled,
              sourceAppTimeouts.sourceMicrotaskTasks==nil else{return false}
        sourceMicrotaskConfigurationEpoch &+= 1
        let epoch=sourceMicrotaskConfigurationEpoch,generation=engine.state.generation
        let current:()->Bool = {[weak self,scope] in
            guard let self,self.sourceAnimationBindingAdmissionOpen,self.sourceMicrotaskConfigurationEpoch==epoch,
                  self.engine.state.generation==generation,self.sourceAppTimeouts.sourceMicrotaskTasks === tasks,
                  scope.sourceMicrotaskTasks === tasks,scope.service.sourceMicrotaskTasks === tasks else{return false}
            let valid=scope.current
            return valid && self.sourceAnimationBindingAdmissionOpen && self.sourceMicrotaskConfigurationEpoch==epoch &&
                self.engine.state.generation==generation && self.sourceAppTimeouts.sourceMicrotaskTasks === tasks &&
                scope.sourceMicrotaskTasks === tasks && scope.service.sourceMicrotaskTasks === tasks
        }
        sourceAppTimeouts.sourceMicrotaskTasks=tasks
        guard current(),let binding=NativeSourceSceneMicrotaskInstallation(fifo:fifo,tasks:tasks,
            service:scope.service,timeouts:sourceAppTimeouts,current:current),current(),sourceMicrotaskInstallation==nil else {
            // No external dispose occurs before unhook; an old A cannot clear C.
            if sourceMicrotaskConfigurationEpoch==epoch,sourceMicrotaskInstallation==nil,
               sourceAppTimeouts.sourceMicrotaskTasks === tasks {sourceAppTimeouts.sourceMicrotaskTasks=nil}
            return false
        }
        sourceMicrotaskInstallation=binding;sourceDisposalSealingEnabled=true
        return true
    }
    func retireSourceMicrotaskBoundaries() {
        sourceMicrotaskConfigurationEpoch &+= 1
        let binding=sourceMicrotaskInstallation;sourceMicrotaskInstallation=nil
        if let binding,sourceAppTimeouts.sourceMicrotaskTasks === binding.tasks {sourceAppTimeouts.sourceMicrotaskTasks=nil}
        binding?.dispose() // unhook ALL owned slots before dropping captures
    }
    private func sourceMeterEnqueue(_ binding:NativeSourceSceneMicrotaskInstallation?,_ action:@escaping @MainActor ()->Void) {
        guard let binding else{DispatchQueue.main.async{action()};return} // unchanged default fixture/Raw path
        guard sourceMicrotaskInstallation === binding,binding.isCurrent,binding.enqueue(action) else {
            if sourceAnimationBindingAdmissionOpen {onPresentationFailure?("source_meter_microtask_producer_not_bound")}
            return // never synthesize an async fallback for Source-owned work
        }
    }
    // PRIVATE/default OFF: genuine pre-Core autoCenter and same-object main80.
    // App-created Scope owns all clocks/RNG/pools. This bridge creates none.
    var sourceOrdinarySixSameNodeEnabled=false
    var sourceDirectWildSameNodeEnabled=false
    private weak var sourceDirectScope:NativeGameplaySourceContext.Scope?
    var sourceDirectWildDestinationFaceEnabled=false
    private var sourceDirectWildDestinationTexture:SKTexture?
    private func sourceDirectDestinationTexture(_ tile:NativeTile)->SKTexture? {
        guard sourceDirectWildDestinationFaceEnabled,
              let path=NativeSourceWildDestinationFaceReceipt.selectedAssetPath(for:tile) else{return nil}
        if path == "assets/wild.png" {return sourceDirectWildDestinationTexture}
        // The initial/restore/reward constructor has already prepared this
        // exact selected asset. Contact may only borrow its retained identity.
        return textures.sourceCachedTexture(candidates:[path])
    }
    private var sourceDirectWildDestinationPreparationEpoch:UInt64=0
    /// Existing texture owner performs selected decode/upload before admission.
    /// No new Source wait is inserted in a valid contact; unready drops refuse.
    func prepareSourceDirectWildDestinationFace(scope:NativeGameplaySourceContext.Scope,completion:@escaping(Bool)->Void) {
        guard sourceAnimationBindingAdmissionOpen,sourceDirectWildDestinationFaceEnabled,
              sourceDirectScope === scope,scope.current else{completion(false);return}
        sourceDirectWildDestinationPreparationEpoch &+= 1
        let epoch=sourceDirectWildDestinationPreparationEpoch,generation=engine.state.generation
        sourceDirectWildDestinationTexture=nil
        let paths=Array(Set(["assets/wild.png"]+engine.state.tiles.compactMap{NativeSourceWildDestinationFaceReceipt.selectedAssetPath(for:$0)})).sorted()
        let current:()->Bool = {[weak self,weak scope] in
            guard let self,let scope else{return false}
            return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceDirectScope === scope &&
                self.engine.state.generation==generation && self.sourceDirectWildDestinationPreparationEpoch==epoch
        }
        func prepare(_ index:Int) {
            guard current() else{completion(false);return}
            if index==paths.count {
                sourceDirectWildDestinationTexture=textures.sourceCachedTexture(candidates:["assets/wild.png"])
                completion(sourceDirectWildDestinationTexture != nil);return
            }
            textures.prepareSelectedFinaleAsset(.init([paths[index]])) {texture in
                guard current(),texture != nil else{completion(false);return}
                prepare(index+1)
            }
        }
        prepare(0)
    }

    /// Special-family fixture/entry owns the same selected upload, tied to its
    /// actually installed main scope; it does not install a Direct transaction.
    func prepareSourceSpecialWildDestinationFaceResources(scope:NativeGameplaySourceContext.Scope,completion:@escaping(Bool)->Void) {
        guard sourceAnimationBindingAdmissionOpen,scope.current,sourceMagnetMainScope === scope || sourceTntMainScope === scope else{completion(false);return}
        let generation=engine.state.generation
        let paths=Array(Set(["assets/wild.png"]+engine.state.tiles.compactMap{NativeSourceWildDestinationFaceReceipt.selectedAssetPath(for:$0)})).sorted()
        let current:()->Bool = {[weak self,weak scope] in
            guard let self,let scope else{return false}
            return self.sourceAnimationBindingAdmissionOpen && scope.current && self.engine.state.generation==generation && (self.sourceMagnetMainScope === scope || self.sourceTntMainScope === scope)
        }
        func prepare(_ index:Int) {
            guard current() else{completion(false);return}
            if index==paths.count {
                sourceDirectWildDestinationTexture=textures.sourceCachedTexture(candidates:["assets/wild.png"])
                sourceDirectWildDestinationFaceEnabled=sourceDirectWildDestinationTexture != nil
                completion(sourceDirectWildDestinationFaceEnabled);return
            }
            textures.prepareSelectedFinaleAsset(.init([paths[index]])) {texture in
                guard current(),texture != nil else{completion(false);return}
                prepare(index+1)
            }
        }
        prepare(0)
    }

    private var sourceSixScope:NativeGameplaySourceContext.Scope?
    private var sourceSixAutoHook:NativeSourceMergeSixAutoCenterHook?
    private var sourceSixShared:NativeRegularSixSharedContext?
    private var sourceWildSixShards:[UUID:NativeRegularSixSharedLayers]=[:]
    private var sourceWildSixParticleTransactions=Set<String>()
    enum SourceWildSixMainPhase:Equatable {case shards,presentation,smoke}
    private enum SourceWildSixParticleStage {case all,shards,smoke}
    private(set) var sourceWildSixMainPhases:[String:[SourceWildSixMainPhase]]=[:]
    private func recordSourceWildSixPresentation(_ ownerID:String) {
        if sourceWildSixMainPhases[ownerID]?.contains(.presentation) != true {
            sourceWildSixMainPhases[ownerID,default:[]].append(.presentation)
        }
    }
    private(set) var sourceWildSixParticleAdmissions:[String:Int]=[:]
    var sourceWildSixShardOwnerCount:Int{sourceWildSixShards.count}
    private(set) var sourceSpecialImpactParticleAdmissions:[String:Int]=[:]
    private(set) var sourceLaserImpactMergeSixShardCounts:[Int]=[]
    private(set) var sourceWildOrdinaryMergeSixShardCounts:[String:[Int]]=[:]
    private(set) var sourceWildOrdinaryMergeSixSmokeRecipes:[String:[NativeSharedSmokeRecipe]]=[:]
    private(set) var sourceSpecialImpactMergeSixShardCounts:[String:[Int]]=[:]
    private(set) var sourceSpecialImpactParticleRejection:String?
    @discardableResult private func playSourceSpecialImpactParticles(variant:String?,target:NativeDiceNode,generation:UInt64)->Bool {
        guard sourceAnimationBindingAdmissionOpen,let scope=sourceSixScope,scope.current,
              let shared=sourceSixShared,shared.canAdmit,let geometry,engine.state.generation==generation else {
            sourceSpecialImpactParticleRejection=(variant ?? "tnt")+":preflight:admission=\(sourceAnimationBindingAdmissionOpen):scope=\(sourceSixScope != nil):scopeCurrent=\(sourceSixScope?.current == true):shared=\(sourceSixShared != nil):sharedAdmitted=\(sourceSixShared?.canAdmit == true):geometry=\(geometry != nil):generation=\(engine.state.generation)/\(generation)"
            NSLog("[NativeSourceImpactFX] rejection=%@",sourceSpecialImpactParticleRejection ?? "unknown")
            return false
        }
        // This validation is synchronous and never retained by an effect.
        // Keep the exact borrowed admission receipts alive across construction;
        // Scene identity still rejects actual replacement or retirement.
        let current:()->Bool = {[weak self,scope,shared] in
            guard let self else{return false}
            return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceSixScope === scope &&
                self.sourceSixShared === shared && self.engine.state.generation==generation
        }
        let currentRejection:()->String = {[weak self,weak scope,weak shared] in
            guard let self else{return "scene-retired"}
            return "admission=\(self.sourceAnimationBindingAdmissionOpen):scopeCaptured=\(scope != nil):sceneScope=\(self.sourceSixScope != nil):scopeCurrent=\(scope?.current == true):scopeIdentity=\(self.sourceSixScope === scope):sharedCaptured=\(shared != nil):sceneShared=\(self.sourceSixShared != nil):sharedIdentity=\(self.sourceSixShared === shared):sharedAdmitted=\(shared?.canAdmit == true):generation=\(self.engine.state.generation)/\(generation)"
        }
        do {
            // Explicit appearance override: every Special contact now borrows
            // the ordinary merge6 recipe, pattern cursor, pools and lifetime.
            let layers=try NativeRegularSixSharedLayers(context:shared,canvas:canvasRoot,tile:target,origin:target.position,
                tileSize:geometry.tileSize,destinationDepth:9993,generation:generation,reduced:false)
            guard current() else {
                sourceSpecialImpactParticleRejection=(variant ?? "tnt")+":post-layers-current:"+currentRejection()
                NSLog("[NativeSourceImpactFX] rejection=%@",sourceSpecialImpactParticleRejection ?? "unknown")
                layers.dispose();return false
            }
            sourceSpecialImpactMergeSixShardCounts[variant ?? "tnt",default:[]].append(layers.shardCount)
            if variant == "laser-gun" {sourceLaserImpactMergeSixShardCounts.append(layers.shardCount)}
        } catch {
            sourceSpecialImpactParticleRejection=(variant ?? "tnt")+":"+String(reflecting:error)
            NSLog("[NativeSourceImpactFX] rejection=%@",sourceSpecialImpactParticleRejection ?? "unknown")
            return false
        }
        guard current() else {
            sourceSpecialImpactParticleRejection=(variant ?? "tnt")+":post-current:"+currentRejection()
            NSLog("[NativeSourceImpactFX] rejection=%@",sourceSpecialImpactParticleRejection ?? "unknown")
            return false
        }
        sourceSpecialImpactParticleAdmissions[variant ?? "tnt",default:0]+=1
        return true
    }
    @discardableResult private func playSourceWildMergeSixParticles(ownerID:String,archetype:NativeWildArchetype,variant:String?,
        destination:NativeDiceNode,generation:UInt64,pull:Bool=false,stage:SourceWildSixParticleStage = .all)->Bool {
        guard sourceAnimationBindingAdmissionOpen,let scope=sourceSixScope,scope.current,
              let shared=sourceSixShared,shared.canAdmit,let geometry,engine.state.generation==generation,
              engine.sourceMathRandom === scope.mathRandom else{return false}
        let transaction=ownerID+(pull ? ":pull":":main")
        if sourceWildSixParticleTransactions.contains(transaction){return true}
        let current:()->Bool = {[weak self,scope,shared] in
            guard let self else{return false}
            return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceSixScope === scope &&
                self.sourceSixShared === shared && shared.canAdmit && self.engine.state.generation==generation
        }
        let origin=destination.position
        let appearanceKey=(variant ?? archetype.rawValue)+(pull ? ":pull":":main")
        let shardsKey=transaction+":shards",smokeKey=transaction+":smoke"
        if stage != .smoke,!sourceWildSixParticleTransactions.contains(shardsKey) {
            let previousPhase=sourceWildFXDrawingPhase
            sourceWildFXDrawingPhase=pull ? "pull-particles":"main-shards"
            defer {sourceWildFXDrawingPhase=previousPhase}
            do {
                let owner=try NativeRegularSixSharedLayers(context:shared,canvas:canvasRoot,tile:destination,origin:origin,
                    tileSize:geometry.tileSize,destinationDepth:9993,generation:generation,reduced:false,stage:.shardsOnly)
                guard current() else{owner.dispose();return false}
                sourceWildOrdinaryMergeSixShardCounts[appearanceKey,default:[]].append(owner.shardCount)
                sourceWildSixShards[owner.id]=owner
                owner.onFinished={[weak self,weak owner] _ in
                    guard let self,let owner,self.sourceWildSixShards[owner.id] === owner else{return}
                    self.sourceWildSixShards.removeValue(forKey:owner.id)
                }
            } catch {return false}
            guard current() else{return false}
            sourceWildSixParticleTransactions.insert(shardsKey)
            if !pull {sourceWildSixMainPhases[ownerID,default:[]].append(.shards)}
        }
        if stage != .shards,!sourceWildSixParticleTransactions.contains(smokeKey) {
            let previousPhase=sourceWildFXDrawingPhase;sourceWildFXDrawingPhase=pull ? "pull-particles":"main-smoke"
            defer {sourceWildFXDrawingPhase=previousPhase}
            do {
                let recipe=NativeSharedSmokeRecipes.regularSix(tileDepth:9993,reduced:false)
                guard current(),scope.smoke.admit(recipe:recipe,canvas:canvasRoot,tile:destination,generation:generation,
                    origin:origin,renderScale:geometry.tileSize/128,monotonicMilliseconds:CACurrentMediaTime()*1000,reduced:false,
                    current:{[weak self,weak scope,weak shared] gen in
                        guard let self,let scope,let shared else{return false}
                        return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceSixScope === scope &&
                            self.sourceSixShared === shared && shared.canAdmit && self.engine.state.generation==gen
                    },acquireActivity:shared.acquire) != nil,current() else{return false}
                sourceWildOrdinaryMergeSixSmokeRecipes[appearanceKey,default:[]].append(recipe)
            }
            guard current() else{return false}
            sourceWildSixParticleTransactions.insert(smokeKey)
            if !pull {sourceWildSixMainPhases[ownerID,default:[]].append(.smoke)}
        }
        if sourceWildSixParticleTransactions.contains(shardsKey),sourceWildSixParticleTransactions.contains(smokeKey) {
            sourceWildSixParticleAdmissions[appearanceKey,default:0]+=1
            sourceWildSixParticleTransactions.insert(transaction)
        }
        return current()
    }
    private(set) var sourceWildFXDrawingPhase:String?
    private(set) var sourceWildScreenShakeInvocations:[NativeSixSourceShakeGraph.Configuration]=[]
    @discardableResult private func playSourceWildScreenShake(_ configuration:NativeSixSourceShakeGraph.Configuration,ownerID:String,variant:String?,generation:UInt64)->Bool {
        guard sourceAnimationBindingAdmissionOpen,let scope=sourceSixScope,scope.current,
              engine.state.generation==generation,engine.sourceMathRandom === scope.mathRandom,
              let surfaces=sourceSixSurfaces else{return false}
        let previousPhase=sourceWildFXDrawingPhase
        sourceWildFXDrawingPhase=configuration == .magnetPull ? "pull-shake":"main-shake"
        defer {sourceWildFXDrawingPhase=previousPhase}
        let invocationID=configuration.alsoShakeOverlay ? UUID():nil
        var shakeAdmitted=false
        defer {if !shakeAdmitted,let invocationID {sourceScreenShakeTargets.removeValue(forKey:invocationID)}}
        let target=configuration.alsoShakeOverlay ? NativeSourceScreenShakeOverlayTarget.combining(sourceCoreTntShakeTargets[ownerID],captureSourceScreenOverlayShake?(ownerID,variant,generation)):nil
        let overlay=configuration.alsoShakeOverlay ? target?.offset() ?? .zero:nil
        if let invocationID {sourceScreenShakeTargets[invocationID]=(ownerID,variant,generation,target)}
        guard sourceAnimationBindingAdmissionOpen,scope.current,sourceSixScope === scope,engine.state.generation==generation else{return false}
        let pose=boardShake
        let initial=NativeSixSourceShakeGraph.Pose(canvas:[Double(pose.canvas.x),Double(pose.canvas.y)],
            indicator:[Double(pose.indicator.x),Double(pose.indicator.y)],decor:[Double(pose.bottomDecor.x),Double(pose.bottomDecor.y)],
            overlay:overlay.map{[Double($0.x),Double($0.y)]},overlayInvocationID:invocationID)
        guard surfaces.startShake(configuration:configuration,initial:initial,random:scope.mathRandom.next) != nil,
              sourceAnimationBindingAdmissionOpen,scope.current,sourceSixScope === scope,engine.state.generation==generation else{return false}
        shakeAdmitted=true
        if sourceWildScreenShakeInvocations.count==64 {sourceWildScreenShakeInvocations.removeFirst()}
        sourceWildScreenShakeInvocations.append(configuration);return true
    }
    private var sourceSixSurfaces:NativeSixSourceSurfaceOwner?
    private var sourceSixIdleAcquire:((String)->(()->Void)?)?
    private var sourceSixIdleReleases:[String:()->Void]=[:]
    private var sourceSixHeroes:[String:NativeSourceMergeSixHeroOwner]=[:]
    private var sourceMagnetImpacts:[String:NativeSourceMagnetImpactOwner]=[:]
    @MainActor private final class SourceSixContact {
        var shortWildBlastAdmitted=false
        var shortWildBlastTargets:[NativeDiceNode]?
        let source,destination:NativeDiceNode,generation:UInt64,owner:NativeSourceMergeSixAbsorbOwner
        var plan:NativeOrdinaryMovePlan?,directPlan:NativeDirectWildMovePlan?,capture:NativeSourceMergeSixMainCapture<NativeDiceNode>?,root:UUID?
        var transactionID:String? {plan?.id ?? directPlan?.id}
        var visualReceipt:UInt64?
        var destinationCleanupToken:UInt64?
        var destinationSettledDropMarkers:NativeWildMeterDropRuntime.SourceTileMarkers?
        var retired=false
        init(source:NativeDiceNode,destination:NativeDiceNode,generation:UInt64,owner:NativeSourceMergeSixAbsorbOwner){self.source=source;self.destination=destination;self.generation=generation;self.owner=owner}
        isolated deinit {capture?.capturedObjectRetired();owner.dispose()}
    }
    private var sourceSixPrepared:SourceSixContact?
    private var sourceSixContacts:[String:SourceSixContact]=[:]
    var sourceSameObjectSixCount:Int {sourceSixContacts.count}
    @discardableResult func configureSourceOrdinarySixMain(scope:NativeGameplaySourceContext.Scope,
        acquireIdle:@escaping(String)->(()->Void)?) -> Bool {
        guard sourceAnimationBindingAdmissionOpen,sourceSameNodeStackAbsorbsEnabled,sourceOrdinarySixSameNodeEnabled,scope.current,
              sourceSixScope==nil,engine.sourceMergeSixAutoCenterHook==nil,
              sourceDragTweenDriver === scope.tween,sourceStackFrameService === scope.service,
              scope.service.sourceFrameTransportAdmissionOpen,engine.stagedOrdinaryMoves,
              engine.stagedOrdinaryAssignments,UIFont(name:"Arial-BoldMT",size:33) != nil else{return false}
        let generation=engine.state.generation
        let current:(UInt64)->Bool = {[weak self,scope] gen in
            guard let self,self.sourceAnimationBindingAdmissionOpen,self.engine.state.generation==gen,
                  self.sourceSixScope === scope,scope.current else{return false}
            return self.sourceAnimationBindingAdmissionOpen && self.engine.state.generation==gen && self.sourceSixScope === scope && scope.current
        }
        let shared=NativeRegularSixSharedContext(resources:scope.sixResources,
            scheduler:NativeSharedSmokeClockRootScheduler(service:scope.service),
            wall:NativeRegularSixAppWallScheduler(timers:sourceAppTimeouts),smokeRenderer:scope.smoke,
            monotonicNow:{CACurrentMediaTime()*1000},current:current,acquire:{[weak self] receipt in
                guard let self,current(receipt.generation) else{return nil}
                let kind:NativeSourceFrameRuntime.Kind=receipt.kind == .shards ? .regularSixShards:.regularSixSmoke
                return self.beginSourceMotion(kind,id:receipt.invocationID,generation:receipt.generation)
            })
        let surfaces=NativeSixSourceSurfaceOwner(service:scope.service,current:{current(generation)},paintShake:{[weak self] pose in
            guard let self,current(generation) else{return}
            self.applyBoardShake(.init(canvas:CGPoint(x:pose.canvas[0],y:pose.canvas[1]),indicator:CGPoint(x:pose.indicator[0],y:pose.indicator[1]),bottomDecor:CGPoint(x:pose.decor[0],y:pose.decor[1])))
            guard current(generation),let overlay=pose.overlay,let id=pose.overlayInvocationID,
                  var captured=self.sourceScreenShakeTargets[id],captured.2==generation else{return}
            if captured.3==nil {
                captured.3=NativeSourceScreenShakeOverlayTarget.combining(self.sourceCoreTntShakeTargets[captured.0],self.captureSourceScreenOverlayShake?(captured.0,captured.1,generation))
                self.sourceScreenShakeTargets[id]=captured
            }
            guard current(generation) else{return}
            captured.3?.apply(CGPoint(x:overlay[0],y:overlay[1]))
        },retiredShake:{[weak self] pose in
            guard let id=pose.overlayInvocationID else{return};self?.sourceScreenShakeTargets.removeValue(forKey:id)
        })
        let hook=NativeSourceMergeSixAutoCenterHook(usesSourceDestinationParentState:true,prepare:{[weak self] source,destination,gen in
            self?.prepareSourceSixAuto(source:source,destination:destination,generation:gen)
        })
        guard sourceAnimationBindingAdmissionOpen,scope.current,sourceSixScope==nil,engine.sourceMergeSixAutoCenterHook==nil,
              engine.state.generation==generation else{shared.dispose();surfaces.dispose();return false}
        sourceSixScope=scope;sourceSixShared=shared;sourceSixSurfaces=surfaces;sourceSixIdleAcquire=acquireIdle
        sourceSixAutoHook=hook;engine.sourceMergeSixAutoCenterHook=hook
        sourceDisposalSealingEnabled=true;return true
    }
    private func sourceSixNodeCurrent(_ node:NativeDiceNode,generation:UInt64)->Bool {
        guard sourceAnimationBindingAdmissionOpen,sourceSameNodeStackAbsorbsEnabled,(sourceOrdinarySixSameNodeEnabled || sourceDirectWildSameNodeEnabled),let scope=sourceSixScope,
              scope.current,engine.state.generation==generation,nodesByID[node.tileID] === node,
              node.parent === canvasRoot,node.sourceGeneration==generation,node.sourceContactNodeAlive else{return false}
        return sourceAnimationBindingAdmissionOpen && sourceSixScope === scope && scope.current &&
            engine.state.generation==generation && nodesByID[node.tileID] === node && node.parent === canvasRoot && node.sourceGeneration==generation && node.sourceContactNodeAlive
    }
    private func configureSourceDirectWildSpawnOwner(scope:NativeGameplaySourceContext.Scope)->Bool {
        guard sourceEndgameMutationLedgerAdmissionOpen,sourceEndgameMutationScope === scope,
              let binding=sourceEndgameMutationBinding,let special=sourceSpecialTransactions,
              engine.sourceWildSpawnBegin==nil else{return false}
        let generation=engine.state.generation,epoch=sourceEndgameMutationEpoch
        let current:()->Bool = {[weak self,weak scope,weak binding,weak special] in
            guard let self,let scope,let binding,let special else{return false}
            return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceDirectScope === scope &&
                self.sourceEndgameMutationScope === scope && self.sourceEndgameMutationBinding === binding &&
                self.sourceEndgameMutationEpoch==epoch && self.sourceSpecialTransactions === special &&
                self.engine.state.generation==generation
        }
        engine.sourceWildSpawnBegin = {[weak self,weak scope,weak binding,weak special] receipt in
            guard let self,let scope,let binding,let special,current(),receipt.generation==generation,
                  self.engine.sourceWildSpawnBeginIsCurrent(receipt),self.wildSourceResolution?.id==receipt.ownerID,
                  self.sourceWildSpawnClaims[receipt.ownerID]==nil else{return false}
            let captured=self.engine.state
            let claim=binding.beginWildSpawn(receipt,service:scope.service,resets:.init(
                endResolutionFrames:{[weak self] in
                    guard let self,current(),self.wildSourceResolution?.id==receipt.ownerID else{return}
                    self.wildSourceResolution=nil
                    self.finishSourceGameplay(.mergeSixResolution,id:receipt.ownerID,generation:generation)
                },releaseSpecialTransaction:{
                    guard current() else{return}
                    special.directGameplaySettled(id:receipt.ownerID,generation:generation)
                },queueWildAfterGuardRelease:{[weak self,weak scope] in
                    guard let self,let scope,current() else{return}
                    self.requestSourceMeterQueueAfterGuardRelease(scope:scope,generation:generation)
                }),current:{[weak self] in
                    guard let self,current() else{return false}
                    return self.engine.state==captured && self.engine.sourceWildSpawnBeginIsCurrent(receipt)
                })
            guard let claim,current(),self.engine.state==captured,
                  self.engine.sourceWildSpawnBeginIsCurrent(receipt) else {
                if current(){self.onSourcePresentationFailure?("source_wild_spawn_owner_refused",generation)}
                return false
            }
            self.sourceWildSpawnClaims[receipt.ownerID]=claim
            self.sourceWildSpawnOwnerBeginCount+=1
            return true
        }
        return current()
    }
    private var sourceOwnedFinalMergePresenceAuthority:NativeSourceFinalMergePresenceAuthority?
    @discardableResult func configureSourceDirectWildMain(scope:NativeGameplaySourceContext.Scope)->Bool {
        guard sourceAnimationBindingAdmissionOpen,sourceDirectWildSameNodeEnabled,
              sourceSixScope === scope,sourceDirectScope==nil,scope.current,sourceSpecialTransactions != nil,
              sourceSpecialIdleAdmissionOpen,engine.stagedDirectWildMoves,engine.stagedDirectWildAssignments,
              sourceStackFrameService === scope.service,sourceDragTweenDriver === scope.tween,
              scope.service.sourceFrameTransportAdmissionOpen else{return false}
        guard sourceAnimationBindingAdmissionOpen,scope.current,sourceSixScope === scope,sourceSpecialIdleAdmissionOpen else{return false}
        guard !sourceStackCoreFaceReceiptsEnabled ||
              (engine.sourceMathRandom === scope.mathRandom && sourceMicrotaskInstallation?.isCurrent==true) else{return false}
        if sourceStackCoreFaceReceiptsEnabled {
            guard let authority=sourceOwnedOrdinaryMinimumTileAuthority,
                  engine.sourceOrdinaryMinimumTileAuthority === authority,authority.isCurrent(),
                  engine.sourceWildMinimumTileAuthority==nil else{return false}
            engine.sourceWildMinimumTileAuthority=authority
        }
        sourceDirectScope=scope
        engine.sourceLateFinalVisualBegin = {[weak self] receipt in self?.startSourceLateFinalVisual(receipt) ?? false}
        sourceSixIdleAcquire={[weak self] reason in self?.acquireSourceSpecialIdle(reason:reason)}
        if sourceStackCoreFaceReceiptsEnabled {
            if sourceEndgameMutationLedgerAdmissionOpen,
               !configureSourceDirectWildSpawnOwner(scope:scope) {return false}
            engine.sourceWildLockedFaceCommit = {[weak self,weak scope] action,tile in
                guard let self,let scope else{return false}
                return self.commitSourceWildLockedFace(action,tile:tile,scope:scope)
            }
            engine.sourceWildLockedBonusConstruct = {[weak self,weak scope] tile,generation in
                guard let self,let scope else{return false}
                let accepted=self.constructSourceWildLockedBonus(tile,generation:generation,scope:scope)
                if !accepted{self.onSourcePresentationFailure?("source_wild_bonus_constructor_refused",generation)}
                return accepted
            }
            engine.sourceWildLockedBonusPop = {[weak self,weak scope] bonus in
                guard let self,let scope,scope.current,self.sourceDirectScope === scope else{return false}
                self.startWildLockedBonus(ids:[bonus.tileID])
                return self.sourceWildBonusPops[bonus.tileID]?.active==true
            }
            engine.sourceRetainedDirectDestinationCleanup = {[weak self,weak scope] receipt in
                guard let self,let scope,scope.current,self.sourceDirectScope === scope,
                      self.engine.state.generation==receipt.generation,
                      self.engine.sourceRetainedDirectDestination==receipt else{return false}
                self.scheduleSourceRetainedDirectDestinationCleanup(receipt,scope:scope,delayMilliseconds:0)
                return true
            }
            engine.sourceWildCoroutineFinally = {[weak self,weak scope] transactionID,generation in
                guard let self,let scope,self.sourceAnimationBindingAdmissionOpen,scope.current,
                      self.sourceDirectScope === scope,self.engine.state.generation==generation,
                      self.engine.hasSettledSourceWildSpawnCoroutine(transactionID:transactionID,generation:generation),
                      self.wildSourceResolution?.id==transactionID,
                      let installation=self.sourceMicrotaskInstallation,installation.isCurrent,
                      self.sourceWildCoroutineFinallys[transactionID]==nil else{return false}
                self.sourceWildCoroutineFinallys[transactionID]=generation
                let accepted=installation.enqueue{[weak self,weak scope,weak installation] in
                    guard let self,self.sourceWildCoroutineFinallys[transactionID]==generation else{return}
                    self.sourceWildCoroutineFinallys.removeValue(forKey:transactionID)
                    guard let scope,let installation,self.sourceAnimationBindingAdmissionOpen,scope.current,
                          self.sourceDirectScope === scope,self.sourceMicrotaskInstallation === installation,
                          installation.isCurrent,self.engine.state.generation==generation,
                          self.engine.hasSettledSourceWildSpawnCoroutine(transactionID:transactionID,generation:generation),
                          let captured=self.wildSourceResolution,captured.id==transactionID,captured.generation==generation else{return}
                    self.sourceWildCoroutineFinallyDeliveredCount+=1
                    if self.engine.sourceWildSpawnBegin != nil {
                        guard let binding=self.sourceEndgameMutationBinding,
                              let claim=self.sourceWildSpawnClaims.removeValue(forKey:transactionID) else {
                            self.onSourcePresentationFailure?("source_wild_finally_owner_missing",generation);return
                        }
                        if binding.resetSpawn(claim) {self.sourceWildSpawnOwnerResetCount+=1}
                        else {self.onSourcePresentationFailure?("source_wild_finally_owner_stale",generation)}
                        return
                    }
                    self.wildSourceResolution=nil
                    // Source reset order: frames end before special release;
                    // that actual release notifies the captured meter queue.
                    self.finishSourceGameplay(.mergeSixResolution,id:transactionID,generation:generation)
                    guard self.sourceAnimationBindingAdmissionOpen,scope.current,
                          self.sourceDirectScope === scope,self.sourceMicrotaskInstallation === installation,
                          installation.isCurrent,self.engine.state.generation==generation else{return}
                    self.sourceSpecialTransactions?.directGameplaySettled(id:transactionID,generation:generation)
                }
                if !accepted {
                    self.sourceWildCoroutineFinallys.removeValue(forKey:transactionID)
                    self.onSourcePresentationFailure?("source_wild_coroutine_finally_fifo_refused",generation)
                }
                return accepted
            }
            engine.sourceWildCoroutineResume = {[weak self,weak scope] transactionID,generation in
                guard let self,let scope,self.sourceAnimationBindingAdmissionOpen,scope.current,
                      self.sourceDirectScope === scope,self.engine.state.generation==generation,
                      let installation=self.sourceMicrotaskInstallation,installation.isCurrent else{return false}
                if self.sourceWildCoroutineResumes[transactionID]==generation{return true}
                self.sourceWildCoroutineResumes[transactionID]=generation
                let accepted=installation.enqueue{[weak self,weak scope,weak installation] in
                    guard let self,self.sourceWildCoroutineResumes[transactionID]==generation else{return}
                    self.sourceWildCoroutineResumes.removeValue(forKey:transactionID)
                    guard let scope,let installation,self.sourceAnimationBindingAdmissionOpen,scope.current,
                          self.sourceDirectScope === scope,self.sourceMicrotaskInstallation === installation,
                          installation.isCurrent,self.engine.state.generation==generation,
                          self.engine.pendingDirectWild?.id==transactionID else{return}
                    let previous=self.engine.state
                    let result=self.engine.commitSourceLateFinalMergeGuard(ownerID:transactionID,generation:generation) ??
                        self.engine.resumeSourceWildSpawnCoroutine(transactionID:transactionID,generation:generation)
                    guard result.accepted else{
                        NSLog("[NativeSourceWildCoroutine] rejected=%@ physical=%@ minimum=%@",result.events.compactMap(\.reason).joined(separator:","),self.sourcePhysicalBoardCaptureDiagnostic,self.sourceMinimumCaptureDiagnostic)
                        self.onSourcePresentationFailure?("source_wild_coroutine_resume_refused",generation);return
                    }
                    self.sourceWildCoroutineResumeDeliveredCount+=1
                    self.consume(result,previous:previous);self.finishWildSourceResolutionIfReady()
                }
                if !accepted {
                    self.sourceWildCoroutineResumes.removeValue(forKey:transactionID)
                    self.onSourcePresentationFailure?("source_wild_coroutine_fifo_refused",generation)
                }
                return accepted
            }
            engine.sourceDirectLockedBonusGuardResume = {[weak self,weak scope] receipt in
                guard let self,let scope,self.sourceAnimationBindingAdmissionOpen,scope.current,
                      self.sourceDirectScope === scope,self.engine.state.generation==receipt.generation,
                      self.engine.pendingSourceDirectLockedBonusGuard==receipt,
                      let installation=self.sourceMicrotaskInstallation,installation.isCurrent,
                      self.sourceDirectLockedBonusGuardResumes[receipt.id]==nil else{return false}
                self.sourceDirectLockedBonusGuardResumes[receipt.id]=receipt
                let accepted=installation.enqueue{[weak self,weak scope,weak installation] in
                    guard let self,self.sourceDirectLockedBonusGuardResumes.removeValue(forKey:receipt.id)==receipt else{return}
                    guard let scope,let installation,self.sourceAnimationBindingAdmissionOpen,scope.current,
                          self.sourceDirectScope === scope,self.sourceMicrotaskInstallation === installation,
                          installation.isCurrent,self.engine.sourceDirectLockedBonusGuardIsCurrent(receipt) else {
                        _=self.engine.retireSourceDirectLockedBonusGuard(receipt);return
                    }
                    let previous=self.engine.state,result=self.engine.resumeSourceDirectLockedBonusGuard(receipt)
                    guard result.accepted else {
                        _=self.engine.retireSourceDirectLockedBonusGuard(receipt)
                        NSLog("[NativeSourceWildBonus] rejected=%@ physical=%@",result.events.compactMap(\.reason).joined(separator:","),self.sourcePhysicalBoardCaptureDiagnostic)
                        self.onSourcePresentationFailure?("source_direct_outer_bonus_guard_refused",receipt.generation);return
                    }
                    self.sourceDirectLockedBonusGuardAwaitDeliveredCount+=1
                    self.consume(result,previous:previous)
                }
                if !accepted {self.sourceDirectLockedBonusGuardResumes.removeValue(forKey:receipt.id)}
                return accepted
            }
            engine.sourceWildSpawnBouncePublish = {[weak self,weak scope] presentation,actionID in
                guard let self,let scope,scope.current,self.sourceDirectScope === scope,
                      let node=self.nodesByID[presentation.tileID],node.sourceGeneration==presentation.generation else{return false}
                self.startWildSpawnVisual(presentation,node:node,actionID:actionID)
                guard self.sourceWildOpenBounces[presentation.tileID]?.owner.active==true else{return false}
                self.sourceWildPublishedBounceActionIDs.insert(actionID);return true
            }
            engine.sourceWildFailedPrimaryRetire = {[weak self,weak scope] tile,ownerID,generation in
                guard let self,let scope,scope.current,self.sourceDirectScope === scope,
                      self.engine.state.generation==generation,
                      self.engine.state.tile(at:tile.cell)?.id==tile.id,
                      let node=self.nodesByID[tile.id],node.sourceGeneration==generation else{return false}
                // Retire this exact failed constructor before interrupting its APP
                // root, so its stale child callback cannot reject the coroutine.
                if let bounce=self.sourceWildOpenBounces.removeValue(forKey:tile.id) {
                    node.unbindSourceAppSpawnInterruption(id:bounce.id);bounce.owner.interrupt()
                }
                if let visual=self.wildSpawnVisuals.removeValue(forKey:tile.id) {visual.3?();self.finishVisual(visual.0)}
                self.sourceWildConstructorNodes.removeValue(forKey:tile.id)
                self.nodesByID.removeValue(forKey:tile.id);node.dispose();node.removeFromParent()
                return scope.current && self.sourceDirectScope === scope
            }
            engine.sourceWildHardPrimaryConstruct = {[weak self,weak scope] tile,generation in
                guard let self,let scope,self.constructSourceWildLockedBonus(tile,generation:generation,scope:scope),
                      let node=self.nodesByID[tile.id] else{return false}
                return node.prepareSourceHardPrimaryBeforeValue()
            }
            engine.sourceWildPrimaryFaceCommit = {[weak self,weak scope] action,tile in
                guard let self,let scope else{return false}
                let accepted=self.commitSourceWildPrimaryFace(action,tile:tile,scope:scope)
                if !accepted {self.onSourcePresentationFailure?("source_wild_primary_constructor_not_admitted",action.generation)}
                return accepted
            }
        }
        // Full app binding borrows the existing exact physical tile authority.
        // Partial Scene seams and NativeRaw remain outside this admission.
        if sourceStackCoreFaceReceiptsEnabled {
            guard engine.sourceFinalMergePresenceAuthority==nil,sourceOwnedFinalMergePresenceAuthority==nil else{return false}
            let generation=engine.state.generation
            let current:()->Bool = {[weak self,weak scope] in
                guard let self,let scope else{return false}
                return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceDirectScope === scope &&
                    self.engine.state.generation==generation
            }
            let authority=NativeSourceFinalMergePresenceAuthority(isCurrent:current,capture:{[weak self] in
                guard let self,current(),let board=self.captureSourcePhysicalBoard(),board.isStillCurrent() else{return nil}
                var runtime:[String:NativeNoMovesTileRuntime]=[:]
                for model in board.canonicalState.tiles {
                    guard current(),let physical=board.tiles[model.id],
                          let marker=self.captureSourceGameplayTileMarkers(model.id),current() else{return nil}
                    runtime[model.id]=marker.noMovesRuntime(eventMode:physical.eventMode)
                }
                guard current(),board.isStillCurrent() else{return nil}
                return .init(canonicalState:board.canonicalState,physicalTiles:board.observedState.tiles,runtime:runtime)
            })
            guard current() else{return false}
            sourceOwnedFinalMergePresenceAuthority=authority;engine.sourceFinalMergePresenceAuthority=authority
            engine.sourceDirectPhysicalFinalSnapshotEnabled=true;engine.sourceWildExtraFinalGuardsEnabled=true
            engine.sourceDirectNormalPreSpawnGuardsEnabled=engine.sourceWildSpawnBegin != nil
            engine.sourceDirectNormalLockedBonusGuardsEnabled=engine.sourceWildSpawnBegin != nil
            engine.sourceWildEndgamePhysicalGuardsEnabled=engine.sourceWildSpawnBegin != nil
            engine.sourceDirectEndgameLockedBonusGuardsEnabled=engine.sourceWildSpawnBegin != nil
        }
        return true
    }
    private func constructSourceWildLockedBonus(_ tile:NativeTile,generation:UInt64,
        scope:NativeGameplaySourceContext.Scope)->Bool {
        let captured=engine.state
        guard sourceAnimationBindingAdmissionOpen,scope.current,sourceDirectScope === scope,
              sourceSixScope === scope,generation==captured.generation,tile.value==0,tile.locked,
              nodesByID[tile.id]==nil,let geometry,let driver=sourceOuterTimelineDriver,
              textures.sourceRetainedRegularOpenTexturesReady else{return false}
        let roll=scope.mathRandom.next()
        guard roll.isFinite,roll>=0,roll<1,sourceAnimationBindingAdmissionOpen,scope.current,
              sourceDirectScope === scope,engine.state==captured,nodesByID[tile.id]==nil else{return false}
        let node=NativeDiceNode(id:tile.id,value:0,kind:"regular",variant:nil,depth:1,locked:true,
            textures:textures,sourceSpecialIdle:scope.specialIdle)
        node.position=geometry.center(row:tile.cell.row,column:tile.cell.column)
        node.zPosition=CGFloat(tile.cell.row*captured.columns+tile.cell.column)
        canvasRoot.addChild(node);nodesByID[tile.id]=node;captureSourceTutorialObject(node)
        guard node.prepareSourceInitialHolder(rotation:roll*0.12-0.06,generation:generation,cell:tile.cell),
              sourceAnimationBindingAdmissionOpen,scope.current,engine.state==captured else{
            nodesByID.removeValue(forKey:tile.id);node.dispose();return false
        }
        node.installSourceOuterDriver(driver,generation:generation,geometryScale:geometry.scale)
        if let tween=sourceDragTweenDriver{node.installSourceDragTweenDriver(tween)}
        node.prepareSourceLockedBonus(alpha:tile.alpha)
        sourceWildConstructorNodes[tile.id]=node
        if sourceWildConstructorBatch==nil {
            sourceWildConstructorEpoch &+= 1;let epoch=sourceWildConstructorEpoch
            sourceWildConstructorBatch=scope.service.requestSourceAnimationFrame(ownerID:"wild-bonus-constructors:\(generation)",generation:generation,
                callback:{[weak self,weak scope] in
                    guard let self,let scope,self.sourceWildConstructorEpoch==epoch else{return}
                    self.sourceWildConstructorBatch=nil
                    let nodes=self.sourceWildConstructorNodes;self.sourceWildConstructorNodes=[:]
                    for(id,node) in nodes where self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceDirectScope === scope && self.engine.state.generation==generation {
                        if self.nodesByID[id] === node,node.parent === self.canvasRoot,node.sourceGeneration==generation{node.flushSourceInitialHolderVisuals()}
                    }
                },onCancelled:{[weak self] in
                    guard let self,self.sourceWildConstructorEpoch==epoch else{return}
                    self.sourceWildConstructorBatch=nil;self.sourceWildConstructorNodes=[:]
                })
        }
        guard sourceWildConstructorBatch != nil,scope.current,engine.state==captured else{
            sourceWildConstructorNodes.removeValue(forKey:tile.id);nodesByID.removeValue(forKey:tile.id);node.dispose();return false
        }
        return true
    }
    private func commitSourceWildPrimaryFace(_ action:NativeWildSpawnAction,tile:NativeTile,
        scope:NativeGameplaySourceContext.Scope)->Bool {
        let generation=action.generation,captured=engine.state
        if action.kind == .hardPrimary {
            guard sourceAnimationBindingAdmissionOpen,scope.current,sourceDirectScope === scope,
                  sourceSixScope === scope,generation==captured.generation,let node=nodesByID[tile.id],
                  node.sourceGeneration==generation,node.sourceContactNodeAlive,node.parent === canvasRoot else{return false}
            let current:()->Bool = {[weak self,weak node,weak scope] in
                guard let self,let node,let scope else{return false}
                return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceDirectScope === scope &&
                    self.engine.state.generation==generation && self.nodesByID[tile.id] === node &&
                    node.parent === self.canvasRoot && node.sourceGeneration==generation && node.sourceContactNodeAlive
            }
            guard node.openSourceAppSpawnHolder(tile.value,service:scope.service,random:{scope.mathRandom.next()},
                current:current,frameCurrent:current,beforeSetValue:{current() && self.engine.state==captured},
                onCancelled:{[weak self] in if current(){self?.onSourcePresentationFailure?("source_wild_hard_face_cancelled",generation)}}),
                current(),engine.state==captured else{return false}
            sourceWildHardPrimaryFaceActionIDs.insert(action.id);return true
        }
        guard sourceAnimationBindingAdmissionOpen,scope.current,sourceDirectScope === scope,
              sourceSixScope === scope,action.kind == .primary,action.cell==tile.cell,
              generation==captured.generation,nodesByID[tile.id]==nil,
              let geometry,let driver=sourceOuterTimelineDriver,
              textures.sourceRetainedRegularOpenTexturesReady else{return false}
        let roll=scope.mathRandom.next()
        guard roll.isFinite,roll>=0,roll<1,sourceAnimationBindingAdmissionOpen,scope.current,
              sourceDirectScope === scope,engine.state==captured,nodesByID[tile.id]==nil else{return false}
        let node=NativeDiceNode(id:tile.id,value:0,kind:"regular",variant:nil,depth:1,locked:true,
            textures:textures,sourceSpecialIdle:scope.specialIdle)
        node.position=geometry.center(row:tile.cell.row,column:tile.cell.column)
        node.zPosition=CGFloat(tile.cell.row*captured.columns+tile.cell.column)
        canvasRoot.addChild(node);nodesByID[tile.id]=node;captureSourceTutorialObject(node)
        let current:()->Bool = {[weak self,weak scope,weak node] in
            guard let self,let scope,let node else{return false}
            return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceDirectScope === scope &&
                self.sourceSixScope === scope && self.engine.state.generation==generation &&
                self.nodesByID[tile.id] === node && node.parent === self.canvasRoot &&
                node.sourceContactNodeAlive && node.sourceGeneration==generation
        }
        guard node.prepareSourceInitialHolder(rotation:roll*0.12-0.06,generation:generation,cell:tile.cell),
              current(),engine.state==captured else{node.dispose();return false}
        node.installSourceOuterDriver(driver,generation:generation,geometryScale:geometry.scale)
        if let tween=sourceDragTweenDriver {node.installSourceDragTweenDriver(tween)}
        sourceWildConstructorNodes[tile.id]=node
        if sourceWildConstructorBatch==nil {
            sourceWildConstructorEpoch &+= 1;let epoch=sourceWildConstructorEpoch
            let frame=scope.service.requestSourceAnimationFrame(ownerID:"wild-open-constructors:\(generation)",generation:generation,
                callback:{[weak self,weak scope] in
                    guard let self,let scope,self.sourceWildConstructorEpoch==epoch else{return}
                    self.sourceWildConstructorBatch=nil
                    let nodes=self.sourceWildConstructorNodes;self.sourceWildConstructorNodes=[:]
                    for(id,node) in nodes {
                        guard self.sourceAnimationBindingAdmissionOpen,scope.current,self.sourceDirectScope === scope,
                              self.engine.state.generation==generation else{return}
                        if self.nodesByID[id] === node,node.parent === self.canvasRoot,node.sourceGeneration==generation {
                            node.flushSourceInitialHolderVisuals()
                        }
                    }
                },onCancelled:{[weak self] in
                    guard let self,self.sourceWildConstructorEpoch==epoch else{return}
                    self.sourceWildConstructorBatch=nil;self.sourceWildConstructorNodes=[:]
                })
            guard current(),engine.state==captured,sourceWildConstructorEpoch==epoch,let frame else{frame?.cancel();return false}
            sourceWildConstructorBatch=frame
        }
        guard current(),node.openSourceAppSpawnHolder(tile.value,service:scope.service,random:{scope.mathRandom.next()},
            current:current,frameCurrent:current,beforeSetValue:{current() && self.engine.state==captured},
            onCancelled:{[weak self] in if current(){self?.onSourcePresentationFailure?("source_wild_primary_face_cancelled",generation)}}),
            current(),engine.state==captured else{return false}
        node.paintSourceOuterScale(.init(x:0.30,y:0.30))
        sourceWildPrimaryFaceActionIDs.insert(action.id)
        return current() && engine.state==captured
    }
    private func commitSourceWildLockedFace(_ action:NativeWildSpawnAction,tile:NativeTile,
        scope:NativeGameplaySourceContext.Scope)->Bool {
        let generation=action.generation,id=tile.id,captured=engine.state
        guard let node=nodesByID[id] else{return false}
        let current:()->Bool = {[weak self,weak scope,weak node] in
            guard let self,let scope,let node else{return false}
            return self.sourceAnimationBindingAdmissionOpen && scope.current &&
                self.sourceSixScope === scope && self.sourceDirectScope === scope &&
                self.engine.state.generation==generation && self.nodesByID[id] === node && node.parent === self.canvasRoot &&
                node.sourceContactNodeAlive && node.sourceGeneration==generation
        }
        guard current(),action.kind == .locked,action.tileID==id,
              node.value==0,node.locked,
              node.openSourceAppSpawnHolder(tile.value,service:scope.service,random:{scope.mathRandom.next()},
                current:current,frameCurrent:current,beforeSetValue:{current() && self.engine.state==captured},
                onCancelled:{[weak self] in if current(){self?.onSourcePresentationFailure?("source_wild_locked_face_cancelled",generation)}}),
              current(),engine.state==captured else {
            onSourcePresentationFailure?("source_wild_locked_face_not_admitted",generation);return false
        }
        // The literal successful spawnBounce writes scale before direction Math.
        node.paintSourceOuterScale(.init(x:0.30,y:0.30))
        guard current(),engine.state==captured else{return false}
        sourceWildLockedFaceActionIDs.insert(action.id)
        return true
    }
    private func startSourceLateFinalVisual(_ receipt:NativeSourceLateFinalMergeReceipt)->Bool {
        guard sourceAnimationBindingAdmissionOpen,let scope=sourceDirectScope,scope.current,
              engine.state.generation==receipt.generation,engine.pendingSourceLateFinalMerge==receipt,
              let geometry,let destination=nodesByID[receipt.destination.id] else{return false}
        if let retained=sourceDirectRetainedDestinations[receipt.ownerID],retained.0.generation==receipt.generation,
           retained.0.tileID==receipt.destination.id,nodesByID[retained.0.tileID] === retained.1 {
            guard scope.mergeSixDestinationCleanup.release(retained.1,token:retained.2) else{return false}
            sourceDirectRetainedDestinations.removeValue(forKey:receipt.ownerID)
            retained.1.sourceMergeSixLastMerge=true;retained.1.sourceMergeSixFinalAllowedByResolver=true
        }
        if receipt.archetype == .tnt {
            let mainAwaitingShake=sourceWildSixMainPhases[receipt.ownerID]?.contains(.presentation)==true &&
                sourceWildSixMainPhases[receipt.ownerID]?.contains(.shards) != true
            recordSourceWildSixPresentation(receipt.ownerID)
            if let variant=receipt.variant {
                guard authoredFinale(variant,at:geometry.center(row:receipt.destination.cell.row,column:receipt.destination.cell.column)) else{return false}
            } else {
                let before=sourceTntFinaleSourceConstructionCount;coreTntFinale()
                guard sourceTntFinaleSourceConstructionCount==before+1 else{return false}
            }
            guard sourceAnimationBindingAdmissionOpen,scope.current,engine.pendingSourceLateFinalMerge==receipt else{return false}
            // Main owns its upcoming actual shake; this accepted constructor
            // must not steal that caller's shard/smoke RNG boundary.
            if mainAwaitingShake{return true}
            return playSourceWildMergeSixParticles(ownerID:receipt.ownerID,archetype:receipt.archetype,variant:receipt.variant,
                destination:destination,generation:receipt.generation)
        }
        guard playSourceWildMergeSixParticles(ownerID:receipt.ownerID,archetype:receipt.archetype,variant:receipt.variant,
            destination:destination,generation:receipt.generation,stage:.shards) else{return false}
        recordSourceWildSixPresentation(receipt.ownerID)
        if let variant=receipt.variant {
            guard authoredFinale(variant,at:geometry.center(row:receipt.destination.cell.row,column:receipt.destination.cell.column)) else{return false}
            return playSourceWildMergeSixParticles(ownerID:receipt.ownerID,archetype:receipt.archetype,variant:variant,
                destination:destination,generation:receipt.generation,stage:.smoke)
        }
        switch receipt.archetype {
        case .star:coreStarFinale()
        case .juice:guard coreJuiceFinale() else{return false}
        case .tnt:
            let before=sourceTntFinaleSourceConstructionCount;coreTntFinale()
            guard sourceTntFinaleSourceConstructionCount==before+1 else{return false}
        case .magnet:guard coreMagnetFinale() else{return false}
        }
        return sourceAnimationBindingAdmissionOpen && scope.current && engine.pendingSourceLateFinalMerge==receipt &&
            playSourceWildMergeSixParticles(ownerID:receipt.ownerID,archetype:receipt.archetype,variant:nil,
                destination:destination,generation:receipt.generation,stage:.smoke)
    }
    #if DEBUG
    func sourceDirectContactAdmissionDiagnostics(sourceID:String,destinationID:String)->String {
        guard let source=engine.state.tiles.first(where:{$0.id==sourceID}),
              let destination=engine.state.tiles.first(where:{$0.id==destinationID}),
              let src=nodesByID[sourceID],let dst=nodesByID[destinationID] else{return "missing physical pair"}
        let scope=sourceSixScope
        let final=engine.sourceDirectTntFinalAdmission(source:source,destination:destination)
        return "direct=\(sourceDirectWildSameNodeEnabled) scope=\(scope?.current==true)/\(scope === sourceDirectScope) " +
            "nodes=\(sourceSixNodeCurrent(src,generation:engine.state.generation))/\(sourceSixNodeCurrent(dst,generation:engine.state.generation)) " +
            "outer=\(src.sourceOuterDriven)/\(dst.sourceOuterDriven) values=\(src.value):\(source.value)/\(dst.value):\(destination.value) " +
            "depth=\(src.depth):\(source.stackDepth)/\(dst.depth):\(destination.stackDepth) frame=\(src.sourceRegularFramePending)/\(dst.sourceRegularFramePending) " +
            "face=\(scope.map{dst.sourceWildDestinationFaceReady(service:$0.service)} ?? false) texture=\(sourceDirectDestinationTexture(destination) != nil) " +
            "final=\(String(describing:final)) transactions=\(sourceSpecialTransactions != nil) idle=\(sourceSpecialIdleAdmissionOpen) acquire=\(sourceSixIdleAcquire != nil) " +
            "handoff=\(sourceStackDecisionMatches(engine.state,source:source,destination:destination))/\(sourceStackFrameReady(dst,generation:engine.state.generation))"
    }
    #endif
    private func sourceDirectReady(source:NativeTile,destination:NativeTile,generation:UInt64)->Bool {
        guard sourceAnimationBindingAdmissionOpen,sourceDirectWildSameNodeEnabled,
              (source.isWild || destination.isWild),
              sourceSpecialTransactions != nil,engine.stagedDirectWildMoves,engine.stagedDirectWildAssignments,
              let scope=sourceSixScope,sourceDirectScope === scope,scope.current,sourceSpecialIdleAdmissionOpen,
              let src=nodesByID[source.id],let dst=nodesByID[destination.id],
              sourceSixNodeCurrent(src,generation:generation),sourceSixNodeCurrent(dst,generation:generation),
              src.sourceOuterDriven,dst.sourceOuterDriven,src.value==source.value,dst.value==destination.value,
              src.depth==source.stackDepth,dst.depth==destination.stackDepth,
              !src.sourceRegularFramePending,!dst.sourceRegularFramePending,
              sourceSixPrepared==nil,sourceSixContacts.isEmpty,sourceSixIdleAcquire != nil,
              engine.state.generation==generation else{return false}
        if destination.isWild {
            if sourceStackCoreFaceReceiptsEnabled {
                guard let markers=sourceWildDropTileMarkers(dst),!markers.dropping,!markers.handoffLocked else{return false}
            }
            guard sourceDirectDestinationTexture(destination) != nil,
                  dst.sourceWildDestinationFaceReady(service:scope.service) else{return false}
        } else {guard dst.sourceMergeSixFaceReady(service:scope.service) else{return false}}
        let archetype=source.gameplayArchetype ?? destination.gameplayArchetype
        let pull=archetype == .magnet && !NativeGameplayResolver.magnetCandidates(engine.state.tiles,source:source,destination:destination).isEmpty
        let final:NativeFinalMergeSnapshot
        if archetype != nil,engine.sourceDirectPhysicalFinalSnapshotEnabled {
            guard let captured=engine.sourceDirectTntFinalAdmission(source:source,destination:destination) else{return false}
            final=captured
        } else {final=NativeGameplayResolver.finalMerge(engine.state.tiles,source:source,destination:destination,effectiveSum:6,hasTilesToPull:pull)}
        guard final.isFinalMerge || archetype == .star || archetype == .juice || (archetype == .magnet && !pull && engine.stagedDirectWildAssignments) else{return false}
        if archetype == .star || archetype == .juice {guard sourceHUDStarJobsAdmissionOpen else{return false}}
        if final.isFinalMerge {guard engine.finalePresentationAdmitted != nil else{return false}}
        return sourceSixNodeCurrent(src,generation:generation) && sourceSixNodeCurrent(dst,generation:generation)
    }
    private func sourceSixReady(source:NativeTile,destination:NativeTile,generation:UInt64)->Bool {
        guard !source.isWild,!destination.isWild,source.value+destination.value==6,
              let scope=sourceSixScope,let src=nodesByID[source.id],let dst=nodesByID[destination.id],
              sourceSixNodeCurrent(src,generation:generation),sourceSixNodeCurrent(dst,generation:generation),
              src.sourceOuterDriven,dst.sourceOuterDriven,sourceDragTweenDriver === scope.tween,
              sourceStackFrameService === scope.service,scope.service.sourceFrameTransportAdmissionOpen,
              sourceSixShared?.canAdmit==true,sourceSixSurfaces != nil,sourceSixIdleAcquire != nil,
              sourceSixPrepared==nil,sourceSixContacts.isEmpty,dst.sourceMergeSixFaceReady(service:scope.service),
              src.value==source.value,dst.value==destination.value,src.depth==source.stackDepth,dst.depth==destination.stackDepth,
              !src.sourceRegularFramePending,!dst.sourceRegularFramePending else{return false}
        return sourceSixNodeCurrent(src,generation:generation) && sourceSixNodeCurrent(dst,generation:generation)
    }
    private func prepareSourceSixAuto(source:NativeTile,destination:NativeTile,generation:UInt64)->NativeSourceMergeSixAutoCenterLease? {
        guard (sourceSixReady(source:source,destination:destination,generation:generation) || sourceDirectReady(source:source,destination:destination,generation:generation)),let scope=sourceSixScope,
              let src=nodesByID[source.id],let dst=nodesByID[destination.id] else{return nil}
        let owner=NativeSourceMergeSixAbsorbOwner(host:src,driver:scope.tween)
        let entry=SourceSixContact(source:src,destination:dst,generation:generation,owner:owner)
        sourceSixPrepared=entry
        let current:()->Bool = {[weak self,weak entry] in
            guard let self,let entry,!entry.retired else{return false}
            let bound=self.sourceSixPrepared === entry || entry.transactionID.flatMap{self.sourceSixContacts[$0]} === entry
            return bound && self.sourceSixNodeCurrent(entry.source,generation:entry.generation) && self.sourceSixNodeCurrent(entry.destination,generation:entry.generation) && !entry.retired
        }
        guard owner.startAuto(destination:dst.position,current:current,onScaleInitialize:{[weak src] in src?.killSourceActiveScaleChildren()}),current() else{
            if sourceSixPrepared === entry {sourceSixPrepared=nil};entry.retired=true;owner.dispose();return nil
        }
        return NativeSourceMergeSixAutoCenterLease(isCurrent:current,rejected:{[weak self,weak entry] in
            guard let entry,!entry.retired else{return};entry.retired=true
            if self?.sourceSixPrepared === entry {self?.sourceSixPrepared=nil};entry.owner.dispose()
        })
    }
    func sourceRetainedDirectCleanupPresentationCurrent(_ node:NativeDiceNode,
        scope:NativeGameplaySourceContext.Scope,generation:UInt64)->Bool {
        guard sourceAnimationBindingAdmissionOpen,scope.current,sourceDirectScope === scope,
              sourceSixScope === scope,engine.state.generation==generation,
              let receipt=engine.sourceRetainedDirectDestination,receipt.generation==generation,
              receipt.tileID==node.tileID,let owned=sourceDirectRetainedDestinations[receipt.ownerID],
              owned.0==receipt,owned.1 === node,nodesByID[node.tileID] === node,
              node.parent === canvasRoot,node.sourceGeneration==generation,node.sourceContactNodeAlive,
              scope.mergeSixDestinationCleanup.owns(node,token:owned.2),
              let model=engine.state.tiles.first(where:{$0.id==node.tileID}),
              model.value==6,model.archetype==nil,model.variant==node.variant,
              model.sourceWildStateCleared==node.sourceWildStateCleared,
              model.sourceResidualWildPresence==node.sourceResidualWildPresence,
              model.merge6CleanupOwned,model.nonFinalMerge6,!model.visible,model.alpha==0,
              engine.state.sourceDetachedGridTileIDs?.contains(node.tileID)==true,
              node.value==6,node.kind=="regular",node.isHidden,node.alpha==0,
              node.sourceEventMode=="none" else{return false}
        return true
    }
    private func sourceSixOwns(_ node:NativeDiceNode,generation:UInt64)->Bool {
        if let retained=engine.sourceRetainedDirectDestination,retained.generation==generation,
           retained.tileID==node.tileID,let owned=sourceDirectRetainedDestinations[retained.ownerID],owned.0==retained,
           owned.1 === node,nodesByID[node.tileID] === node,node.parent === canvasRoot,
           node.sourceGeneration==generation,node.sourceContactNodeAlive,
           sourceDirectScope?.mergeSixDestinationCleanup.owns(node,token:owned.2)==true {return true}
        return sourceSixContacts.values.contains {entry in
            guard !entry.retired,entry.generation==generation,let capture=entry.capture else{return false}
            return capture.retains(node,id:node.tileID,generation:generation)
        }
    }
    private func startSourceSixContact(_ plan:NativeOrdinaryMovePlan,result:NativeMoveResult,previous:NativeBoardState)->Bool {
        guard let entry=sourceSixPrepared,entry.generation==plan.generation,entry.source.tileID==plan.source.id,
              entry.destination.tileID==plan.destination.id,!entry.retired,let scope=sourceSixScope,
              sourceSixNodeCurrent(entry.source,generation:plan.generation),sourceSixNodeCurrent(entry.destination,generation:plan.generation) else{return false}
        sourceSixPrepared=nil;entry.plan=plan;sourceSixContacts[plan.id]=entry
        entry.destination.sourceMergeSixLastMerge=plan.isFinal
        entry.destination.sourceMergeSixFinalAllowedByResolver=plan.isFinal
        if !plan.isFinal {
            entry.destinationCleanupToken=scope.mergeSixDestinationCleanup.claim(entry.destination)
            guard scope.markNonFinalMergeSix(entry.destination,generation:plan.generation),
                  sourceSixNodeCurrent(entry.destination,generation:plan.generation),!entry.retired else{return false}
        }
        entry.destination.sourceEventMode="none" // literal accepted app-prefix, before frame/idle/audio.
        let capture=NativeSourceMergeSixMainCapture(plan:.ordinary(plan),engine:engine,source:entry.source,destination:entry.destination,hooks:.init(
            contextCurrent:{[weak self] in self?.sourceAnimationBindingAdmissionOpen==true && self?.sourceSixScope === scope && scope.current},
            nodeCurrent:{[weak self] node,_,gen in self?.sourceSixNodeCurrent(node,generation:gen)==true},
            captureGeometry:{[weak self] node in
                guard let self,let host=self.gameplayRenderHost,self.sourceSixNodeCurrent(node,generation:plan.generation) else{return nil}
                return .init(destinationScreen:host.scenePointToView(node.convert(CGPoint.zero,to:self),scene:self))
            },removeCapturedPair:{[weak self] src,dst in
                guard let self else{return};for node in [src,dst] where self.nodesByID[node.tileID] === node {
                    self.nodesByID.removeValue(forKey:node.tileID);node.dispose();node.removeFromParent()
                }
            },releaseFramesAndIdle:{[weak self] in self?.retireOrdinarySixVisual();self?.finishSourceGameplay(.mergeSixResolution,id:plan.id,generation:plan.generation)},
            releaseSpecialAndQueue:{[weak self] in self?.sourceSpecialTransactions?.absorbInterrupted(id:plan.id,generation:plan.generation)},
            publish:{[weak self,weak entry] committed,geometry in
                guard let self,let entry,!entry.retired,self.sourceSixContacts[plan.id] === entry,self.engine.state.generation==plan.generation else{return}
                if let geometry {
                    self.ordinarySixVisual?.committed=true;self.ordinarySixVisual?.consuming=true
                    guard let hud=self.captureSourceHUDOrigins(committed,screenOrigin:geometry.destinationScreen) else {
                        self.onSourcePresentationFailure?("source_ordinary_hud_origin_not_admitted",plan.generation);return
                    }
                    self.consume(committed,previous:previous)
                    for id in hud {self.sourceCapturedHUDOrigins.removeValue(forKey:id)}
                    self.ordinarySixVisual?.consuming=false;self.releaseOrdinarySixIfReady()
                } else if self.sourceAnimationBindingAdmissionOpen {self.consume(committed,previous:previous)}
            },retireNativeRoots:{[weak entry] in entry?.owner.dispose()}))
        entry.capture=capture
        if let token=entry.destinationCleanupToken {
            let destination=entry.destination
            _=scope.mergeSixDestinationCleanup.scheduleOrdinaryWatchdog(tile:entry.destination,token:token,generation:plan.generation,
                timeouts:sourceAppTimeouts,current:{[weak self,weak scope,weak entry,weak destination] in
                    guard let self,let scope,let destination,self.sourceAnimationBindingAdmissionOpen,
                          self.sourceSixScope === scope,scope.current,
                          self.engine.pendingOrdinarySix==plan,
                          self.sourceSixNodeCurrent(destination,generation:plan.generation) else{return false}
                    // Token admission belongs to the cleanup owner. Its callback
                    // releases that token before this final current check.
                    if self.engine.ordinarySixGameplayCommitted {
                        return self.engine.state.tiles.contains{$0.id==plan.destination.id && $0.cell==plan.destination.cell && $0.value==6 && $0.merge6CleanupOwned && $0.nonFinalMerge6 && !$0.isWild && $0.variant==nil}
                    }
                    guard let entry,!entry.retired,self.sourceSixContacts[plan.id] === entry else{return false}
                    return self.sourceSixNodeCurrent(entry.source,generation:plan.generation)
                },lastMerge:{[weak destination] in destination?.sourceMergeSixLastMerge == true},
                finalAllowed:{[weak destination] in destination?.sourceMergeSixFinalAllowedByResolver == true},
                special:{[weak destination] in destination?.isSpecial == true},removeDestination:{[weak self,weak entry,weak destination] node in
                    guard let self,let destination,destination === node,self.nodesByID[node.tileID] === node else{return}
                    let previous=self.engine.state
                    let result:NativeMoveResult
                    if self.engine.ordinarySixGameplayCommitted {
                        result=self.engine.removeSourceCommittedOrdinarySixWatchdogDestination(receiptID:plan.id,generation:plan.generation)
                    } else {
                        guard let captured=entry?.capture?.removeDestinationByWatchdog() else{return}
                        result=captured
                    }
                    guard result.accepted else{return}
                    self.nodesByID.removeValue(forKey:node.tileID);node.dispose();node.removeFromParent()
                    self.consume(result,previous:previous)
                    self.releaseOrdinarySixIfReady()
                    self.synchronize()
                })
        }
        if !plan.isFinal {
            guard scope.extendNonFinalMergeSixGuard(),sourceSixNodeCurrent(entry.destination,generation:plan.generation),
                  !entry.retired else{return false}
        }
        // Literal app prefix acquires100 and all-live idle suspension before cue.
        beginSourceGameplay(.mergeSixResolution,id:plan.id,generation:plan.generation)
        guard let release=sourceSixIdleAcquire?("merge6-resolution") else{
            capture.capturedObjectRetired();retireSourceSixContact(entry);return false
        }
        guard sourceSixNodeCurrent(entry.source,generation:plan.generation),!entry.retired,sourceSixContacts[plan.id] === entry else{
            release();capture.capturedObjectRetired();retireSourceSixContact(entry);return false
        }
        sourceSixIdleReleases[plan.id]=release
        consume(result,previous:previous) // existing authored cue, then Source hero/face
        guard sourceSixNodeCurrent(entry.source,generation:plan.generation),sourceSixContacts[plan.id] === entry,
              !entry.retired,capture.phase == .captured else{capture.capturedObjectRetired();retireSourceSixContact(entry);return false}
        let started=entry.owner.startMain(destination:entry.destination.position,current:{[weak self,weak entry] in
            guard let self,let entry,!entry.retired else{return false}
            return self.sourceSixContacts[plan.id] === entry && entry.capture?.mainPaintCurrent == true
        },onInstalled:{[weak entry] receipt in
            guard let entry,!entry.retired else{return};entry.root=receipt.id
            if entry.capture?.mainInstalled(receipt.id) != true {entry.capture?.capturedObjectRetired()}
        },onCompleted:{[weak self,weak entry] in
            guard let self,let entry,let root=entry.root else{return}
            let entered=entry.capture?.mainCompleted(root)==true
            self.retireSourceSixContact(entry);self.synchronize()
            if entered {self.enqueueSourceOrdinarySixDepletedCallerAfterMain(plan,scope:scope)}
        },onInterrupted:{[weak self,weak entry] in
            guard let self,let entry,let root=entry.root else{return}
            _=entry.capture?.mainInterrupted(root);self.retireSourceSixContact(entry)
        })
        if !started {capture.capturedObjectRetired();retireSourceSixContact(entry)}
        return started
    }
    private func enqueueSourceOrdinarySixDepletedCallerAfterMain(_ plan:NativeOrdinaryMovePlan,scope:NativeGameplaySourceContext.Scope) {
        // Main publication temporarily retains the old physical source. v9
        // removes it before its forced checker; only the completed root, exact
        // retirement and synchronization may cross this existing FIFO boundary.
        guard sourceAnimationBindingAdmissionOpen,sourceSixScope === scope,scope.current,
              engine.pendingOrdinarySix==plan,engine.ordinarySixGameplayCommitted,
              let receipt=engine.sourceNoMovesCaller(ownerID:plan.id,generation:plan.generation,kind:.mergeMovesDepleted),
              let admission=sourceNoMovesCallerAdmission,
              let installation=sourceMicrotaskInstallation,installation.isCurrent else{return}
        let epoch=sourceNoMovesCallerEpoch
        let accepted=installation.enqueue{[weak self,weak scope,weak installation] in
            guard let self,let scope,let installation,self.sourceAnimationBindingAdmissionOpen,
                  self.sourceSixScope === scope,scope.current,self.engine.state.generation==plan.generation,
                  self.engine.pendingOrdinarySix==plan,self.engine.ordinarySixGameplayCommitted,
                  self.sourceNoMovesCallerEpoch==epoch,self.sourceNoMovesCallerAdmission === admission,
                  self.engine.sourceNoMovesCallerAdmission === admission,
                  self.sourceMicrotaskInstallation === installation,installation.isCurrent,
                  self.engine.sourceNoMovesCallerIsCurrent(receipt) else{return}
            self.startSourceNoMovesDepletedCaller(ownerID:plan.id,kind:.mergeMovesDepleted,generation:plan.generation)
        }
        if !accepted {_=engine.refuseSourceNoMovesCaller(receipt)}
    }
    private func startSourceDirectContact(_ plan:NativeDirectWildMovePlan,result:NativeMoveResult,previous:NativeBoardState)->Bool {
        guard let entry=sourceSixPrepared,entry.generation==plan.generation,entry.source.tileID==plan.source.id,
              entry.destination.tileID==plan.destination.id,!entry.retired,let scope=sourceSixScope,
              sourceSixNodeCurrent(entry.source,generation:plan.generation),sourceSixNodeCurrent(entry.destination,generation:plan.generation) else{return false}
        if plan.destination.isWild,sourceStackCoreFaceReceiptsEnabled {
            // The drop fields belong to this exact object, even after its cell
            // is rebound to the new regular primary. Capture the genuine settled
            // receipt before the accepted prefix clears the old Wild identity.
            guard let markers=sourceWildDropTileMarkers(entry.destination),
                  !markers.dropping,!markers.handoffLocked else{return false}
            entry.destinationSettledDropMarkers=markers
        }
        sourceSixPrepared=nil;entry.directPlan=plan;sourceSixContacts[plan.id]=entry
        // Literal wildActive branch claims even a final Special destination.
        entry.destinationCleanupToken=scope.mergeSixDestinationCleanup.claim(entry.destination)
        entry.destination.sourceMergeSixLastMerge=plan.isFinal
        entry.destination.sourceMergeSixFinalAllowedByResolver=plan.isFinal
        if !plan.isFinal {
            guard scope.markNonFinalMergeSix(entry.destination,generation:plan.generation),
                  scope.extendNonFinalMergeSixGuard(),sourceSixNodeCurrent(entry.destination,generation:plan.generation),
                  !entry.retired else{return false}
        }
        entry.visualReceipt=beginVisual();directPresentationID=plan.id;directPresentationVariant=plan.variant
        specialPresentationIDs.formUnion([plan.source.id,plan.destination.id])
        entry.destination.sourceEventMode="none" // literal accepted app-prefix, before frame/idle/audio.
        // Capture only the old eligible objects. The literal main80 shake
        // draws first; this captured blast then starts before publication can
        // create primary/bonus holders. Entry capture draws no visual RNG.
        if sourceStackCoreFaceReceiptsEnabled,(plan.archetype == .star || plan.archetype == .juice) {
            guard let targets=captureShortWildBoardBlastTargets(sourceID:plan.source.id,destinationID:plan.destination.id) else {
                onSourcePresentationFailure?("source_direct_prefix_blast_not_admitted",plan.generation)
                retireSourceSixContact(entry);return false
            }
            entry.shortWildBlastTargets=targets;entry.shortWildBlastAdmitted=true
        }
        let capture=NativeSourceMergeSixMainCapture(plan:.direct(plan),engine:engine,source:entry.source,destination:entry.destination,hooks:.init(
            contextCurrent:{[weak self] in self?.sourceAnimationBindingAdmissionOpen==true && self?.sourceSixScope === scope && scope.current},
            nodeCurrent:{[weak self] node,_,gen in self?.sourceSixNodeCurrent(node,generation:gen)==true},
            captureGeometry:{[weak self] node in
                guard let self,let host=self.gameplayRenderHost,self.sourceSixNodeCurrent(node,generation:plan.generation) else{return nil}
                return .init(destinationScreen:host.scenePointToView(node.convert(CGPoint.zero,to:self),scene:self))
            },removeCapturedPair:{[weak self] src,dst in
                guard let self else{return}
                for node in [src,dst] where self.nodesByID[node.tileID] === node {
                    self.nodesByID.removeValue(forKey:node.tileID);node.dispose();node.removeFromParent()
                }
            },releaseFramesAndIdle:{[weak self,weak entry] in
                guard let self else{return}
                self.specialPresentationIDs.subtract([plan.source.id,plan.destination.id])
                self.directPresentationID=nil;self.directPresentationVariant=nil
                if let receipt=entry?.visualReceipt {entry?.visualReceipt=nil;self.finishVisual(receipt)}
                self.finishSourceGameplay(.mergeSixResolution,id:plan.id,generation:plan.generation)
            },
            releaseSpecialAndQueue:{[weak self] in self?.sourceSpecialTransactions?.absorbInterrupted(id:plan.id,generation:plan.generation)},
            publish:{[weak self,weak entry] committed,geometry in
                guard let self,let entry,!entry.retired,self.sourceSixContacts[plan.id] === entry,self.engine.state.generation==plan.generation else{return}
                if let geometry {
                    if let retained=self.engine.sourceRetainedDirectDestination,retained.ownerID==plan.id,
                       retained.generation==plan.generation,retained.tileID==entry.destination.tileID,
                       let token=entry.destinationCleanupToken,
                       scope.mergeSixDestinationCleanup.owns(entry.destination,token:token) {
                        self.sourceDirectRetainedDestinations[plan.id]=(retained,entry.destination,token,entry.destinationSettledDropMarkers)
                        entry.destination.isHidden=true;entry.destination.alpha=0;entry.destination.sourceEventMode="none"
                        if retained.endgame {self.scheduleSourceRetainedDirectDestinationCleanup(retained,scope:scope,delayMilliseconds:100)}
                    }

                    let stars=committed.events.filter{$0.kind == .hudStarsPrepared}.flatMap(\.tileIDs)
                    for id in stars {self.sourceCapturedHUDOrigins[id]=(plan.generation,geometry.destinationScreen)}
                    self.specialPresentationIDs.subtract([plan.source.id,plan.destination.id])
                    if plan.archetype == .tnt {
                        self.recordSourceWildSixPresentation(plan.id)
                        self.consume(committed,previous:previous)
                        guard self.sourceAnimationBindingAdmissionOpen,scope.current,
                              self.engine.state.generation==plan.generation else{return}
                    }
                    guard self.playSourceWildScreenShake(.wild(archetype:plan.archetype,isFinal:plan.isFinal || self.engine.hasConfirmedSourceLateFinalMerge(ownerID:plan.id,generation:plan.generation)),ownerID:plan.id,variant:plan.variant,generation:plan.generation) else {
                        self.onSourcePresentationFailure?("source_wild_screen_shake_rejected",plan.generation);return
                    }
                    if let targets=entry.shortWildBlastTargets {
                        entry.shortWildBlastTargets=nil
                        guard self.playShortWildBoardBlast(sourceID:plan.source.id,destinationID:plan.destination.id,
                            center:entry.destination.position,capturedTargets:targets) else {
                            self.onSourcePresentationFailure?("source_direct_main_blast_not_admitted",plan.generation);return
                        }
                    }
                    guard self.playSourceWildMergeSixParticles(ownerID:plan.id,archetype:plan.archetype,variant:plan.variant,
                        destination:entry.destination,generation:plan.generation,stage:.shards) else {
                        self.onSourcePresentationFailure?("source_wild_merge6_shards_rejected",plan.generation);return
                    }
                    if plan.archetype == .magnet {
                        let final = plan.isFinal || self.engine.hasConfirmedSourceLateFinalMerge(ownerID:plan.id,generation:plan.generation)
                        guard self.playSourceMagnetMultiplier(ownerID:plan.id,destination:entry.destination,
                            multiplier:final ? 0:2,generation:plan.generation,service:scope.service,current:{[weak self,scope] in
                                self?.sourceSixScope === scope && scope.current
                            }) else {
                            self.onSourcePresentationFailure?("source_magnet_direct_multiplier_not_bound",plan.generation);return
                        }
                    }
                    if plan.archetype != .tnt {
                        self.recordSourceWildSixPresentation(plan.id)
                        self.consume(committed,previous:previous)
                    }
                    guard self.playSourceWildMergeSixParticles(ownerID:plan.id,archetype:plan.archetype,variant:plan.variant,
                        destination:entry.destination,generation:plan.generation,stage:.smoke) else {
                        self.onSourcePresentationFailure?("source_wild_merge6_particles_rejected",plan.generation);return
                    }
                    for id in stars {self.sourceCapturedHUDOrigins.removeValue(forKey:id)}
                    self.finishWildSourceResolutionIfReady()
                    guard self.sourceAnimationBindingAdmissionOpen,self.engine.state.generation==plan.generation,
                          self.engine.pendingDirectWild?.id==plan.id,let receipt=entry.visualReceipt else{return}
                    entry.visualReceipt=nil
                    self.finishWildSourceResolutionIfReady()
                    if plan.isFinal || self.engine.hasConfirmedSourceLateFinalMerge(ownerID:plan.id,generation:plan.generation) {
                        self.directFinalReceipt=(plan.id,plan.generation,receipt);self.releaseFinalDirectIfReady()
                    } else {
                        // Original wild-only input gate uses setTimeout; global
                        // timeline pause does not freeze its release callback.
                        self.sourceAppTimeouts.schedule(sourceID:plan.id+":source-fx-input-release",generation:plan.generation,
                            delayMilliseconds:plan.archetype == .juice ? 1860:900,elapsed:{[weak self] in
                                guard let self,self.sourceAnimationBindingAdmissionOpen,self.engine.state.generation==plan.generation,
                                      self.engine.pendingDirectWild?.id==plan.id else{return}
                                let before=self.engine.state,result=self.engine.releaseDirectWildPresentation(transactionID:plan.id,generation:plan.generation)
                                self.directPresentationID=nil;self.directPresentationVariant=nil
                                if result.accepted {self.consume(result,previous:before)}
                                self.finishVisual(receipt)
                            })
                    }
                } else if self.sourceAnimationBindingAdmissionOpen {self.consume(committed,previous:previous)}
            },retireNativeRoots:{[weak entry] in entry?.owner.dispose()}))
        entry.capture=capture
        // Literal app prefix acquires100 and all-live idle suspension before cue.
        beginSourceGameplay(.mergeSixResolution,id:plan.id,generation:plan.generation)
        guard let release=sourceSixIdleAcquire?("merge6-resolution") else{
            capture.capturedObjectRetired();retireSourceSixContact(entry);return false
        }
        guard sourceSixNodeCurrent(entry.source,generation:plan.generation),!entry.retired,sourceSixContacts[plan.id] === entry else{
            release();capture.capturedObjectRetired();retireSourceSixContact(entry);return false
        }
        sourceSixIdleReleases[plan.id]=release
        consume(result,previous:previous) // existing authored cue, then Source hero/face
        guard sourceSixNodeCurrent(entry.source,generation:plan.generation),sourceSixContacts[plan.id] === entry,
              !entry.retired,capture.phase == .captured else{capture.capturedObjectRetired();retireSourceSixContact(entry);return false}
        let started=entry.owner.startMain(destination:entry.destination.position,current:{[weak self,weak entry] in
            guard let self,let entry,!entry.retired else{return false}
            return self.sourceSixContacts[plan.id] === entry && self.sourceSixNodeCurrent(entry.source,generation:plan.generation) && self.sourceSixNodeCurrent(entry.destination,generation:plan.generation)
        },onInstalled:{[weak entry] receipt in
            guard let entry,!entry.retired else{return};entry.root=receipt.id
            if entry.capture?.mainInstalled(receipt.id) != true {entry.capture?.capturedObjectRetired()}
        },onCompleted:{[weak self,weak entry] in
            guard let self,let entry,let root=entry.root else{return}
            _=entry.capture?.mainCompleted(root);self.retireSourceSixContact(entry);self.synchronize()
            if let receipt=self.engine.pendingSourceDirectInitialAwait,receipt.ownerID==plan.id,
               receipt.generation==plan.generation,self.sourceAnimationBindingAdmissionOpen,
               scope.current,self.sourceDirectScope === scope {
                if !self.engine.releaseSourceDirectInitialAwait(receipt) {
                    self.onSourcePresentationFailure?("source_direct_initial_physical_await_refused",plan.generation)
                }
            }
        },onInterrupted:{[weak self,weak entry] in
            guard let self,let entry,let root=entry.root else{return}
            _=entry.capture?.mainInterrupted(root);self.retireSourceSixContact(entry)
        })
        if !started {capture.capturedObjectRetired();retireSourceSixContact(entry)}
        return started
    }
    private func prepareSourceDirectPrefix(_ plan:NativeDirectWildMovePlan)->Bool {
        guard let entry=sourceSixContacts[plan.id],entry.directPlan==plan,!entry.retired,let scope=sourceSixScope,
              sourceSixNodeCurrent(entry.destination,generation:plan.generation) else{return false}
        if plan.destination.isWild {
            guard sourceDirectDestinationTexture(plan.destination) != nil,
                  entry.destination.sourceWildDestinationFaceReady(service:scope.service) else{return false}
        } else {guard entry.destination.sourceMergeSixFaceReady(service:scope.service) else{return false}}
        let result=engine.prepareSourceDirectWildPrefix(receiptID:plan.id,generation:plan.generation)
        guard result.accepted,let prefix=engine.sourceDirectWildPrefix,prefix.id==plan.id,
              sourceSixContacts[plan.id] === entry,!entry.retired,sourceSixNodeCurrent(entry.destination,generation:plan.generation) else{return false}
        if plan.destination.isWild {
            guard let texture=sourceDirectDestinationTexture(plan.destination),
                  let face=engine.prepareSourceWildDestinationFace(transactionID:plan.id,generation:plan.generation) else{return false}
            var physicalResult:NativeMoveResult?,physicalPrevious:NativeBoardState?
            let prepared=entry.destination.prepareSourceDirectWildDestination(prefix:prefix,faceReceipt:face,
                preparedStarTexture:texture,service:scope.service,random:{scope.smokeSession.nextVisualRandom()},
                current:{[weak self,weak entry] in
                    guard let self,let entry,!entry.retired,self.sourceSixContacts[plan.id] === entry else{return false}
                    return self.sourceSixNodeCurrent(entry.destination,generation:plan.generation)
                },commitPhysical:{[weak self] in
                    guard let self,self.sourceAnimationBindingAdmissionOpen,self.engine.state.generation==plan.generation else{return false}
                    physicalPrevious=self.engine.state
                    let result=self.engine.commitSourceWildDestinationFace(receiptID:face.id,generation:face.generation)
                    physicalResult=result;return result.accepted
                },onFacePainted:{[weak self] in
                    guard let self,let result=physicalResult,let previous=physicalPrevious,result.accepted,self.sourceAnimationBindingAdmissionOpen,
                          self.engine.state.generation==plan.generation else{return}
                    self.consume(result,previous:previous)
                },onFaceCancelled:{[weak entry] in entry?.capture?.capturedObjectRetired()})
            if prepared && plan.isFinal {
                // Literal hideFinal child-only repeat uses Source app timeout,
                // independent of the global GSAP modal pause.
                sourceAppTimeouts.schedule(sourceID:face.id+":final-hide",generation:plan.generation,delayMilliseconds:80,
                    elapsed:{[weak self,weak entry] in
                        guard let self,let entry,!entry.retired,self.sourceSixContacts[plan.id] === entry,
                              self.sourceSixNodeCurrent(entry.destination,generation:plan.generation) else{return}
                        entry.destination.hideSourceWildDestinationFinalChildren()
                    })
            }
            return prepared
        }
        return entry.destination.prepareSourceDirectWildRegularDestination(prefix,service:scope.service,
            random:{scope.smokeSession.nextVisualRandom()},onFaceCancelled:{[weak entry] in entry?.capture?.capturedObjectRetired()})
    }
    private func scheduleSourceRetainedDirectDestinationCleanup(_ receipt:NativeGameplayEngine.SourceRetainedDirectDestination,scope:NativeGameplaySourceContext.Scope,delayMilliseconds:Int) {
        sourceAppTimeouts.schedule(sourceID:receipt.ownerID+":retained-dst-cleanup",generation:receipt.generation,delayMilliseconds:delayMilliseconds,elapsed:{[weak self,weak scope] in
            guard let self,let scope,scope.current,self.sourceDirectScope === scope,
                  self.engine.sourceRetainedDirectDestination==receipt,
                  let retained=self.sourceDirectRetainedDestinations[receipt.ownerID],retained.0==receipt,
                  self.nodesByID[receipt.tileID] === retained.1,
                  scope.mergeSixDestinationCleanup.owns(retained.1,token:retained.2) else{return}
            let previous=self.engine.state,result=self.engine.removeSourceRetainedDirectDestination(receipt)
            guard result.accepted else{return}
            self.sourceDirectRetainedDestinations.removeValue(forKey:receipt.ownerID)
            scope.mergeSixDestinationCleanup.release(retained.1,token:retained.2)
            self.nodesByID.removeValue(forKey:receipt.tileID);retained.1.dispose();retained.1.removeFromParent()
            self.consume(result,previous:previous)
        })
    }
    private func retireSourceSixContact(_ entry:SourceSixContact) {
        guard !entry.retired else{return};entry.retired=true
        if sourceSixPrepared === entry {sourceSixPrepared=nil}
        if let id=entry.transactionID,sourceSixContacts[id] === entry {sourceSixContacts.removeValue(forKey:id)}
        entry.destination.retireSourceWildDestinationFrames()
        entry.capture?.retireObsolete();entry.owner.dispose()
        if let receipt=entry.visualReceipt {entry.visualReceipt=nil;finishVisual(receipt)}
    }
    private func playSourceSixHeroAndFace(_ plan:NativeOrdinaryMovePlan)->Bool {
        guard let entry=sourceSixContacts[plan.id],let scope=sourceSixScope,!entry.retired,
              sourceSixNodeCurrent(entry.destination,generation:plan.generation) else{return false}
        let target=entry.destination
        let hero=NativeSourceMergeSixHeroOwner(node:target,service:scope.service,generation:plan.generation,current:{[weak self,weak target] in
            guard let self,let target else{return false};return self.sourceSixNodeCurrent(target,generation:plan.generation)
        })
        sourceSixHeroes[plan.id]=hero
        hero.onFinished={[weak self,weak hero] _ in if self?.sourceSixHeroes[plan.id] === hero {self?.sourceSixHeroes.removeValue(forKey:plan.id)}}
        guard hero.begin(random:{scope.smokeSession.nextVisualRandom()}),sourceSixNodeCurrent(target,generation:plan.generation) else{return false}
        return target.prepareSourceMergeSixFace(depth:plan.source.stackDepth+plan.destination.stackDepth,final:plan.isFinal,usesSourceDestinationParentState:true,
            service:scope.service,random:{scope.smokeSession.nextVisualRandom()},onFaceCancelled:{[weak entry] in entry?.capture?.destinationFaceRetired()})
    }
    private func playSourceSixMain(_ plan:NativeOrdinaryMovePlan)->Bool {
        guard let entry=sourceSixContacts[plan.id],!entry.retired,let shared=sourceSixShared,let surfaces=sourceSixSurfaces,
              let geometry,shared.canAdmit,sourceSixNodeCurrent(entry.destination,generation:plan.generation),regularSixPresentations[plan.id]==nil else{return false}
        let origin=entry.destination.position,depth=entry.destination.zPosition
        let slot=NativeRegularSixSharedSlot(context:shared,canvas:canvasRoot,tile:entry.destination)
        let owner:NativeRegularSixSpritePresentation
        do {
            owner=try NativeRegularSixSpritePresentation(origin:origin,tileSize:geometry.tileSize,destinationDepth:depth,
                combinedDepth:plan.source.stackDepth+plan.destination.stackDepth,generation:plan.generation,reduced:reducedBoardEffects,
                hotFactor:0,patternIndex:0,initialShake:boardShake,isCurrent:{[weak self] gen in
                    self?.sourceAnimationBindingAdmissionOpen==true && self?.engine.state.generation==gen && self?.sourceSixShared === shared
                },random:{shared.resources.smoke.nextVisualRandom()},sourceSlot:slot,sourceSurfaces:surfaces)
        } catch {onPresentationFailure?("source_six_shared_layers_not_admitted");return false}
        guard sourceAnimationBindingAdmissionOpen,sourceSixShared === shared,engine.state.generation==plan.generation else{owner.dispose();return false}
        regularSixPresentations[plan.id]=owner
        let visual=beginVisual()
        owner.onFinished={[weak self,weak owner] _ in
            guard let self else{return}
            if self.regularSixPresentations[plan.id] === owner {self.regularSixPresentations.removeValue(forKey:plan.id)}
            self.finishVisual(visual)
        }
        owner.mount(in:canvasRoot);return true
    }
    private func retireSourceSixBindings() {
        let retainedDestinations=sourceDirectRetainedDestinations;sourceDirectRetainedDestinations.removeAll()
        if let scope=sourceDirectScope {
            for retained in retainedDestinations.values {_=scope.mergeSixDestinationCleanup.release(retained.1,token:retained.2)}
        }
        engine.sourceDirectPhysicalFinalSnapshotEnabled=false;engine.sourceWildExtraFinalGuardsEnabled=false
        engine.sourceDirectNormalPreSpawnGuardsEnabled=false
        engine.sourceWildEndgamePhysicalGuardsEnabled=false
        if let receipt=engine.pendingSourceDirectInitialAwait {_=engine.retireSourceDirectInitialAwait(receipt)}
        engine.sourceDirectNormalLockedBonusGuardsEnabled=false;engine.sourceDirectLockedBonusGuardResume=nil
        engine.sourceDirectEndgameLockedBonusGuardsEnabled=false
        let directBonusReceipts=Array(sourceDirectLockedBonusGuardResumes.values);sourceDirectLockedBonusGuardResumes.removeAll()
        for receipt in directBonusReceipts {_=engine.retireSourceDirectLockedBonusGuard(receipt)}
        if let receipt=engine.pendingSourceDirectLockedBonusGuard {_=engine.retireSourceDirectLockedBonusGuard(receipt)}
        let finalGuard=sourceOwnedFinalMergePresenceAuthority;sourceOwnedFinalMergePresenceAuthority=nil
        if let finalGuard,engine.sourceFinalMergePresenceAuthority === finalGuard {engine.sourceFinalMergePresenceAuthority=nil}
        let prepared=sourceSixPrepared,captured=Array(sourceSixContacts.values),hook=sourceSixAutoHook
        sourceSixPrepared=nil;sourceSixAutoHook=nil
        if let hook,engine.sourceMergeSixAutoCenterHook === hook {engine.sourceMergeSixAutoCenterHook=nil}
        prepared?.capture?.capturedObjectRetired();if let prepared{retireSourceSixContact(prepared)}
        for entry in captured {entry.capture?.capturedObjectRetired();retireSourceSixContact(entry)}
        let heroes=Array(sourceSixHeroes.values);sourceSixHeroes.removeAll();for hero in heroes{hero.dispose()}
        let wildShards=Array(sourceWildSixShards.values);sourceWildSixShards.removeAll();for owner in wildShards{owner.dispose()}
        sourceWildSixParticleTransactions.removeAll()
        sourceWildSixMainPhases.removeAll()
        let shared=sourceSixShared,surfaces=sourceSixSurfaces;sourceSixShared=nil;sourceSixSurfaces=nil
        shared?.dispose();surfaces?.dispose()
        let releases=Array(sourceSixIdleReleases.values);sourceSixIdleReleases.removeAll();for release in releases{release()}
        sourceDirectWildDestinationPreparationEpoch &+= 1;sourceDirectWildDestinationTexture=nil
        engine.sourceWildLockedFaceCommit=nil
        engine.sourceWildPrimaryFaceCommit=nil
        engine.sourceWildLockedBonusConstruct=nil
        engine.sourceWildLockedBonusPop=nil
        engine.sourceRetainedDirectDestinationCleanup=nil
        engine.sourceWildHardPrimaryConstruct=nil
        engine.sourceWildFailedPrimaryRetire=nil
        engine.sourceWildSpawnBouncePublish=nil
        engine.sourceLateFinalVisualBegin=nil
        engine.sourceWildCoroutineResume=nil
        engine.sourceWildCoroutineFinally=nil
        engine.sourceWildSpawnBegin=nil
        if let own=sourceOwnedOrdinaryMinimumTileAuthority,engine.sourceWildMinimumTileAuthority === own {engine.sourceWildMinimumTileAuthority=nil}
        sourceSixIdleAcquire=nil;sourceSixScope=nil;sourceDirectScope=nil
    }

    // PRIVATE/default OFF: resources and union service belong to the app scope.
    private var sourceMagnetFallbackScope:NativeGameplaySourceContext.Scope?
    private var sourceMagnetFallbackCallers:[String:NativeSourceMagnetFallbackCaller]=[:]
    private var sourceMagnetConstructorBatch:NativeSourceAnimationClockService.SourceFrameLease?
    private var sourceMagnetConstructorNodes:[String:NativeDiceNode]=[:]
    private var sourceMagnetConstructorEpoch:UInt64=0
    @discardableResult func configureSourceMagnetFallback(scope:NativeGameplaySourceContext.Scope)->Bool {
        guard sourceAnimationBindingAdmissionOpen,scope.current,sourceMagnetFallbackScope==nil,
              sourceOuterTimelineDriver != nil,sourceInitialStartupReady,
              let installation=sourceMicrotaskInstallation,installation.isCurrent,
              let tasks=scope.sourceMicrotaskTasks,installation.tasks === tasks,
              scope.service.sourceMicrotaskTasks === tasks,scope.service.sourceFrameTransportAdmissionOpen,
              sourceAppTimeouts.sourceMicrotaskTasks === tasks,textures.sourceRetainedRegularOpenTexturesReady else{return false}
        sourceMagnetFallbackScope=scope;engine.sourceMagnetFallbacksEnabled=true;sourceDisposalSealingEnabled=true
        return true
    }
    /// Actual app-merge zero-active branch calls this callback. It consumes the
    /// authentic post-commit Core receipt and opens exact captured cells only.
    func sourceMagnetFallback(_ plan:NativeSpecialMovePlan,count:Int,done:@escaping(Bool)->Void)->Bool {
        guard sourceAnimationBindingAdmissionOpen,let scope=sourceMagnetFallbackScope,scope.current,
              let helper=sourceMagnetHelpers[plan.id],helper.active,sourceMagnetFallbackCallers[plan.id]==nil,
              sourceInitialConstruction?.constructorBatchPending != true,
              let installation=sourceMicrotaskInstallation,installation.isCurrent else{return false}
        let current:()->Bool = {[weak self,weak helper,scope] in
            guard let self,let helper,self.sourceAnimationBindingAdmissionOpen,self.sourceMagnetFallbackScope === scope,
                scope.current,self.sourceMagnetHelpers[plan.id] === helper,self.engine.state.generation==plan.generation,
                self.sourceMicrotaskInstallation === installation,installation.isCurrent else{return false}
            let accepted=helper.mayContinueSourceFallback()
            return accepted && self.sourceAnimationBindingAdmissionOpen && self.sourceMagnetFallbackScope === scope && scope.current && self.sourceMagnetHelpers[plan.id] === helper && self.engine.state.generation==plan.generation
        }
        let caller=NativeSourceMagnetFallbackCaller(engine:engine,service:scope.service,hooks:.init(
            current:current,resourcesReady:{[weak self] in self?.textures.sourceRetainedRegularOpenTexturesReady==true},random:{scope.smokeSession.nextVisualRandom()},
            enqueue:{callback in guard current() else{return false};return installation.enqueue(callback)},
            removeHolder:{[weak self] id in
                guard let self,current(),let node=self.nodesByID.removeValue(forKey:id) else{return}
                self.sourceMagnetConstructorNodes.removeValue(forKey:id);node.dispose()
            },construct:{[weak self] opening,rotation in
                guard let self,current(),let holder=opening.holder,let geometry=self.geometry else{return nil}
                if !opening.createdHolder {return self.nodesByID[holder.id]}
                guard self.nodesByID[holder.id]==nil,let rotation,let driver=self.sourceOuterTimelineDriver else{return nil}
                let node=NativeDiceNode(id:holder.id,value:0,kind:"regular",variant:nil,depth:1,locked:true,textures:self.textures,sourceSpecialIdle:scope.specialIdle)
                node.position=geometry.center(row:holder.cell.row,column:holder.cell.column)
                node.zPosition=CGFloat(holder.cell.row*self.engine.state.columns+holder.cell.column)
                self.canvasRoot.addChild(node);self.nodesByID[holder.id]=node;self.captureSourceTutorialObject(node)
                guard node.prepareSourceInitialHolder(rotation:rotation,generation:plan.generation,cell:holder.cell),current(),self.nodesByID[holder.id] === node else{node.dispose();return nil}
                node.installSourceOuterDriver(driver,generation:plan.generation,geometryScale:geometry.scale)
                if let tween=self.sourceDragTweenDriver {node.installSourceDragTweenDriver(tween)}
                self.sourceMagnetConstructorNodes[holder.id]=node
                if self.sourceMagnetConstructorBatch==nil {
                    self.sourceMagnetConstructorEpoch &+= 1;let batchEpoch=self.sourceMagnetConstructorEpoch
                    let frame=scope.service.requestSourceAnimationFrame(ownerID:"magnet-open-constructors:\(plan.generation)",generation:plan.generation,
                        callback:{[weak self,scope] in
                            guard let self,self.sourceMagnetConstructorEpoch==batchEpoch,self.sourceMagnetFallbackScope === scope else{return};self.sourceMagnetConstructorBatch=nil
                            let captured=self.sourceMagnetConstructorNodes;self.sourceMagnetConstructorNodes=[:]
                            for (id,node) in captured {
                                guard self.sourceAnimationBindingAdmissionOpen,self.sourceMagnetFallbackScope === scope,scope.current,self.engine.state.generation==plan.generation else{return}
                                if self.nodesByID[id] === node,node.parent === self.canvasRoot,node.sourceGeneration==plan.generation {node.flushSourceInitialHolderVisuals()}
                            }
                        },onCancelled:{[weak self] in guard let self,self.sourceMagnetConstructorEpoch==batchEpoch else{return};self.sourceMagnetConstructorBatch=nil})
                    guard current(),self.sourceMagnetConstructorEpoch==batchEpoch,self.nodesByID[holder.id] === node,let frame else{frame?.cancel();return nil}
                    self.sourceMagnetConstructorBatch=frame
                }
                return current() ? node:nil
            },owns:{[weak self] node,opening in
                guard let self,current() else{return false}
                return self.nodesByID[node.tileID] === node && node.parent === self.canvasRoot && node.sourceContactNodeAlive && node.sourceGeneration==opening.generation && self.engine.state.tile(at:opening.cell)?.id==node.tileID
            },publish:{[weak self] result,previous in guard let self,current() else{return};self.consume(result,previous:previous)},
            acquireFrames:{[weak self] id,generation in guard let self,current() else{return nil};return self.beginSourceMotion(.spawnBounce,id:"magnet-fallback:"+id,generation:generation)},
            frameCurrent:{[weak self,scope] node,open in
                guard let self,self.sourceAnimationBindingAdmissionOpen,self.sourceMagnetFallbackScope === scope,
                    self.engine.state.generation==open.generation,self.nodesByID[node.tileID] === node,
                    node.parent === self.canvasRoot,node.sourceGeneration==open.generation,node.sourceContactNodeAlive else{return false}
                let accepted=scope.current
                return accepted && self.sourceAnimationBindingAdmissionOpen && self.sourceMagnetFallbackScope === scope && self.engine.state.generation==open.generation && self.nodesByID[node.tileID] === node && node.parent === self.canvasRoot && node.sourceGeneration==open.generation && node.sourceContactNodeAlive
            }))
        sourceMagnetFallbackCallers[plan.id]=caller
        let accepted=caller.start(transactionID:plan.id,generation:plan.generation,count:count,finished:{[weak self,weak caller,weak helper] outcome in
            guard let self,let caller,self.sourceMagnetFallbackCallers[plan.id] === caller else{return}
            self.sourceMagnetFallbackCallers.removeValue(forKey:plan.id)
            if outcome == .cancelled {helper?.sourceFallbackCancelled()}
            done(outcome == .completed)
        })
        if !accepted,sourceMagnetFallbackCallers[plan.id] === caller {sourceMagnetFallbackCallers.removeValue(forKey:plan.id);caller.retire()}
        return accepted
    }
    private func sourceMagnetFallbackOwns(_ node:NativeDiceNode)->Bool {sourceMagnetFallbackCallers.values.contains{$0.owns(node)}}
    private func retireSourceMagnetFallback(){
        let scope=sourceMagnetFallbackScope;sourceMagnetFallbackScope=nil
        if scope != nil {engine.sourceMagnetFallbacksEnabled=false}
        let callers=Array(sourceMagnetFallbackCallers.values);sourceMagnetFallbackCallers=[:]
        let batch=sourceMagnetConstructorBatch;sourceMagnetConstructorBatch=nil;sourceMagnetConstructorNodes=[:];sourceMagnetConstructorEpoch &+= 1
        batch?.cancel();callers.forEach{$0.retire()}
    }
    private var sourceMagnetNormalCallers:[String:NativeSourceMagnetNormalCaller]=[:]
    private var sourceMagnetNormalTokens:[String:UInt64]=[:],sourceMagnetNormalEpoch:UInt64=0
    private func sourceMagnetNormalOwns(_ node:NativeDiceNode)->Bool {sourceMagnetNormalCallers.values.contains{$0.owns(node)}}
    private func startSourceMagnetRespawn(_ plan:NativeSpecialMovePlan,receipt:UInt64,carrier:SKNode?)->Bool {
        guard sourceAnimationBindingAdmissionOpen,specialIsCurrent(plan),sourceMagnetBindings != nil,
              let scope=sourceContactScopeForMagnet,scope.current,sourceMagnetNormalCallers[plan.id]==nil,
              let adapter=sourceMagnetGuardAdapter,let installation=sourceMicrotaskInstallation,installation.isCurrent,
              textures.sourceRetainedRegularOpenTexturesReady,sourceInitialConstruction?.constructorBatchPending != true else{return false}
        sourceMagnetNormalEpoch &+= 1;let epoch=sourceMagnetNormalEpoch
        sourceMagnetNormalTokens[plan.id]=epoch
        let current:()->Bool = {[weak self,scope] in
            guard let self else{return false}
            return self.sourceAnimationBindingAdmissionOpen && self.sourceMagnetNormalTokens[plan.id]==epoch && scope.current && self.sourceContactScopeForMagnet === scope &&
                self.sourceMicrotaskInstallation === installation && installation.isCurrent && self.specialIsCurrent(plan)
        }
        let caller=NativeSourceMagnetNormalCaller(engine:engine,service:scope.service,hooks:.init(
            current:current,resourcesReady:{[weak self] in self?.textures.sourceRetainedRegularOpenTexturesReady==true},
            random:{scope.smokeSession.nextVisualRandom()},schedule:{ms,elapsed,cancelled in
                guard current() else{return nil};return adapter.schedule(id:plan.id+":normal",generation:plan.generation,ms:ms,elapsed:elapsed,cancelled:cancelled)
            },enqueue:{callback in guard current() else{return false};return installation.enqueue(callback)},
            construct:{[weak self] tile,rotation in
                guard let self,current(),let geometry=self.geometry,let driver=self.sourceOuterTimelineDriver else{return nil}
                // forceFreshPlaceholder replaces only this cell's empty locked
                // object; active, Wild or rebound C was rejected by Core caller.
                if let old=self.engine.state.tile(at:tile.cell),let oldNode=self.nodesByID[old.id] {
                    guard old.locked,old.value==0,!old.isWild else{return nil}
                    self.nodesByID.removeValue(forKey:old.id);self.sourceMagnetConstructorNodes.removeValue(forKey:old.id);oldNode.dispose()
                    guard current() else{return nil}
                }
                guard self.nodesByID[tile.id]==nil else{return nil}
                let node=NativeDiceNode(id:tile.id,value:0,kind:"regular",variant:nil,depth:1,locked:true,textures:self.textures,sourceSpecialIdle:scope.specialIdle)
                node.position=geometry.center(row:tile.cell.row,column:tile.cell.column)
                node.zPosition=CGFloat(tile.cell.row*self.engine.state.columns+tile.cell.column)
                self.canvasRoot.addChild(node);self.nodesByID[tile.id]=node;self.captureSourceTutorialObject(node)
                guard node.prepareSourceInitialHolder(rotation:rotation,generation:plan.generation,cell:tile.cell),current(),self.nodesByID[tile.id] === node else{node.dispose();return nil}
                node.installSourceOuterDriver(driver,generation:plan.generation,geometryScale:geometry.scale)
                if let tween=self.sourceDragTweenDriver {node.installSourceDragTweenDriver(tween)}
                self.sourceMagnetConstructorNodes[tile.id]=node
                if self.sourceMagnetConstructorBatch==nil {
                    self.sourceMagnetConstructorEpoch &+= 1;let epoch=self.sourceMagnetConstructorEpoch
                    let frame=scope.service.requestSourceAnimationFrame(ownerID:"magnet-open-constructors:\(plan.generation)",generation:plan.generation,
                        callback:{[weak self,scope] in
                            guard let self,self.sourceMagnetConstructorEpoch==epoch,self.sourceContactScopeForMagnet === scope else{return}
                            self.sourceMagnetConstructorBatch=nil;let captured=self.sourceMagnetConstructorNodes;self.sourceMagnetConstructorNodes=[:]
                            for(id,node) in captured {
                                guard self.sourceAnimationBindingAdmissionOpen,scope.current,self.engine.state.generation==plan.generation else{return}
                                if self.nodesByID[id] === node,node.parent === self.canvasRoot,node.sourceGeneration==plan.generation {node.flushSourceInitialHolderVisuals()}
                            }
                        },onCancelled:{[weak self] in guard let self,self.sourceMagnetConstructorEpoch==epoch else{return};self.sourceMagnetConstructorBatch=nil})
                    guard current(),self.sourceMagnetConstructorEpoch==epoch,self.nodesByID[tile.id] === node,let frame else{frame?.cancel();return nil}
                    self.sourceMagnetConstructorBatch=frame
                }
                return current() ? node:nil
            },owns:{[weak self] node,tile in
                guard let self,current() else{return false}
                return self.nodesByID[tile.id] === node && node.parent === self.canvasRoot && node.sourceContactNodeAlive && node.sourceGeneration==plan.generation
            },publish:{[weak self] result,previous in guard let self,current() else{return};self.consume(result,previous:previous)},
            verify:{[weak self] cell in
                guard let self,current(),let tile=self.engine.state.tile(at:cell),let node=self.nodesByID[tile.id],
                      node.parent === self.canvasRoot,node.sourceContactNodeAlive,node.sourceGeneration==plan.generation else{return false}
                let success = !node.sourceLocked && node.sourceValue>0
                if success {self.sourceMagnetSuccessfulSpawns[plan.id]?.insert(node.tileID);node.sourceEventMode="static"}
                return success && current()
            },acquireFrames:{[weak self] id,generation in guard let self,current() else{return nil};return self.beginSourceMotion(.spawnBounce,id:id,generation:generation)},
            finished:{[weak self,weak carrier] outcome in
                guard let self,self.sourceMagnetNormalTokens[plan.id]==epoch else{return}
                let owns=current()
                self.sourceMagnetNormalTokens.removeValue(forKey:plan.id)
                guard self.sourceMagnetNormalCallers.removeValue(forKey:plan.id) != nil,owns else{return}
                guard case .completed(let successes)=outcome,
                      successes==(self.engine.pendingSourceMagnetLazyRespawn?.slots.count ?? self.engine.pendingMagnetRespawn?.replacements.count) else{self.onPresentationFailure?("source_magnet_replacement_retry_not_bound");return}
                let previous:NativeBoardState,result:NativeMoveResult
                if self.sourceMagnetLazyScope != nil {
                    guard let committed=self.finishSourceMagnetLazyBoard(plan) else{self.onPresentationFailure?("source_magnet_lazy_survivor_not_bound");return}
                    result=committed.0;previous=committed.1
                } else {previous=self.engine.state;result=self.engine.commitSpecialBoard(transactionID:plan.id)}
                if result.accepted {self.sourceMagnetHelpers[plan.id]?.boardCommitted(spawnCount:successes,shouldRunPostCheck:true,
                    publish:{[weak self] in self?.sourceSpecialTransactions?.boardCommitted(id:plan.id,generation:plan.generation)})}
                self.specialPresentationID=nil;self.consume(result,previous:previous)
                guard self.sourceAnimationBindingAdmissionOpen,self.engine.state.generation==plan.generation else{return}
                self.navigationLocked=self.engine.state.terminal != nil || self.pendingTerminal != nil
                self.finishVisual(receipt);carrier?.removeFromParent()
            },frameCurrent:{[weak self,scope] node,_ in
                guard let self,self.sourceAnimationBindingAdmissionOpen,self.sourceContactScopeForMagnet === scope,
                    self.engine.state.generation==plan.generation,self.nodesByID[node.tileID] === node,
                    node.parent === self.canvasRoot,node.sourceGeneration==plan.generation,node.sourceContactNodeAlive else{return false}
                let accepted=scope.current
                return accepted && self.sourceAnimationBindingAdmissionOpen && self.sourceContactScopeForMagnet === scope && self.engine.state.generation==plan.generation && self.nodesByID[node.tileID] === node && node.parent === self.canvasRoot && node.sourceGeneration==plan.generation && node.sourceContactNodeAlive
            },removeEmptyHolder:{[weak self] opening in
                guard let self,current() else{return false}
                guard let oldID=opening.removedHolderID else{return true}
                // Exact old object ID from Core's force-fresh action; the new
                // zero holder is already canonical and must never be removed.
                if let old=self.nodesByID[oldID] {
                    guard old.sourceGeneration==plan.generation,old.sourceValue==0,old.sourceLocked,old.sourceContactNodeAlive else{return false}
                    self.nodesByID.removeValue(forKey:oldID);self.sourceMagnetConstructorNodes.removeValue(forKey:oldID);old.dispose();old.removeFromParent()
                }
                return current()
            }))
        sourceMagnetNormalCallers[plan.id]=caller
        let accepted=caller.start(transactionID:plan.id,generation:plan.generation)
        if !accepted,sourceMagnetNormalCallers[plan.id] === caller {sourceMagnetNormalCallers.removeValue(forKey:plan.id);sourceMagnetNormalTokens.removeValue(forKey:plan.id);caller.retire()}
        return accepted
    }
    private var sourceMagnetSuccessfulSpawns:[String:Set<String>]=[:]
    private var sourceMagnetPullCarriers:[String:SKNode]=[:]
    private var sourceMagnetPullFlagOwner:(id:String,generation:UInt64)?
    /// Concrete normal helper binding; no loose count callbacks at startup.
    /// The real Source observer uses STATE order plus same retained grid objects.
    @discardableResult func configureSourceMagnetPhysicalVerification(scope:NativeGameplaySourceContext.Scope)->Bool {
        guard sourceAnimationBindingAdmissionOpen,scope.current,sourceMagnetBindings==nil,
              sourceSpecialTransactions != nil,sourceMagnetFallbackScope === scope,
              sourceInitialStartupReady else{return false}
        let generation=engine.state.generation
        let current:()->Bool = {[weak self,scope] in
            guard let self else{return false}
            return self.sourceAnimationBindingAdmissionOpen && scope.current && self.engine.state.generation==generation
        }
        let bindings=NativeSourceMagnetSceneBindings(admitted:{[weak self] in
            guard let self,current() else{return false}
            return self.sourceMagnetPhysicalSnapshot(generation:generation) != nil
        },ownsLifecycle:{plan in current() && plan.generation==generation},simulate:{[weak self] in
            guard let self,current(),let tiles=self.sourceMagnetPhysicalSnapshot(generation:generation) else{return false}
            return NativeSourceMagnetPhysicalState.simulate(tiles)
        },observation:{[weak self] plan in
            guard let self,current(),plan.generation==generation,
                  let tiles=self.sourceMagnetPhysicalSnapshot(generation:generation) else{return nil}
            let count=self.engine.sourceMagnetPostCommit.flatMap{$0.transactionID==plan.id ? $0.spawnCount:nil}
            guard let count else{return nil}
            // successfulSpawns is counted at the actual captured open
            // completion callback, never from expected/planned replacement count.
            let read=NativeSourceMagnetPhysicalState.read(tiles,spawnCount:count,successfulSpawnCount:self.sourceMagnetSuccessfulSpawns[plan.id]?.count ?? 0,
                lastMerge:self.engine.sourceMeterLastMergeTileIDs.contains(plan.destination.id))
            let resolution:NativeSourceMagnetCoroutineOwner.Resolution
            switch read.reason {
            case "merge-or-stack-potential":resolution = .mergePotential(clearLastMerge:read.clearLastMerge)
            case "clean-merge6-only":resolution = .cleanSix
            case "stuck-unlocked-tiles":resolution = .stuckUnlocked
            case "stuck-active-tiles":resolution = .stuckActive
            default:resolution = .continueWithoutCheck(clearLastMerge:read.clearLastMerge)
            }
            // The native app-spawn wrapper has no literal _spawnTween field.
            // Selected locked-slot flags are cleared by their own assignment
            // callback. Defensive read may observe but cannot retire another
            // outstanding captured slot; native safe ownership differs from
            // Source's unscoped stale boolean repair.
            return .init(lockedActiveCount:read.lockedActiveCount,stillSpawningCount:read.stillSpawningCount,
                activeCount:read.activeCount,playableLockedCount:read.playableLockedCount,resolution:resolution)
        },fallback:{[weak self] plan,count,done in guard let self,current() else{return false};return self.sourceMagnetFallback(plan,count:count,done:done)},
        fxStatus:{[weak self] in
            guard let self,current() else{return nil}
            // Compiled Swift namespace is already loaded; this is the genuine
            // native core-Juice owner, not a count or an invented activity lease.
            return self.effects.children.compactMap{$0 as? NativeJuiceFinale}.contains{$0.hasActiveClock}
        },clearLastMerge:{[weak self] plan in
            guard let self,current(),plan.generation==generation else{return}
            self.engine.sourceMeterLastMergeTileIDs.remove(plan.destination.id) // exact old ID only; never survivor/new C.
        },updateGhostVisibility:{[weak self] in guard let self,current(),let geometry=self.geometry else{return};self.renderGhosts(state:self.engine.state,geometry:geometry)},
        centralCheck:{[weak self] _ in
            guard let self,current() else{return}
            guard self.sourceMagnetPhysicalMatchesCore(generation:generation) else{self.onPresentationFailure?("source_magnet_physical_core_divergence");return}
            self.evaluate()
        },
        cleanupPullAnimations:{[weak self] plan in
            guard let self,current() else{return}
            if let entry=self.sourceMagnetSourcePulls[plan.id] {entry.owner?.cleanup(preserveCommittedSound:true)}
            // Captured pull targets only; remove this owner's authored action
            // keys, never removeAllActions on intervening ordinary play/new C.
            if let carrier=self.sourceMagnetPullCarriers.removeValue(forKey:plan.id) {carrier.removeAllActions();carrier.removeFromParent()}
        },releasePullFlag:{[weak self] plan in
            guard let self,current(),plan.generation==generation else{return}
            guard self.sourceMagnetPullFlagOwner?.id==plan.id,self.sourceMagnetPullFlagOwner?.generation==generation else{return}
            self.sourceMagnetPullFlagOwner=nil
            var flags=self.engine.flags;flags.wildMagnetPullInProgress=false
            self.engine.setRuntimeFlags(flags)
        })
        return configureSourceMagnetVerification(scope:scope,bindings:bindings)
    }
    func captureSourceMagnetPhysicalTiles()->[NativeSourceMagnetPhysicalTile]? {
        sourceMagnetPhysicalSnapshot(generation:engine.state.generation)
    }
    func captureSourceSaveTileMarkers(id:String)->NativeSourceSaveTileMarkers? {
        guard sourceAnimationBindingAdmissionOpen,let model=engine.state.tiles.first(where:{$0.id==id}),
              let node=nodesByID[id],node.parent === canvasRoot,node.sourceContactNodeAlive,
              node.sourceGeneration==engine.state.generation else{return nil}
        guard var markers=node.captureSourceSaveTileMarkers(model:model,runtime:engine.noMovesTileRuntime[id]) else{return nil}
        // Genuine Source meter-created Wilds borrow the actual carrier writers,
        // not Core's conservative no-moves metadata. An unmapped Wild refuses.
        if node.isSpecial || node.sourceResidualWildPresence {
            guard let drop=sourceWildDropTileMarkers(node),nodesByID[id] === node,
                  engine.state.tiles.first(where:{$0.id==id})==model else{return nil}
            markers.wildSpawnDropping=drop.dropping
            markers.wildSpawnHandoffLock=drop.handoffLocked
        }
        return markers
    }
    /// Queue-only physical borrow from genuinely covered Source Nodes. The
    /// regular-six destination cleanup owner must supply its actual hasClaim;
    /// pendingRemoval, resolutionOwned and animation duration cannot replace it.
    /// Covered Source ordinary/direct main caller only. This does not admit
    /// unrelated special families or mount the global cleanup capability.
    func sourceMergeSixDestinationHasCleanupClaim(id:String)->Bool? {
        guard sourceAnimationBindingAdmissionOpen,let scope=sourceSixScope,scope.current,
              let node=nodesByID[id],node.sourceGeneration==engine.state.generation else{return nil}
        return scope.mergeSixDestinationCleanup.hasClaim(node)
    }
    func captureSourceMeterQueueTileMarkers(cleanupClaim:(String)->Bool?)->[NativeSourceMeterQueueTileMarkers]? {
        guard sourceAnimationBindingAdmissionOpen else{return nil}
        let captured=engine.state
        var result:[NativeSourceMeterQueueTileMarkers]=[]
        for model in captured.tiles {
            guard sourceAnimationBindingAdmissionOpen,engine.state==captured,
                  let node=nodesByID[model.id],node.parent === canvasRoot,
                  node.sourceGeneration==captured.generation,
                  let markers=captureSourceSaveTileMarkers(id:model.id),
                  let claim=cleanupClaim(model.id),sourceAnimationBindingAdmissionOpen,
                  engine.state==captured,nodesByID[model.id] === node,node.parent === canvasRoot else{return nil}
            result.append(.init(tileID:model.id,destroyed:markers.destroyed,
                cleanupClaim:claim,magnetAffected:model.magnetOwned,
                wildDropping:markers.wildSpawnDropping,wildHandoff:markers.wildSpawnHandoffLock,
                ccSpawnAnimating:markers.ccSpawnAnimating,spawnAnimating:markers.spawnAnimating,
                isSpawning:markers.isSpawning))
        }
        return sourceAnimationBindingAdmissionOpen && engine.state==captured ? result:nil
    }
    private func sourceMagnetPhysicalSnapshot(generation:UInt64)->[NativeSourceMagnetPhysicalTile]? {
        guard sourceAnimationBindingAdmissionOpen,engine.state.generation==generation else{return nil}
        let state=engine.state
        var result:[NativeSourceMagnetPhysicalTile]=[]
        for model in state.tiles {
            guard let node=nodesByID[model.id],node.parent === canvasRoot,node.sourceGeneration==generation,
                  node.sourceContactNodeAlive,
                  let observed=node.captureSourceMagnetPhysical(model:model,runtime:engine.noMovesTileRuntime[model.id],
                    lastMerge:engine.sourceMeterLastMergeTileIDs.contains(model.id)) else{return nil}
            result.append(observed)
        }
        guard sourceAnimationBindingAdmissionOpen,engine.state==state else{return nil}
        return result
    }
    private func sourceMagnetPhysicalMatchesCore(generation:UInt64)->Bool {
        guard let observed=sourceMagnetPhysicalSnapshot(generation:generation) else{return false}
        let models=engine.state.tiles
        return observed.count==models.count && zip(observed,models).allSatisfy{p,m in
            // Alpha storage is SpriteKit Float32, so compare the source semantic
            // boundaries used by classification; never replace physical alpha.
            p.id==m.id && p.value==m.value && p.depth==m.stackDepth && p.locked==m.locked && p.visible==m.visible &&
            (p.alpha>0.01)==(m.alpha>0.01) && (p.alpha>0.35)==(m.alpha>0.35)
        }
    }

    private var sourceMagnetBindings:NativeSourceMagnetSceneBindings?
    private var sourceMagnetGuardAdapter:NativeSourceMagnetGuardAdapter?
    private var sourceMagnetHelpers:[String:NativeSourceMagnetCoroutineOwner]=[:]
    @discardableResult func configureSourceMagnetVerification(scope:NativeGameplaySourceContext.Scope,bindings:NativeSourceMagnetSceneBindings)->Bool {
        guard sourceAnimationBindingAdmissionOpen,scope.current,sourceSpecialTransactions != nil,
              sourceMagnetBindings==nil,let installation=sourceMicrotaskInstallation,installation.isCurrent,
              let tasks=scope.sourceMicrotaskTasks,sourceAppTimeouts.sourceMicrotaskTasks === tasks,
              installation.tasks === tasks else{return false}
        let ready=bindings.admitted()
        guard ready,sourceAnimationBindingAdmissionOpen,scope.current,sourceMagnetBindings==nil,
              sourceMicrotaskInstallation === installation,installation.isCurrent else{return false}
        let adapter=NativeSourceMagnetGuardAdapter(scope:scope.registries,timeouts:sourceAppTimeouts,tasks:tasks,
            enqueue:{[weak self,installation] callback in guard let self,self.sourceMicrotaskInstallation === installation,installation.isCurrent else{return false};return installation.enqueue(callback)})
        guard adapter.mount(),sourceAnimationBindingAdmissionOpen,scope.current,sourceMagnetBindings==nil,
              sourceMicrotaskInstallation === installation,installation.isCurrent else{adapter.retire();return false}
        sourceMagnetBindings=bindings;sourceContactScopeForMagnet=scope;sourceMagnetGuardAdapter=adapter;sourceDisposalSealingEnabled=true
        return true
    }
    private func beginSourceMagnetHelper(_ plan:NativeSpecialMovePlan)->Bool {
        guard let bindings=sourceMagnetBindings else{return true} // Raw unchanged.
        guard sourceAnimationBindingAdmissionOpen,let adapter=sourceMagnetGuardAdapter,
              let scope=sourceContactScopeForMagnet,sourceMagnetHelpers[plan.id]==nil else{return false}
        let owns:()->Bool = {[weak self,bindings,scope] in
            guard let self,self.sourceAnimationBindingAdmissionOpen,self.sourceMagnetBindings === bindings,
                  scope.current,self.engine.state.generation==plan.generation else{return false}
            let owned=bindings.ownsLifecycle(plan)
            return owned && self.sourceAnimationBindingAdmissionOpen && self.sourceMagnetBindings === bindings && scope.current && self.engine.state.generation==plan.generation
        }
        let helper=NativeSourceMagnetCoroutineOwner(hooks:.init(ownsLifecycle:owns,revision:{scope.contactMutations.revision},
            beginGuard:{adapter.beginGuard()},schedule:{ms,elapsed,cancel in adapter.schedule(id:plan.id,generation:plan.generation,ms:ms,elapsed:elapsed,cancelled:cancel)},enqueue:{adapter.reaction($0)},
            simulate:bindings.simulate,observe:{bindings.observation(plan)},fallback:{count,done in bindings.fallback(plan,count,done)},readFXStatus:bindings.fxStatus,
            clearCapturedLastMerge:{bindings.clearLastMerge(plan)},updateGhostVisibility:bindings.updateGhostVisibility,centralCheck:bindings.centralCheck,
            helperFinally:{[weak self,bindings] _,_ in guard let self,self.sourceMagnetBindings === bindings else{return};self.sourceMagnetHelpers.removeValue(forKey:plan.id);self.sourceMagnetSuccessfulSpawns.removeValue(forKey:plan.id);_ = self.engine.retireSourceMagnetPostCommit(transactionID:plan.id,generation:plan.generation)},
            handlerComplete:{[weak self,bindings] owned,_ in
                guard let self,owned,owns(),self.sourceMagnetBindings === bindings else{return}
                if let pull=self.sourceMagnetSourcePulls[plan.id] {pull.owner?.cleanup(preserveCommittedSound:true)}
                guard owns() else{return}
                bindings.cleanupPullAnimations(plan);guard owns() else{return}
                bindings.releasePullFlag(plan);guard owns() else{return}
                self.sourceMagnetHelperFinally(id:plan.id,generation:plan.generation,ownsLifecycle:true)
            }))
        sourceMagnetSuccessfulSpawns[plan.id]=[]
        sourceMagnetHelpers[plan.id]=helper
        guard helper.begin(),owns(),sourceMagnetHelpers[plan.id] === helper else{
            if sourceMagnetHelpers[plan.id] === helper {sourceMagnetHelpers.removeValue(forKey:plan.id)}
            helper.retire();return false
        }
        return true
    }
    private var sourceContactScopeForMagnet:NativeGameplaySourceContext.Scope?
    private func retireSourceMagnetVerification(){
        retireSourceMagnetPullBindings()
        retireSourceMagnetLazyRespawn()
        let capturedPostCommit=engine.sourceMagnetPostCommit
        retireSourceMagnetFallback()
        if let capturedPostCommit {_ = engine.retireSourceMagnetPostCommit(transactionID:capturedPostCommit.transactionID,generation:capturedPostCommit.generation)}
        sourceMagnetBindings=nil;sourceContactScopeForMagnet=nil
        let normal=Array(sourceMagnetNormalCallers.values);sourceMagnetNormalCallers=[:];sourceMagnetNormalTokens=[:]
        normal.forEach{$0.retire()}
        sourceMagnetSuccessfulSpawns=[:];sourceMagnetPullFlagOwner=nil
        let carriers=Array(sourceMagnetPullCarriers.values);sourceMagnetPullCarriers=[:]
        carriers.forEach{$0.removeAllActions();$0.removeFromParent()}
        let adapter=sourceMagnetGuardAdapter;sourceMagnetGuardAdapter=nil
        let captured=Array(sourceMagnetHelpers.values);sourceMagnetHelpers=[:]
        captured.forEach{$0.retire()};adapter?.retire()
    }
    @MainActor private final class SourceMagnetSurvivorEntry {
        let node:NativeDiceNode,plan:NativeSpecialMovePlan
        var retired=false,owner:NativeSourceMagnetSurvivorOwner?
        var reserved:[String:NativeDiceNode]=[:]
        init(node:NativeDiceNode,plan:NativeSpecialMovePlan){self.node=node;self.plan=plan}
    }
    private var sourceMagnetLazyScope:NativeGameplaySourceContext.Scope?
    private var sourceMagnetSurvivorEntries:[String:SourceMagnetSurvivorEntry]=[:]
    /// Bounded normal all-target continuation; other special families remain
    /// rejected. Core/constructor/raw-face/tail borrow ONE actual APP Math.
    @discardableResult func configureSourceMagnetLazyRespawn(scope:NativeGameplaySourceContext.Scope)->Bool {
        guard sourceAnimationBindingAdmissionOpen,sourceMagnetLazyScope==nil,sourceMagnetMainScope === scope,
              sourceContactScopeForMagnet === scope,scope.current,engine.sourceMathRandom === scope.mathRandom,
              sourceMagnetBindings != nil,sourceSpecialTransactions != nil,sourceOuterTimelineDriver === scope.timeline,
              sourceStackFrameService === scope.service,textures.sourceRetainedRegularOpenTexturesReady,
              sourceInitialConstruction?.constructorBatchPending != true else{return false}
        guard sourceAnimationBindingAdmissionOpen,scope.current,sourceMagnetLazyScope==nil,sourceMagnetMainScope === scope else{return false}
        sourceMagnetLazyScope=scope;engine.sourceMagnetLazyRespawnEnabled=true;return true
    }
    var sourceMagnetSurvivorPendingInputIDs:Set<String> {
        Set(sourceMagnetSurvivorEntries.values.filter{sourceMagnetSurvivorCurrent($0) && $0.owner?.inputBound != true}.map{$0.node.tileID})
    }
    private func sourceMagnetSurvivorCurrent(_ entry:SourceMagnetSurvivorEntry)->Bool {
        guard sourceAnimationBindingAdmissionOpen,!entry.retired,let scope=sourceMagnetLazyScope else{return false}
        func matches()->Bool {
            !entry.retired && sourceAnimationBindingAdmissionOpen && sourceMagnetSurvivorEntries[entry.plan.id] === entry &&
            sourceMagnetLazyScope === scope && engine.state.generation==entry.plan.generation && nodesByID[entry.node.tileID] === entry.node &&
            entry.node.parent === canvasRoot && entry.node.sourceContactNodeAlive && entry.node.sourceGeneration==entry.plan.generation
        }
        guard matches() else{return false};let accepted=scope.current;return accepted && matches()
    }
    private func retireSourceMagnetSurvivor(_ entry:SourceMagnetSurvivorEntry){
        guard !entry.retired else{return};entry.retired=true
        if sourceMagnetSurvivorEntries[entry.plan.id] === entry {sourceMagnetSurvivorEntries.removeValue(forKey:entry.plan.id)}
        let owner=entry.owner;entry.owner=nil;owner?.retire()
    }
    private func retireSourceMagnetLazyRespawn(){
        let entries=Array(sourceMagnetSurvivorEntries.values);sourceMagnetSurvivorEntries=[:]
        sourceMagnetLazyScope=nil;engine.sourceMagnetLazyRespawnEnabled=false
        entries.forEach{retireSourceMagnetSurvivor($0)}
    }
    private func sourceMagnetSurvivorOwns(_ node:NativeDiceNode)->Bool {
        sourceMagnetSurvivorEntries.values.contains{entry in sourceMagnetSurvivorCurrent(entry) && (entry.node === node || entry.reserved[node.tileID] === node)}
    }
    private func sourceMagnetSurvivorOwnsSpawn(_ event:NativeGameplayEvent)->Bool {
        event.kind == .spawned && sourceMagnetSurvivorEntries.values.contains{entry in
            sourceMagnetSurvivorCurrent(entry) && event.tileIDs.contains{$0==entry.node.tileID || entry.reserved[$0] != nil}
        }
    }
    private func constructSourceMagnetReserveFill(_ fill:NativeSourceMagnetReserveFill,entry:SourceMagnetSurvivorEntry,scope:NativeGameplaySourceContext.Scope)->Bool {
        guard sourceMagnetSurvivorCurrent(entry),let geometry,let driver=sourceOuterTimelineDriver else{return false}
        for(index,tile) in fill.holders.enumerated() {
            guard sourceMagnetSurvivorCurrent(entry),engine.state.tile(at:tile.cell)==nil,nodesByID[tile.id]==nil else{return false}
            let roll=scope.mathRandom.next()
            guard sourceMagnetSurvivorCurrent(entry),roll.isFinite,roll>=0,roll<1 else{return false}
            let node=NativeDiceNode(id:tile.id,value:0,kind:"regular",variant:nil,depth:1,locked:true,textures:textures,sourceSpecialIdle:scope.specialIdle)
            node.position=geometry.center(row:tile.cell.row,column:tile.cell.column);node.zPosition=CGFloat(tile.cell.row*engine.state.columns+tile.cell.column)
            canvasRoot.addChild(node);nodesByID[tile.id]=node;captureSourceTutorialObject(node);entry.reserved[tile.id]=node
            guard node.prepareSourceMagnetReservedHolder(rotation:roll*0.12-0.06,generation:entry.plan.generation,cell:tile.cell),sourceMagnetSurvivorCurrent(entry),nodesByID[tile.id] === node else{
                if nodesByID[tile.id] === node{nodesByID.removeValue(forKey:tile.id);node.dispose();node.removeFromParent()};return false
            }
            node.installSourceOuterDriver(driver,generation:entry.plan.generation,geometryScale:geometry.scale)
            if let tween=sourceDragTweenDriver {node.installSourceDragTweenDriver(tween)}
            sourceMagnetConstructorNodes[tile.id]=node
            if sourceMagnetConstructorBatch==nil {
                sourceMagnetConstructorEpoch &+= 1;let epoch=sourceMagnetConstructorEpoch
                let frame=scope.service.requestSourceAnimationFrame(ownerID:"magnet-reserves:\(entry.plan.generation)",generation:entry.plan.generation,
                    callback:{[weak self,scope] in
                        guard let self,self.sourceMagnetConstructorEpoch==epoch,self.sourceMagnetLazyScope === scope else{return}
                        self.sourceMagnetConstructorBatch=nil;let captured=self.sourceMagnetConstructorNodes;self.sourceMagnetConstructorNodes=[:]
                        for(id,node) in captured {
                            guard self.sourceAnimationBindingAdmissionOpen,scope.current,self.engine.state.generation==entry.plan.generation else{return}
                            if self.nodesByID[id] === node,node.parent === self.canvasRoot,node.sourceGeneration==entry.plan.generation{node.flushSourceInitialHolderVisuals()}
                        }
                    },onCancelled:{[weak self] in guard let self,self.sourceMagnetConstructorEpoch==epoch else{return};self.sourceMagnetConstructorBatch=nil})
                guard sourceMagnetSurvivorCurrent(entry),sourceMagnetConstructorEpoch==epoch,let frame else{frame?.cancel();return false}
                sourceMagnetConstructorBatch=frame
            }
            let before=engine.state,result=engine.commitSourceMagnetLazyReserve(transactionID:entry.plan.id,generation:entry.plan.generation,index:index,sourceCurrent:{[weak self,weak entry] in
                guard let self,let entry else{return false};return self.sourceMagnetSurvivorCurrent(entry)
            })
            guard result.accepted,sourceMagnetSurvivorCurrent(entry) else{return false}
            consume(result,previous:before);guard sourceMagnetSurvivorCurrent(entry) else{return false}
        }
        return sourceMagnetSurvivorCurrent(entry)
    }
    /// Called by real replacement Promise-all after actual bounce + wall50
    /// verification. Reserve constructors precede conversion/value/tail.
    private func finishSourceMagnetLazyBoard(_ plan:NativeSpecialMovePlan)->(NativeMoveResult,NativeBoardState)? {
        guard let scope=sourceMagnetLazyScope,sourceMagnetMainScope === scope,scope.current,
              engine.sourceSpecialAbsorbMainEntered,let main=sourceMagnetMainEntries[plan.id],main.capture?.phase == .entered,
              sourceMagnetMainNodeCurrent(main.destination,generation:plan.generation),sourceMagnetSurvivorEntries[plan.id]==nil,
              let geometry,let driver=sourceOuterTimelineDriver else{return nil}
        let entry=SourceMagnetSurvivorEntry(node:main.destination,plan:plan);sourceMagnetSurvivorEntries[plan.id]=entry
        let current:()->Bool = {[weak self,weak entry] in guard let self,let entry else{return false};return self.sourceMagnetSurvivorCurrent(entry)}
        guard current(),let fill=engine.prepareSourceMagnetLazyReserveFill(transactionID:plan.id,generation:plan.generation,sourceCurrent:current),
              constructSourceMagnetReserveFill(fill,entry:entry,scope:scope),current() else{
            retireSourceMagnetSurvivor(entry);return nil
        }
        let owner=NativeSourceMagnetSurvivorOwner(node:entry.node,transactionID:plan.id,generation:plan.generation,service:scope.service,driver:driver,hooks:.init(
            current:current,frameCurrent:{[weak self,weak node=entry.node,scope] in
                guard let self,let node,self.sourceAnimationBindingAdmissionOpen,self.sourceMagnetLazyScope === scope else{return false}
                let accepted=scope.current
                return accepted && self.sourceAnimationBindingAdmissionOpen && self.sourceMagnetLazyScope === scope && self.sourceMagnetMainNodeCurrent(node,generation:plan.generation)
            },random:scope.mathRandom.next,acquireFrames:{[weak self] in guard let self,current() else{return nil};return self.beginSourceMotion(.spawnBounce,id:plan.id+":survivor",generation:plan.generation)},
            beforeSetValue:{[weak self] in
                guard let self,current() else{return false};let before=self.engine.state
                let result=self.engine.commitSourceMagnetLazySurvivorValue(transactionID:plan.id,generation:plan.generation,sourceCurrent:current)
                guard result.accepted,current() else{return false};self.consume(result,previous:before);return current()
            },resolutionReleased:{[weak self,weak entry] in
                guard let self,let entry,current() else{return}
                if !self.engine.releaseSourceMagnetLazySurvivorResolution(transactionID:plan.id,generation:plan.generation,sourceCurrent:current){self.retireSourceMagnetSurvivor(entry)}
            },inputBound:{[weak self,weak entry] in if current(){entry?.node.sourceEventMode="static";if let self,let entry{self.traceSourceMagnetContact("survivor_input_bound",id:plan.destination.id)}}},finished:{[weak self,weak entry] outcome in
                guard let self,let entry else{return};let valid=current();self.retireSourceMagnetSurvivor(entry)
                if valid,outcome != .completed{self.onPresentationFailure?("source_magnet_survivor_tail_interrupted")}
            }))
        // PWA keeps the inner swell during replacement spawning. Retire it
        // only at the actual retained-destination conversion boundary.
        sourceMagnetImpacts.removeValue(forKey:plan.id)?.dispose()
        entry.owner=owner
        guard owner.start(position:geometry.center(row:plan.destination.cell.row,column:plan.destination.cell.column),depthZ:CGFloat(plan.destination.cell.row*engine.state.columns+plan.destination.cell.column),selectSurvivor:{[weak self] in
            guard let self,current() else{return nil}
            return self.engine.prepareSourceMagnetLazySurvivor(transactionID:plan.id,generation:plan.generation,sourceCurrent:current)?.survivor
        }),current(),entry.owner === owner else{
            retireSourceMagnetSurvivor(entry);return nil
        }
        if let tween=sourceDragTweenDriver {entry.node.installSourceDragTweenDriver(tween)}
        // Source's final fill rechecks the SAME reserved cells; already-created
        // holders are not recreated. Empty-list full-grid is handled above.
        let before=engine.state,result=engine.commitSpecialBoard(transactionID:plan.id)
        traceSourceMagnetContact("survivor_board_commit",id:plan.destination.id,result:result)
        guard result.accepted,current() else{retireSourceMagnetSurvivor(entry);return nil}
        return(result,before)
    }

    @MainActor private final class SourceMagnetPullEntry {
        let plan:NativeSpecialMovePlan,token=UUID(),scope:NativeGameplaySourceContext.Scope,geometry:NativeBoardGeometry
        let nodes:[String:NativeDiceNode],original:[String:NativeSourceMagnetPullMotion.Pose]
        let hudOrigin:CGPoint?
        var owner:NativeSourceMagnetPullOwner?,retired=false
        var capturedForceStop:(()->Void)?
        init(plan:NativeSpecialMovePlan,scope:NativeGameplaySourceContext.Scope,geometry:NativeBoardGeometry,nodes:[String:NativeDiceNode],original:[String:NativeSourceMagnetPullMotion.Pose],hudOrigin:CGPoint?){
            self.plan=plan;self.scope=scope;self.geometry=geometry;self.nodes=nodes;self.original=original;self.hudOrigin=hudOrigin
        }
    }
    private var sourceMagnetPullScope:NativeGameplaySourceContext.Scope?
    @discardableResult private func playSourceMagnetMultiplier(ownerID:String,destination:NativeDiceNode,multiplier:Int,
        generation:UInt64,service:NativeSourceAnimationClockService,current:@escaping()->Bool)->Bool {
        guard sourceAnimationBindingAdmissionOpen,engine.state.generation==generation,current(),let geometry,
              let badge=try? NativeWildSixMultiplierPresentation(origin:destination.position,tileSize:geometry.tileSize,
                multiplier:multiplier,service:service,current:{[weak self] in
                    guard let self else{return false}
                    return self.sourceAnimationBindingAdmissionOpen && self.engine.state.generation==generation && current()
                }) else{return false}
        sourceMagnetMultiplierPresentations[ownerID]?.dispose()
        sourceMagnetMultiplierPresentations[ownerID]=badge
        badge.onFinished={[weak self,weak badge] in
            guard let self,let badge,self.sourceMagnetMultiplierPresentations[ownerID] === badge else{return}
            self.sourceMagnetMultiplierPresentations.removeValue(forKey:ownerID)
        }
        guard badge.mount(in:effects) else{badge.dispose();return false}
        return true
    }
    private var sourceMagnetMultiplierPresentations:[String:NativeWildSixMultiplierPresentation]=[:]
    private var sourceMagnetPullForceStopFactory:((String,UInt64)->NativeMagnetPullCleanup?)?
    private var sourceMagnetPullSelectionOwner:NativeSourceMagnetPullSelectionOwner?
    private var sourceMagnetSourcePulls:[String:SourceMagnetPullEntry]=[:]
    private var sourceMagnetBodyReleases:[String:(UInt64,()->Void)]=[:]
    var sourceMagnetActualPullOwnerCount:Int {sourceMagnetSourcePulls.count}
    /// Core Magnet→regular-dst only. Raw and other variants retain existing
    /// route. This borrows the actual APP Math, timeout and per-RAF FIFO owners.
    @discardableResult func configureSourceMagnetPull(scope:NativeGameplaySourceContext.Scope,captureForceStop:@escaping(String,UInt64)->(()->Void))->Bool {
        configureSourceMagnetPullCleanup(scope:scope,captureCleanup:{id,generation in .voice(captureForceStop(id,generation))})
    }
    @discardableResult func configureSourceMagnetPullCleanup(scope:NativeGameplaySourceContext.Scope,captureCleanup:@escaping(String,UInt64)->NativeMagnetPullCleanup?)->Bool {
        guard sourceAnimationBindingAdmissionOpen,scope.current,sourceMagnetPullScope==nil,
              sourceMagnetMainScope === scope,sourceMagnetLazyScope === scope,
              engine.sourceMathRandom === scope.mathRandom,engine.pendingSpecial==nil,
              engine.sourceMagnetPullSelection==nil,sourceMagnetSourcePulls.isEmpty,
              scope.service.sourceFrameTransportAdmissionOpen,
              let installation=sourceMicrotaskInstallation,installation.isCurrent,
              let tasks=scope.sourceMicrotaskTasks,installation.tasks === tasks,
              scope.service.sourceMicrotaskTasks === tasks,sourceAppTimeouts.sourceMicrotaskTasks === tasks else{return false}
        let selector=NativeSourceMagnetPullSelectionOwner{[weak self,scope] state,src,dst,candidates in
            guard let self,self.sourceAnimationBindingAdmissionOpen,self.sourceMagnetPullScope === scope,
                  scope.current,self.engine.state==state,NativeSpecialDiceRegistry.finale(source:src,destination:dst,gameplay:true) == .magnet,
                  let destination=self.nodesByID[dst.id],self.sourceMagnetMainNodeCurrent(destination,generation:state.generation) else{return nil}
            // CollectBoardGameplayTiles visits STATE order first and deduplicates
            // grid references. Covered physical/Core roster guarantees no extra
            // dangling grid die here; no sorted model-cell distance replacement.
            var seen=Set<String>(),records:[(String,Double,Int)]=[]
            for (index,tile) in candidates.enumerated() {
                guard seen.insert(tile.id).inserted,let node=self.nodesByID[tile.id],
                      self.sourceMagnetMainNodeCurrent(node,generation:state.generation),node.sourcePhysicalMarkersCovered,
                      node.position.x.isFinite,node.position.y.isFinite,node.sourceValue==tile.value,
                      node.sourceLocked==tile.locked,!node.isHidden,Double(node.alpha)>0.01 else{return nil}
                records.append((tile.id,hypot(Double(node.position.x-destination.position.x),Double(node.position.y-destination.position.y)),index))
            }
            let order=records.sorted{a,b in a.1==b.1 ? a.2<b.2:a.1<b.1}.map{$0.0}
            guard self.sourceAnimationBindingAdmissionOpen,self.sourceMagnetPullScope === scope,scope.current,self.engine.state==state else{return nil}
            return order
        }
        sourceMagnetPullScope=scope;sourceMagnetPullForceStopFactory=captureCleanup;sourceMagnetPullSelectionOwner=selector;engine.sourceMagnetPullSelection=selector
        return true
    }
    /// Genuine installed pull writer, including its settled release. An
    /// uninstalled/retired Source pull pipeline is unknown, never false.
    func captureSourceMagnetPullInProgress(scope:NativeGameplaySourceContext.Scope)->Bool? {
        guard sourceAnimationBindingAdmissionOpen,sourceMagnetPullScope === scope,
              sourceMagnetMainScope === scope,sourceMagnetPullSelectionOwner != nil,scope.current else{return nil}
        let generation=engine.state.generation,owner=sourceMagnetPullFlagOwner
        if let owner,owner.generation != generation {return nil}
        let active=owner != nil
        guard sourceAnimationBindingAdmissionOpen,scope.current,sourceMagnetPullScope === scope,
              sourceMagnetMainScope === scope,sourceMagnetPullSelectionOwner != nil,
              engine.state.generation==generation,sourceMagnetPullFlagOwner?.id==owner?.id,
              sourceMagnetPullFlagOwner?.generation==owner?.generation else{return nil}
        return active
    }
    private func sourceMagnetPullCurrent(_ entry:SourceMagnetPullEntry)->Bool {
        guard sourceAnimationBindingAdmissionOpen,!entry.retired,sourceMagnetSourcePulls[entry.plan.id] === entry,
              sourceMagnetPullScope === entry.scope,engine.state.generation==entry.plan.generation else{return false}
        let accepted=entry.scope.current
        return accepted && sourceAnimationBindingAdmissionOpen && !entry.retired && sourceMagnetSourcePulls[entry.plan.id] === entry && sourceMagnetPullScope === entry.scope && engine.state.generation==entry.plan.generation
    }
    private func sourceMagnetPullNodeCurrent(_ node:NativeDiceNode,entry:SourceMagnetPullEntry)->Bool {
        sourceMagnetPullCurrent(entry) && entry.nodes[node.tileID] === node && nodesByID[node.tileID] === node && node.parent === canvasRoot && node.sourceContactNodeAlive && node.sourceGeneration==entry.plan.generation
    }
    private func sourceMagnetPullPoint(_ point:CGPoint,geometry:NativeBoardGeometry)->NativeSourceMagnetPullMotion.Point {
        let top=geometry.origin.y+(CGFloat(geometry.rows)*NativeBoardGeometry.tile+CGFloat(geometry.rows-1)*NativeBoardGeometry.gap)*geometry.scale
        return .init(x:Double((point.x-geometry.origin.x)/geometry.scale),y:Double((top-point.y)/geometry.scale))
    }
    private func sourceMagnetPullPose(_ node:NativeDiceNode,geometry:NativeBoardGeometry)->NativeSourceMagnetPullMotion.Pose {
        .init(point:sourceMagnetPullPoint(node.position,geometry:geometry),rotation:Double(node.dragInnerTilt),scaleX:Double(node.xScale/geometry.scale),scaleY:Double(node.yScale/geometry.scale),converged:false)
    }
    private func sourceMagnetPaintPull(_ node:NativeDiceNode,pose:NativeSourceMagnetPullMotion.Pose,geometry:NativeBoardGeometry){
        let top=geometry.origin.y+(CGFloat(geometry.rows)*NativeBoardGeometry.tile+CGFloat(geometry.rows-1)*NativeBoardGeometry.gap)*geometry.scale
        node.position = .init(x:geometry.origin.x+CGFloat(pose.point.x)*geometry.scale,y:top-CGFloat(pose.point.y)*geometry.scale)
        node.xScale=CGFloat(pose.scaleX)*geometry.scale;node.yScale=CGFloat(pose.scaleY)*geometry.scale;node.dragInnerTilt=CGFloat(pose.rotation)
    }
    private func hideSourceMagnetConsumedSix(_ plan:NativeSpecialMovePlan)->Bool {
        guard sourceAnimationBindingAdmissionOpen,engine.state.generation==plan.generation,
              engine.pendingSourceMagnetLazyRespawn?.transactionID==plan.id,
              let model=engine.state.tiles.first(where:{$0.id==plan.destination.id}),model.value==6,!model.visible,model.alpha==0,
              let entry=sourceMagnetMainEntries[plan.id],!entry.retired,
              sourceMagnetMainNodeCurrent(entry.destination,generation:plan.generation) else{return false}
        sourceMagnetImpacts.removeValue(forKey:plan.id)?.dispose()
        // A retained hidden carrier, never a removed/free spawn cell. Its
        // ordinary conversion explicitly restores visibility at real commit.
        entry.destination.isHidden=true;entry.destination.alpha=0;entry.destination.sourceEventMode="none"
        return true
    }
    private func startSourceMagnetPull(_ plan:NativeSpecialMovePlan,receipt:UInt64)->Bool {
        guard sourceAnimationBindingAdmissionOpen,let scope=sourceMagnetPullScope,scope.current,sourceMagnetMainScope === scope,
              plan.archetype == .magnet,NativeSpecialDiceRegistry.finale(source:plan.source,destination:plan.destination,gameplay:true) == .magnet,
              let geometry,let destination=nodesByID[plan.destination.id],!plan.targets.isEmpty,
              sourceMagnetSourcePulls[plan.id]==nil,let installation=sourceMicrotaskInstallation,installation.isCurrent,
              let adapter=sourceMagnetGuardAdapter,let captureForceStop=sourceMagnetPullForceStopFactory else{return false}
        let targets=plan.targets.compactMap{nodesByID[$0.id]}
        guard targets.count==plan.targets.count,targets.allSatisfy({sourceMagnetMainNodeCurrent($0,generation:plan.generation) && $0.sourcePhysicalMarkersCovered}) else{return false}
        let nodes=Dictionary(uniqueKeysWithValues:targets.map{($0.tileID,$0)})
        let poses=Dictionary(uniqueKeysWithValues:targets.map{($0.tileID,sourceMagnetPullPose($0,geometry:geometry))})
        // v9 captures the pulled plain Star before motion, or the actual
        // destination for ordinary pulled dice. Keep that screen origin after
        // main80/removal; a later model-cell projection loses the real caller.
        let originNode=plan.targets.first{$0.gameplayArchetype == .star && $0.variant==nil}.flatMap{nodes[$0.id]} ?? nodesByID[plan.destination.id]
        let hudOrigin=originNode.flatMap{sourceSpecialHUDScreenOrigin(node:$0,generation:plan.generation)}
        guard !sourceHUDStarJobsPresentationEnabled || hudOrigin != nil else{return false}
        let entry=SourceMagnetPullEntry(plan:plan,scope:scope,geometry:geometry,nodes:nodes,original:poses,hudOrigin:hudOrigin)
        sourceMagnetSourcePulls[plan.id]=entry;sourceMagnetPullFlagOwner=(plan.id,plan.generation)
        let current:()->Bool = {[weak self,weak entry] in guard let self,let entry else{return false};return self.sourceMagnetPullCurrent(entry)}
        let owner=NativeSourceMagnetPullOwner(service:scope.service,hooks:.init(current:current,random:scope.mathRandom.next,
            protect:{[weak self,weak entry] target in
                guard let self,let entry,current(),let node=entry.nodes[target.id],self.sourceMagnetPullNodeCurrent(node,entry:entry) else{return false}
                return node.protectSourceMagnetPull(token:entry.token,generation:plan.generation,current:current) && current()
            },prepareRoot:{[weak entry] target in
                guard let entry,current(),let node=entry.nodes[target.id] else{return false}
                return node.prepareSourceMagnetPullScale(token:entry.token,generation:plan.generation) && current()
            },read:{[weak self,weak entry] id in
                guard let self,let entry,current(),let node=entry.nodes[id],self.sourceMagnetPullNodeCurrent(node,entry:entry) else{return nil}
                return self.sourceMagnetPullPose(node,geometry:geometry)
            },paint:{[weak self,weak entry] id,pose in
                guard let self,let entry,current(),let node=entry.nodes[id] else{return false}
                if !self.sourceMagnetPullNodeCurrent(node,entry:entry) {
                    // Literal Source roots retain destroyed JS targets after
                    // app-merge removes them. Native captured tombstone roots
                    // keep their original linked duration without repainting an
                    // old/new die. They create no extra clock/activity/RNG.
                    return entry.owner?.mergeStarted==true
                }
                self.sourceMagnetPaintPull(node,pose:pose,geometry:geometry);return current()
            },arrived:{[weak self,weak entry] id in
                guard let self,let entry,current(),let node=entry.nodes[id] else{return false}
                return self.sourceMagnetPullNodeCurrent(node,entry:entry)
            },convergence:{[weak self,weak entry] in
                guard let self,let entry,current(),self.engine.sourceSpecialAbsorbMainEntered else{return false}
                self.onSpecialMoment?(plan.variant ?? "magnet","pull",plan.targets.count)
                guard current() else{return false}
                // Capture the just-played actual Force voice, never a later
                // global voice lookup. A reentrant factory cannot republish A.
                guard let cleanup=captureForceStop(plan.id,plan.generation) else{return false}
                switch cleanup {
                case .voice(let stop):
                    guard current() else{stop();return false}
                    entry.capturedForceStop=stop
                case .silence:
                    guard current() else{return false}
                }
                // Actual original import/await reaction follows this global
                // root dispatch, not one guessed Pixi-render-frame callback.
                return installation.enqueue{[weak self,weak entry] in
                    guard let self,let entry,current(),self.specialIsCurrent(plan),self.engine.sourceSpecialAbsorbMainEntered else{return}
                    self.specialPresentationIDs.removeAll()
                    guard self.beginSourceMagnetHelper(plan) else{self.onPresentationFailure?("source_magnet_helper_producer_missing");self.retireSourceMagnetPull(entry);return}
                    let before=self.engine.state
                    let result=self.engine.prepareSourceMagnetLazyRespawn(transactionID:plan.id,generation:plan.generation,sourceCurrent:current)
                    guard result.accepted,self.hideSourceMagnetConsumedSix(plan),let destination=self.nodesByID[plan.destination.id],
                        self.playSourceWildMergeSixParticles(ownerID:plan.id,archetype:.magnet,variant:plan.variant,
                            destination:destination,generation:plan.generation,pull:true),current() else {
                        self.onSourcePresentationFailure?("source_magnet_pull_shards_rejected",plan.generation);return
                    }
                    guard self.playSourceWildScreenShake(.magnetPull,ownerID:plan.id,variant:plan.variant,generation:plan.generation),current() else {
                        self.onSourcePresentationFailure?("source_magnet_pull_screen_shake_rejected",plan.generation);return
                    }
                    guard self.consumeSourceSpecialHUDCall(result,previous:before,origin:entry.hudOrigin) else{self.sourceMagnetHelpers[plan.id]?.retire();self.retireSourceMagnetPull(entry);return}
                    guard result.accepted,current() else{self.sourceMagnetHelpers[plan.id]?.retire();self.retireSourceMagnetPull(entry);return}
                    self.startMagnetRespawn(plan,receipt:receipt,owner:nil)
                }
            },restore:{[weak self,weak entry] target in
                guard let self,let entry,let node=entry.nodes[target.id],self.engine.state.generation==plan.generation,
                      self.nodesByID[target.id] === node,node.parent === self.canvasRoot,node.sourceContactNodeAlive,node.sourceGeneration==plan.generation else{return}
                guard node.releaseSourceMagnetPull(token:entry.token,generation:plan.generation,restore:true) else{return}
                self.sourceMagnetPaintPull(node,pose:target.pose,geometry:geometry)
            },acquireFrames:{[weak self] in guard let self,current() else{return nil};return self.beginSourceMotion(.magnetPull,id:plan.id,generation:plan.generation)},
            stopForceSound:{[weak entry] in
                guard let entry else{return};let stop=entry.capturedForceStop;entry.capturedForceStop=nil;stop?()
            },
            releasePullGuard:{[weak self] in
                guard let self,self.engine.state.generation==plan.generation,self.sourceMagnetPullFlagOwner?.id==plan.id,self.sourceMagnetPullFlagOwner?.generation==plan.generation else{return}
                self.sourceMagnetPullFlagOwner=nil
            },pullGuardActive:{[weak self] in current() && self?.sourceMagnetPullFlagOwner?.id==plan.id && self?.engine.flags.wildMagnetPullInProgress==true},
            scheduleTimeout:{ms,elapsed,cancelled in guard current() else{return nil};return adapter.schedule(id:plan.id+":pull",generation:plan.generation,ms:ms,elapsed:elapsed,cancelled:cancelled)},
            recoveryCheck:{[weak self] _ in
                // A timeout is NOT a synthesized model commit. The actual
                // post-main rollback/recovery Core receipt is a separate gap.
                self?.onPresentationFailure?("source_magnet_pull_timeout_model_recovery_not_bound")
            },finished:{[weak self,weak entry] outcome in
                guard let self,let entry else{return}
                if self.sourceMagnetSourcePulls[plan.id] === entry {self.sourceMagnetSourcePulls.removeValue(forKey:plan.id)}
                entry.retired=true;entry.owner=nil;entry.capturedForceStop=nil
                for node in entry.nodes.values{node.releaseSourceMagnetPull(token:entry.token,generation:plan.generation,restore:false)}
                if outcome != .cleaned,self.sourceAnimationBindingAdmissionOpen,self.engine.state.generation==plan.generation {self.onPresentationFailure?("source_magnet_pull_"+String(describing:outcome))}
            }))
        entry.owner=owner
        let exactTargets=plan.targets.compactMap{tile in poses[tile.id].map{NativeSourceMagnetPullOwner.Target(id:tile.id,pose:$0)}}
        guard owner.start(targets:exactTargets,destination:sourceMagnetPullPoint(destination.position,geometry:geometry)),current(),entry.owner === owner else{retireSourceMagnetPull(entry);return false}
        return true
    }
    private func retireSourceMagnetPull(_ entry:SourceMagnetPullEntry){
        guard !entry.retired else{return};entry.retired=true
        if sourceMagnetSourcePulls[entry.plan.id] === entry {sourceMagnetSourcePulls.removeValue(forKey:entry.plan.id)}
        let owner=entry.owner;entry.owner=nil;owner?.dispose()
    }
    private func retireSourceMagnetPullBindings(){
        sourceMagnetPullScope=nil;sourceMagnetPullForceStopFactory=nil
        let selector=sourceMagnetPullSelectionOwner;sourceMagnetPullSelectionOwner=nil
        if let selector,engine.sourceMagnetPullSelection === selector {engine.sourceMagnetPullSelection=nil}
        let captures=Array(sourceMagnetSourcePulls.values);sourceMagnetSourcePulls=[:]
        captures.forEach{retireSourceMagnetPull($0)}
        let body=sourceMagnetBodyReleases;sourceMagnetBodyReleases=[:];body.values.forEach{$0.1()}
    }
    private func sourceMagnetBodyEnd(id:String,generation:UInt64){
        guard let capture=sourceMagnetBodyReleases[id],capture.0==generation else{return}
        sourceMagnetBodyReleases.removeValue(forKey:id);capture.1()
    }

    @MainActor private final class SourceSpecialMainEntry {
        let source:NativeDiceNode,destination:NativeDiceNode,generation:UInt64,owner:NativeSourceMergeSixAbsorbOwner
        var plan:NativeSpecialMovePlan?,capture:NativeSourceSpecialMainCapture<NativeDiceNode>?,retired=false
        var targetPoses:[String:(NativeDiceNode,CGPoint,CGFloat,CGFloat,CGFloat)]=[:]
        init(source:NativeDiceNode,destination:NativeDiceNode,generation:UInt64,owner:NativeSourceMergeSixAbsorbOwner){self.source=source;self.destination=destination;self.generation=generation;self.owner=owner}
    }
    private var sourceMagnetMainScope:NativeGameplaySourceContext.Scope?
    private var sourceMagnetMainPrepared:SourceSpecialMainEntry?
    private var sourceMagnetMainEntries:[String:SourceSpecialMainEntry]=[:]
    /// Only core Magnet source→already-bound regular destination, default OFF.
    /// Pull timelines/RNG/lazy survivor order have separate source admission.
    @discardableResult func configureSourceMagnetMain80(scope:NativeGameplaySourceContext.Scope)->Bool {
        guard sourceAnimationBindingAdmissionOpen,scope.current,sourceMagnetMainScope==nil,
              sourceContactScopeForMagnet === scope,sourceSpecialTransactions != nil,sourceMagnetBindings != nil,
              sourceDragTweenDriver === scope.tween,sourceStackFrameService === scope.service,
              scope.service.sourceFrameTransportAdmissionOpen,sourceContactVisualRandom != nil,
              textures.sourceRetainedRegularOpenTexturesReady else{return false}
        guard sourceAnimationBindingAdmissionOpen,scope.current,sourceMagnetMainScope==nil,
              sourceContactScopeForMagnet === scope,sourceAnimationBindingAdmissionOpen else{return false}
        sourceMagnetMainScope=scope;engine.sourceMagnetMain80Enabled=true;return true
    }
    /// Shared physical transport, retaining genuine Special-plan provenance.
    private func prepareSourceSpecialDestination(_ plan:NativeSpecialMovePlan,node:NativeDiceNode,
        scope:NativeGameplaySourceContext.Scope,random:@escaping()->Double,onFaceCancelled:@escaping()->Void,onFacePainted:@escaping()->Void = {})->Bool {
        if !plan.destination.isWild {
            if plan.archetype == .magnet {return node.prepareSourceMagnetRegularDestination(plan,service:scope.service,random:random,onFaceCancelled:onFaceCancelled)}
            return node.prepareSourceTntRegularDestination(plan,service:scope.service,random:random,onFaceCancelled:onFaceCancelled)
        }
        guard let texture=sourceDirectDestinationTexture(plan.destination),
              let receipt=engine.prepareSourceSpecialWildDestinationFace(transactionID:plan.id,generation:plan.generation) else{return false}
        let current:()->Bool = {[weak self,weak node] in
            guard let self,let node else{return false}
            return scope.current && self.engine.pendingSpecial?.id==plan.id && self.sourceMagnetMainNodeCurrent(node,generation:plan.generation)
        }
        return node.prepareSourceSpecialWildDestination(receipt,preparedStarTexture:texture,service:scope.service,random:random,
            current:current,commitPhysical:{[weak self] in
                guard let self,current() else{return false}
                return self.engine.commitSourceSpecialWildDestinationFace(receiptID:receipt.face.id,generation:plan.generation).accepted && current()
            },onFacePainted:onFacePainted,onFaceCancelled:onFaceCancelled)
    }
    private func sourceMagnetMainNodeCurrent(_ node:NativeDiceNode,generation:UInt64)->Bool {
        sourceAnimationBindingAdmissionOpen && engine.state.generation==generation && nodesByID[node.tileID] === node &&
        node.parent === canvasRoot && node.sourceGeneration==generation && node.sourceContactNodeAlive
    }
    private func sourceMagnetMainReady(_ src:NativeTile,_ dst:NativeTile,generation:UInt64)->Bool {
        guard NativeSpecialDiceRegistry.finale(source:src,destination:dst,gameplay:true) == .magnet,
              let scope=sourceMagnetMainScope,scope.current,sourceContactScopeForMagnet === scope,
              sourceMagnetMainPrepared==nil,sourceMagnetMainEntries.isEmpty,
              let a=nodesByID[src.id],let b=nodesByID[dst.id],sourceMagnetMainNodeCurrent(a,generation:generation),
              sourceMagnetMainNodeCurrent(b,generation:generation),a.sourceOuterDriven,b.sourceOuterDriven,
              a.sourceValue==src.value,b.sourceValue==dst.value,a.sourceStackDepth==src.stackDepth,b.sourceStackDepth==dst.stackDepth,
              !a.sourceRegularFramePending,!b.sourceRegularFramePending,
              (dst.isWild ? b.sourceWildDestinationFaceReady(service:scope.service) && sourceDirectDestinationTexture(dst) != nil:b.sourceMergeSixFaceReady(service:scope.service)),
              sourceMagnetLazyScope == nil || b.sourcePhysicalMarkersCovered else{return false}
        return sourceAnimationBindingAdmissionOpen && sourceMagnetMainScope === scope && scope.current && sourceMagnetMainNodeCurrent(a,generation:generation) && sourceMagnetMainNodeCurrent(b,generation:generation)
    }
    private func claimSourceMagnetMain(source:NativeTile,destination:NativeTile,kind:NativeWildArchetype,
        claim:()->NativeSourceSpecialContactLease?)->NativeSourceSpecialContactLease? {
        if kind == .tnt,sourceTntMainScope != nil {return claimSourceTntMain(source:source,destination:destination,claim:claim)}
        guard sourceMagnetMainScope != nil,kind == .magnet else{return claim()}
        let generation=engine.state.generation
        guard sourceMagnetMainReady(source,destination,generation:generation),let scope=sourceMagnetMainScope,
              let src=nodesByID[source.id],let dst=nodesByID[destination.id] else{return nil}
        let entry=SourceSpecialMainEntry(source:src,destination:dst,generation:generation,
            owner:NativeSourceMergeSixAbsorbOwner(host:src,driver:scope.tween))
        sourceMagnetMainPrepared=entry // captured before lazy auto roots/acquisition can reenter.
        let current:()->Bool = {[weak self,weak entry] in
            guard let self,let entry,!entry.retired else{return false}
            let bound=self.sourceMagnetMainPrepared === entry || entry.plan.map{self.sourceMagnetMainEntries[$0.id] === entry}==true
            return bound && self.sourceMagnetMainScope === scope && scope.current && !entry.retired && self.sourceMagnetMainNodeCurrent(entry.source,generation:generation) && self.sourceMagnetMainNodeCurrent(entry.destination,generation:generation)
        }
        guard entry.owner.startAuto(destination:dst.position,current:current,onScaleInitialize:{[weak src] in src?.killSourceActiveScaleChildren()}),current() else{retireSourceSpecialMainEntry(entry);return nil}
        guard let lease=claim() else{retireSourceSpecialMainEntry(entry);return nil}
        guard current() else{retireSourceSpecialMainEntry(entry);lease.rejected();return nil}
        return .init(isCurrent:{[weak entry] in guard let entry,!entry.retired,current() else{return false};let accepted=lease.isCurrent();return accepted && current()},
            rejected:{[weak self,entry] in self?.retireSourceSpecialMainEntry(entry);lease.rejected()})
    }
    private func sourceMagnetMainOwns(_ node:NativeDiceNode)->Bool {
        Array(sourceMagnetMainEntries.values).contains{entry in
            guard !entry.retired,let capture=entry.capture else{return false}
            if capture.phase == .entered {return entry.destination === node && sourceMagnetMainNodeCurrent(node,generation:entry.generation)}
            return capture.retains(node,id:node.tileID,generation:entry.generation)
        }
    }
    private func startSourceMagnetMain(_ plan:NativeSpecialMovePlan,result:NativeMoveResult,previous:NativeBoardState)->Bool {
        guard let entry=sourceMagnetMainPrepared,let scope=sourceMagnetMainScope,!entry.retired,
              entry.generation==plan.generation,entry.source.tileID==plan.source.id,entry.destination.tileID==plan.destination.id,
              sourceMagnetMainNodeCurrent(entry.source,generation:plan.generation),sourceMagnetMainNodeCurrent(entry.destination,generation:plan.generation) else{return false}
        sourceMagnetMainPrepared=nil;entry.plan=plan;sourceMagnetMainEntries[plan.id]=entry
        for tile in plan.targets {if let node=nodesByID[tile.id] {entry.targetPoses[tile.id]=(node,node.position,node.xScale,node.yScale,node.visual.zRotation)}}
        var canceled:NativeMoveResult?
        let capture=NativeSourceSpecialMainCapture(plan:plan,source:entry.source,destination:entry.destination,hooks:.init(
            generationCurrent:{[weak self] in self?.engine.state.generation==plan.generation},
            nodeCurrent:{[weak self] node,_,generation in self?.sourceMagnetMainNodeCurrent(node,generation:generation)==true},
            register:{[weak self,weak entry] in
                guard let self,let entry,!entry.retired,self.sourceMagnetMainEntries[plan.id] === entry,
                      self.sourceMagnetMainScope === scope,scope.current else{return nil}
                return self.engine.registerSourceSpecialAbsorbOwner(transactionID:plan.id,generation:plan.generation)
            },commit:{[weak self,weak entry] receipt in
                guard let self,let entry,!entry.retired,self.sourceMagnetMainEntries[plan.id] === entry else{return false}
                return self.engine.commitSourceSpecialAbsorbMain(receiptID:receipt.id,generation:receipt.generation).accepted
            },cancel:{[weak self] receipt in
                guard let self else{return false}
                let result=self.engine.cancelSourceSpecialAbsorb(receiptID:receipt.id,generation:receipt.generation)
                if result.accepted {canceled=result};return result.accepted
            },removeCapturedPair:{[weak self] src,dst in
                guard let self else{return}
                for node in [src,dst] where self.nodesByID[node.tileID] === node {self.nodesByID.removeValue(forKey:node.tileID);node.dispose();node.removeFromParent()}
            },cleanupCapturedPull:{[weak self,weak entry] in
                guard let self,let entry,self.engine.state.generation==plan.generation else{return}
                let sourcePull=self.sourceMagnetSourcePulls[plan.id]
                if let sourcePull {self.retireSourceMagnetPull(sourcePull)}
                // Existing Raw carrier remains separately clocked.
                // Exact actual object/paint capture is restored on its owned
                // destructive cancellation; neither center reset nor new idle.
                let carrier=self.sourceMagnetPullCarriers.removeValue(forKey:plan.id);carrier?.removeAllActions();carrier?.removeFromParent()
                if sourcePull==nil {
                    for(_,pose) in entry.targetPoses where self.nodesByID[pose.0.tileID] === pose.0 && pose.0.parent === self.canvasRoot && pose.0.sourceGeneration==plan.generation && pose.0.sourceContactNodeAlive {
                        pose.0.position=pose.1;pose.0.xScale=pose.2;pose.0.yScale=pose.3;pose.0.visual.zRotation=pose.4
                    }
                }
            },releaseMainFramesAndIdle:{[weak self] in self?.sourceMagnetBodyEnd(id:plan.id,generation:plan.generation)},
            releaseSpecialAndQueue:{[weak self] in self?.sourceSpecialTransactions?.absorbInterrupted(id:plan.id,generation:plan.generation)},
            publishCanceledState:{[weak self,weak entry] in
                guard let self,let entry,let canceled,self.engine.state.generation==plan.generation else{return}
                self.specialPresentationID=nil;self.retireSourceSpecialMainEntry(entry)
                self.consume(canceled,previous:self.engine.state)
            },continueAfterMain:{[weak self,weak entry] in
                guard let self,let entry,self.sourceAnimationBindingAdmissionOpen,self.sourceMagnetMainEntries[plan.id] === entry,!entry.retired else{return}
                // Literal main80 removes only the actual src while dst remains
                // the same protected six for its genuine pull continuation.
                guard self.playSourceWildScreenShake(.wild(archetype:plan.archetype,isFinal:false),ownerID:plan.id,variant:plan.variant,generation:plan.generation) else {
                    self.onSourcePresentationFailure?("source_magnet_screen_shake_rejected",plan.generation);return
                }
                guard self.playSourceWildMergeSixParticles(ownerID:plan.id,archetype:plan.archetype,variant:plan.variant,
                    destination:entry.destination,generation:plan.generation,stage:.shards) else {
                    self.onSourcePresentationFailure?("source_magnet_merge6_particles_rejected",plan.generation);return
                }
                if plan.archetype == .magnet {
                    guard self.playSourceMagnetMultiplier(ownerID:plan.id,destination:entry.destination,multiplier:2,
                        generation:plan.generation,service:scope.service,current:{[weak self,scope] in
                            self?.sourceMagnetMainScope === scope && scope.current
                        }) else {self.onSourcePresentationFailure?("source_magnet_multiplier_not_bound",plan.generation);return}
                }
                guard self.playSourceWildMergeSixParticles(ownerID:plan.id,archetype:plan.archetype,variant:plan.variant,
                    destination:entry.destination,generation:plan.generation,stage:.smoke) else {
                    self.onSourcePresentationFailure?("source_magnet_merge6_particles_rejected",plan.generation);return
                }
                if !plan.targets.isEmpty {
                    let destination=entry.destination
                    let impact=NativeSourceMagnetImpactOwner(node:destination,service:scope.service,generation:plan.generation,current:{[weak self,weak destination,scope] in
                        guard let self,let destination else{return false}
                        return self.sourceMagnetMainScope === scope && scope.current && self.engine.pendingSpecial?.id==plan.id && self.sourceMagnetMainNodeCurrent(destination,generation:plan.generation)
                    })
                    self.sourceMagnetImpacts.removeValue(forKey:plan.id)?.dispose()
                    self.sourceMagnetImpacts[plan.id]=impact
                    impact.onFinished={[weak self,weak impact] in
                        if self?.sourceMagnetImpacts[plan.id] === impact {self?.sourceMagnetImpacts.removeValue(forKey:plan.id)}
                    }
                    guard impact.begin() else{self.onSourcePresentationFailure?("source_magnet_impact_not_bound",plan.generation);return}
                }
                // v9 main80 calls showMagneticText after the Magnet shards;
                // Honey, Bottle and Spaceship mount their selected authored scene there.
                // The generic merged-event path excludes pendingSpecial, so
                // this actual Source main continuation owns that presentation.
                if let variant=plan.variant,variant=="spaceship" || variant=="bottle" || variant=="honey" {
                    guard self.authoredFinale(variant,at:entry.destination.position) else {
                        self.onSourcePresentationFailure?("source_\(variant)_main_finale_not_admitted",plan.generation);return
                    }
                }
                if plan.variant==nil,!self.coreMagnetFinale() {
                    self.onSourcePresentationFailure?("source_magnet_main_finale_not_admitted",plan.generation);return
                }
                if self.nodesByID[entry.source.tileID] === entry.source {self.nodesByID.removeValue(forKey:entry.source.tileID);entry.source.dispose();entry.source.removeFromParent()}
            },retireNativeRoots:{[weak entry] in entry?.owner.dispose()}))
        entry.capture=capture
        guard prepareSourceSpecialDestination(plan,node:entry.destination,scope:scope,random:{scope.smokeSession.nextVisualRandom()},
            onFaceCancelled:{[weak self,weak entry] in if let entry {self?.retireSourceSpecialMainEntry(entry)}}),sourceMagnetMainNodeCurrent(entry.destination,generation:plan.generation),!entry.retired else{retireSourceSpecialMainEntry(entry);return false}
        if sourceMagnetPullScope === scope {
            let prior=sourceMagnetBodyReleases;sourceMagnetBodyReleases=[:];prior.values.forEach{$0.1()}
            guard sourceAnimationBindingAdmissionOpen,!entry.retired,sourceMagnetMainEntries[plan.id] === entry,scope.current else{retireSourceSpecialMainEntry(entry);return false}
            guard let frames=beginSourceMotion(.mergeSixResolution,id:plan.id,generation:plan.generation) else{retireSourceSpecialMainEntry(entry);return false}
            guard sourceAnimationBindingAdmissionOpen,!entry.retired,sourceMagnetMainEntries[plan.id] === entry,scope.current else{frames();retireSourceSpecialMainEntry(entry);return false}
            let idle=scope.specialIdle.acquire(reason:"merge6-resolution")
            guard sourceAnimationBindingAdmissionOpen,!entry.retired,sourceMagnetMainEntries[plan.id] === entry,scope.current,let idle else{frames();idle?();retireSourceSpecialMainEntry(entry);return false}
            sourceMagnetBodyReleases[plan.id]=(plan.generation,{frames();idle()})
        }
        let origin=sourceSpecialHUDScreenOrigin(node:entry.destination,generation:plan.generation)
        guard consumeSourceSpecialHUDCall(result,previous:previous,origin:origin) else{retireSourceSpecialMainEntry(entry);return false} // actual prefix cue/pull roots precede main registration.
        guard sourceAnimationBindingAdmissionOpen,!entry.retired,sourceMagnetMainEntries[plan.id] === entry else{retireSourceSpecialMainEntry(entry);return false}
        var installed:UUID?
        let admitted=entry.owner.startMain(destination:entry.destination.position,current:{[weak self,weak entry] in
            guard let self,let entry,!entry.retired else{return false};return self.sourceMagnetMainEntries[plan.id] === entry && self.sourceMagnetMainScope === scope && scope.current && self.sourceMagnetMainNodeCurrent(entry.source,generation:plan.generation) && self.sourceMagnetMainNodeCurrent(entry.destination,generation:plan.generation)
        },onInstalled:{[weak capture] receipt in installed=receipt.id;if capture?.mainInstalled(receipt.id) != true {capture?.capturedObjectRetired()}},
            onCompleted:{[weak capture] in if let installed {_=capture?.mainCompleted(installed)}},
            onInterrupted:{[weak capture] in if let installed {_=capture?.mainInterrupted(installed)}})
        guard admitted,capture.phase == .installed,!entry.retired else{retireSourceSpecialMainEntry(entry);return false}
        return true
    }
    private func retireSourceSpecialMainEntry(_ entry:SourceSpecialMainEntry){
        guard !entry.retired else{return}
        let capture=entry.capture,plan=entry.plan
        let setup=(capture?.phase == .captured || capture?.phase == .retired && capture?.coreReceipt==nil)
        entry.retired=true
        if sourceMagnetMainPrepared === entry {sourceMagnetMainPrepared=nil}
        if let id=plan?.id,sourceMagnetMainEntries[id] === entry {sourceMagnetMainEntries.removeValue(forKey:id)}
        entry.capture=nil // seal/unhook BEFORE Core/registry/native cancellation callbacks.
        if setup,let plan,engine.state.generation==plan.generation {
            let result=engine.cancelSourceMagnetMainSetup(transactionID:plan.id,generation:plan.generation)
            if result.accepted {
                for node in [entry.source,entry.destination] where nodesByID[node.tileID] === node {nodesByID.removeValue(forKey:node.tileID);node.dispose();node.removeFromParent()}
                sourceSpecialTransactions?.absorbInterrupted(id:plan.id,generation:plan.generation)
            }
        }
        capture?.capturedObjectRetired();capture?.retireObsolete();entry.owner.dispose()
        if setup,let plan {sourceMagnetBodyEnd(id:plan.id,generation:plan.generation)}
    }
    private func retireSourceMagnetMain(){
        let entries=Array(sourceMagnetMainEntries.values)+(sourceMagnetMainPrepared.map{[$0]} ?? [])
        sourceMagnetMainEntries=[:];sourceMagnetMainPrepared=nil
        entries.forEach{entry in entry.capture?.capturedObjectRetired();retireSourceSpecialMainEntry(entry)}
        sourceMagnetMainScope=nil;engine.sourceMagnetMain80Enabled=false
    }

    private var sourceTntMainScope:NativeGameplaySourceContext.Scope?
    private var sourceTntBoardBlast:NativeSourceTntBoardBlastOwner?
    private var sourceTntBonusTimers:Set<NativeSourceAppTimeoutOwner.Receipt>=[]
    private var sourceTntBonusBounces:[String:()->Void]=[:]
    private(set) var sourceTntBonusConstructorCount=0
    private(set) var sourceTntBonusSharedFxCount=0
    private(set) var sourceTntFinaleSourceConstructionCount=0
    private var sourceTntDirectBoomExitCallbacks:[String:(generation:UInt64,complete:()->Void)]=[:]
    private(set) var sourceTntDirectBoomExitCount=0
    func sourceTntGlyphExitCompleted(id:String,generation:UInt64) {
        guard let captured=sourceTntDirectBoomExitCallbacks[id],captured.generation==generation,
              engine.state.generation==generation,sourceAnimationBindingAdmissionOpen else{return}
        sourceTntDirectBoomExitCallbacks.removeValue(forKey:id)
        sourceTntDirectBoomExitCount+=1;captured.complete()
    }
    var onPrepareSourceTntGlyphs:((String,NativeGameplaySourceContext.Scope,UInt64)->Bool)?
    var sourceTntTransactionCaptureCount:Int {sourceSpecialTransactions?.capturedTntCount ?? 0}
    private var sourceTntMainPrepared:SourceSpecialMainEntry?
    private var sourceTntMainEntries:[String:SourceSpecialMainEntry]=[:]
    private var sourceTntSpawnClaims:[String:NativeSourceMergeSixSpawnOwner.Claim]=[:]
    private var sourceTntResumes:Set<String>=[]
    private var sourceTntFinallys:Set<String>=[]
    private(set) var sourceTntMainDeliveredCount=0,sourceTntSpawnBeginCount=0,sourceTntSpawnFinallyCount=0,sourceTntNoTargetCompletionCount=0,sourceTntCompletion80ScheduledCount=0
    var sourceTntCapturedMainCount:Int {sourceTntMainEntries.count+(sourceTntMainPrepared==nil ? 0:1)}
    func sourceTntMainDiagnostic()->String {
        let entries=sourceTntMainEntries.values.map {entry in
            "plan=\(entry.plan?.id ?? "none");phase=\(String(describing:entry.capture?.phase));core=\(String(describing:entry.capture?.coreReceipt));retired=\(entry.retired);source=\(sourceMagnetMainNodeCurrent(entry.source,generation:entry.generation));destination=\(sourceMagnetMainNodeCurrent(entry.destination,generation:entry.generation))"
        }.joined(separator:"|")
        let objects=nodesByID.keys.sorted().map {id in let node=nodesByID[id]!;return "\(id):alive=\(node.sourceContactNodeAlive),parent=\(node.parent === canvasRoot),gen=\(node.sourceGeneration),cell=\(String(describing:node.sourceGridCell))"}.joined(separator:"|")
        return "admission=\(sourceAnimationBindingAdmissionOpen);entries=\(entries);coreMain=\(engine.sourceSpecialAbsorbMainEntered);face=\(String(describing:engine.pendingSourceSpecialWildDestinationFace));objects=\(objects)"
    }
    @discardableResult func configureSourceTntMain80(scope:NativeGameplaySourceContext.Scope)->Bool {
        guard sourceAnimationBindingAdmissionOpen,scope.current,sourceTntMainScope==nil,
              sourceSixScope === scope,sourceDirectScope === scope,sourceSpecialTransactions != nil,
              sourceEndgameMutationScope === scope,sourceEndgameMutationLedgerAdmissionOpen,
              let authority=sourceOwnedOrdinaryMinimumTileAuthority,engine.sourceWildMinimumTileAuthority === authority,
              authority.isCurrent(),sourceMicrotaskInstallation?.isCurrent==true,
              engine.stagedTntActivation,engine.sourceTntSpawnBegin==nil else{return false}
        if sourceStackCoreFaceReceiptsEnabled {
            guard let presence=sourceOwnedFinalMergePresenceAuthority,
                  engine.sourceFinalMergePresenceAuthority === presence,presence.isCurrent() else{return false}
        }
        sourceTntMainScope=scope;engine.sourceTntMain80Enabled=true;engine.sourceTntBonusValuesAtImpact=true;engine.sourceTntInitialAwaitEnabled=true;engine.sourceTntPhysicalPreSpawnGuardsEnabled=true;engine.sourceTntLockedBonusPhysicalGuardsEnabled=sourceStackCoreFaceReceiptsEnabled
        engine.stagedTntWildSpawnAssignments=true
        let generation=engine.state.generation,epoch=sourceEndgameMutationEpoch
        let current:()->Bool = {[weak self,weak scope] in
            guard let self,let scope else{return false}
            return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceTntMainScope === scope &&
                self.sourceDirectScope === scope && self.sourceEndgameMutationScope === scope &&
                self.sourceEndgameMutationEpoch==epoch && self.engine.state.generation==generation
        }
        engine.sourceTntSpawnBegin={[weak self,weak scope] receipt in
            guard let self,let scope,current(),self.engine.sourceTntSpawnBeginIsCurrent(receipt),
                  let binding=self.sourceEndgameMutationBinding,self.sourceTntSpawnClaims[receipt.ownerID]==nil else{return false}
            let captured=self.engine.state
            guard let claim=binding.beginTntSpawn(receipt,service:scope.service,resets:.init(
                endResolutionFrames:{[weak self] in if current(){self?.finishSourceGameplay(.mergeSixResolution,id:receipt.ownerID,generation:generation)}},
                releaseSpecialTransaction:{[weak self] in if current(){self?.sourceSpecialTransactions?.absorbInterrupted(id:receipt.ownerID,generation:generation)}},
                queueWildAfterGuardRelease:{[weak self] in if current(){self?.requestSourceMeterQueueAfterGuardRelease(scope:scope,generation:generation)}}),
                current:{current() && self.engine.state==captured && self.engine.sourceTntSpawnBeginIsCurrent(receipt)}),current(),self.engine.state==captured else{return false}
            self.sourceTntSpawnClaims[receipt.ownerID]=claim;self.sourceTntSpawnBeginCount+=1;return true
        }
        engine.sourceTntCoroutineResume={[weak self,weak scope] id,g in
            guard let self,let scope,current(),g==generation,let fifo=self.sourceMicrotaskInstallation,fifo.isCurrent else{return false}
            if self.sourceTntResumes.contains(id){return true};self.sourceTntResumes.insert(id)
            let accepted=fifo.enqueue{[weak self,weak fifo] in
                guard let self,self.sourceTntResumes.remove(id) != nil,current(),let fifo,
                      self.sourceMicrotaskInstallation === fifo,fifo.isCurrent,self.engine.hasSourceTntSpawnCoroutine(transactionID:id,generation:g) else{return}
                let previous=self.engine.state,result=self.engine.resumeSourceWildSpawnCoroutine(transactionID:id,generation:g)
                guard result.accepted else{self.onSourcePresentationFailure?("source_tnt_spawn_resume_refused",g);return}
                self.consume(result,previous:previous)
            }
            if !accepted {self.sourceTntResumes.remove(id)}
            return accepted
        }
        engine.sourceTntLockedBonusGuardResume={[weak self,weak scope] receipt in
            guard let self,let scope,current(),receipt.generation==generation,
                  self.sourceTntMainScope === scope,self.engine.pendingSourceTntLockedBonusGuard==receipt,
                  let fifo=self.sourceMicrotaskInstallation,fifo.isCurrent,
                  self.sourceTntLockedBonusGuardResumes[receipt.id]==nil else{return false}
            self.sourceTntLockedBonusGuardResumes[receipt.id]=receipt
            let accepted=fifo.enqueue{[weak self,weak fifo] in
                guard let self,self.sourceTntLockedBonusGuardResumes.removeValue(forKey:receipt.id)==receipt else{return}
                guard current(),let fifo,self.sourceMicrotaskInstallation === fifo,fifo.isCurrent,
                      self.engine.sourceTntLockedBonusGuardIsCurrent(receipt) else {
                    _=self.engine.retireSourceTntLockedBonusGuard(receipt);return
                }
                let previous=self.engine.state,result=self.engine.resumeSourceTntLockedBonusGuard(receipt)
                guard result.accepted else {
                    _=self.engine.retireSourceTntLockedBonusGuard(receipt)
                    self.onSourcePresentationFailure?("source_tnt_outer_bonus_guard_refused",receipt.generation);return
                }
                self.sourceTntLockedBonusGuardAwaitDeliveredCount+=1
                self.consume(result,previous:previous)
            }
            if !accepted {self.sourceTntLockedBonusGuardResumes.removeValue(forKey:receipt.id)}
            return accepted
        }
        engine.sourceTntCoroutineFinally={[weak self] id,g in
            guard let self,current(),g==generation,self.engine.hasSettledSourceTntSpawnCoroutine(transactionID:id,generation:g),
                  let fifo=self.sourceMicrotaskInstallation,fifo.isCurrent,!self.sourceTntFinallys.contains(id) else{return false}
            self.sourceTntFinallys.insert(id)
            let accepted=fifo.enqueue{[weak self,weak fifo] in
                guard let self,self.sourceTntFinallys.remove(id) != nil,current(),let fifo,fifo.isCurrent,
                      self.sourceMicrotaskInstallation === fifo,let binding=self.sourceEndgameMutationBinding,
                      let claim=self.sourceTntSpawnClaims.removeValue(forKey:id) else{return}
                if binding.resetSpawn(claim,releaseSpecial:false) {
                    self.sourceTntSpawnFinallyCount+=1
                    // Original app-core checks after the awaited spawn/minimum
                    // continuation. The exact settled coroutine/claim owns this
                    // callback, including the no-bonus-target return branch.
                    if current(),self.engine.state.generation==g,
                       self.engine.hasSettledSourceTntSpawnCoroutine(transactionID:id,generation:g) {self.evaluate()}
                } else {self.onSourcePresentationFailure?("source_tnt_spawn_finally_refused",g)}
            }
            if !accepted {self.sourceTntFinallys.remove(id)}
            return accepted
        }
        return current()
    }
    private func sourceTntMainReady(_ src:NativeTile,_ dst:NativeTile,generation:UInt64)->Bool {
        guard NativeSpecialDiceRegistry.finale(source:src,destination:dst,gameplay:true) == .tnt,
              let scope=sourceTntMainScope,scope.current,sourceTntMainPrepared==nil,sourceTntMainEntries.isEmpty,
              let a=nodesByID[src.id],let b=nodesByID[dst.id],sourceMagnetMainNodeCurrent(a,generation:generation),
              sourceMagnetMainNodeCurrent(b,generation:generation),a.sourceOuterDriven,b.sourceOuterDriven,
              a.sourceValue==src.value,b.sourceValue==dst.value,!a.sourceRegularFramePending,!b.sourceRegularFramePending,
              (dst.isWild ? b.sourceWildDestinationFaceReady(service:scope.service) && sourceDirectDestinationTexture(dst) != nil:b.sourceMergeSixFaceReady(service:scope.service)) else{return false}
        return sourceAnimationBindingAdmissionOpen && sourceTntMainScope === scope && scope.current
    }
    private func claimSourceTntMain(source:NativeTile,destination:NativeTile,claim:()->NativeSourceSpecialContactLease?)->NativeSourceSpecialContactLease? {
        let generation=engine.state.generation
        guard sourceTntMainReady(source,destination,generation:generation),let scope=sourceTntMainScope,
              let src=nodesByID[source.id],let dst=nodesByID[destination.id] else{return nil}
        let entry=SourceSpecialMainEntry(source:src,destination:dst,generation:generation,
            owner:NativeSourceMergeSixAbsorbOwner(host:src,driver:scope.tween))
        sourceTntMainPrepared=entry
        let current:()->Bool = {[weak self,weak entry] in
            guard let self,let entry,!entry.retired else{return false}
            return self.sourceTntMainScope === scope && scope.current && self.sourceMagnetMainNodeCurrent(src,generation:generation) &&
                self.sourceMagnetMainNodeCurrent(dst,generation:generation) &&
                (self.sourceTntMainPrepared === entry || entry.plan.map{self.sourceTntMainEntries[$0.id] === entry}==true)
        }
        guard entry.owner.startAuto(destination:dst.position,current:current,onScaleInitialize:{[weak src] in src?.killSourceActiveScaleChildren()}),current() else{retireSourceTntMainEntry(entry);return nil}
        guard let lease=claim() else{retireSourceTntMainEntry(entry);return nil}
        guard current() else{retireSourceTntMainEntry(entry);lease.rejected();return nil}
        return .init(isCurrent:{current() && lease.isCurrent() && current()},rejected:{[weak self,entry] in self?.retireSourceTntMainEntry(entry);lease.rejected()})
    }
    private func sourceTntMainOwns(_ node:NativeDiceNode)->Bool {
        sourceTntMainEntries.values.contains{entry in
            guard !entry.retired,let capture=entry.capture,capture.phase != .entered else{return false}
            return capture.retains(node,id:node.tileID,generation:entry.generation)
        }
    }
    private func startSourceTntMain(_ plan:NativeSpecialMovePlan,result:NativeMoveResult,previous:NativeBoardState)->Bool {
        guard let entry=sourceTntMainPrepared,let scope=sourceTntMainScope,!entry.retired,
              entry.source.tileID==plan.source.id,entry.destination.tileID==plan.destination.id,
              entry.generation==plan.generation else{return false}
        sourceTntMainPrepared=nil;entry.plan=plan;sourceTntMainEntries[plan.id]=entry
        var canceled:NativeMoveResult?
        let capture=NativeSourceSpecialMainCapture(plan:plan,source:entry.source,destination:entry.destination,hooks:.init(
            generationCurrent:{[weak self] in self?.engine.state.generation==plan.generation},
            nodeCurrent:{[weak self] node,_,g in self?.sourceMagnetMainNodeCurrent(node,generation:g)==true},
            register:{[weak self] in self?.engine.registerSourceSpecialAbsorbOwner(transactionID:plan.id,generation:plan.generation)},
            commit:{[weak self] receipt in
                guard let self else{return false}
                let result=self.engine.commitSourceSpecialAbsorbMain(receiptID:receipt.id,generation:receipt.generation)
                if !result.accepted {NSLog("[NativeSourceTntMain] refused %@: %@",receipt.id,result.events.first?.reason ?? "unknown")}
                return result.accepted
            },mainReady:{[weak self] in self?.engine.sourceSpecialWildDestinationFaceDelivered(transactionID:plan.id,generation:plan.generation)==true},
            cancel:{[weak self] receipt in guard let self else{return false};let r=self.engine.cancelSourceSpecialAbsorb(receiptID:receipt.id,generation:receipt.generation);if r.accepted{canceled=r};return r.accepted},
            removeCapturedPair:{[weak self] a,b in guard let self else{return};for node in [a,b] where self.nodesByID[node.tileID] === node {self.nodesByID.removeValue(forKey:node.tileID);node.dispose();node.removeFromParent()}},
            cleanupCapturedPull:{[weak self] in
                guard let self else{return}
                if let visual=self.sourceTntNativeVisualReceipts.removeValue(forKey:plan.id){self.finishVisual(visual)}
                self.specialPresentationIDs.removeAll()
            },
            releaseMainFramesAndIdle:{[weak self] in self?.finishSourceGameplay(.mergeSixResolution,id:plan.id,generation:plan.generation)},
            releaseSpecialAndQueue:{[weak self] in self?.sourceSpecialTransactions?.absorbInterrupted(id:plan.id,generation:plan.generation)},
            publishCanceledState:{[weak self,weak entry] in
                guard let self,let entry,let canceled else{return}
                self.specialPresentationID=nil;self.specialPresentationIDs.removeAll();self.navigationLocked=self.engine.state.terminal != nil
                self.retireSourceTntMainEntry(entry);self.consume(canceled,previous:self.engine.state)
            },
            continueAfterMain:{[weak self,weak entry] in
                guard let self,let entry,!entry.retired,self.sourceTntMainScope === scope,scope.current,
                      self.sourceTntMainEntries[plan.id] === entry,let geometry=self.geometry else{return}
                self.sourceTntMainDeliveredCount+=1
                if self.nodesByID[entry.source.tileID] === entry.source {self.nodesByID.removeValue(forKey:entry.source.tileID);entry.source.dispose();entry.source.removeFromParent()}
                let blastIDs=Set(self.engine.state.tiles.filter{$0.id != plan.destination.id && ($0.value>0 || $0.isWild) && !$0.locked}.map(\.id))
                let previous=self.engine.state,activated=self.engine.commitSpecialActivation(transactionID:plan.id)
                guard activated.accepted else{self.onSourcePresentationFailure?("source_tnt_main_activation_refused",plan.generation);return}
                guard let host=self.gameplayRenderHost,entry.destination.parent === self.canvasRoot,
                      let hud=self.captureSourceHUDOrigins(activated,screenOrigin:host.scenePointToView(entry.destination.convert(CGPoint.zero,to:self),scene:self)) else {
                    self.onSourcePresentationFailure?("source_tnt_main_hud_origin_not_admitted",plan.generation);return
                }
                self.consume(activated,previous:previous)
                for id in hud {self.sourceCapturedHUDOrigins.removeValue(forKey:id)}
                guard self.sourceAnimationBindingAdmissionOpen,scope.current,self.specialIsCurrent(plan) else{return}
                guard let visual=self.sourceTntNativeVisualReceipts.removeValue(forKey:plan.id) else{self.onSourcePresentationFailure?("source_tnt_visual_receipt_missing",plan.generation);return}
                let shakeTargetCount=self.engine.pendingSpecial?.targets.count ?? 0
                // Laser owns its actual impact/fake-out presentation, just as
                // the existing authored activation route. It has no TNT
                // Flower/Barrel/Beach return-wave gameplay-ready callback.
                if plan.variant == "laser-gun" {self.startLaserImpacts(plan,receipt:visual)}
                else {self.playCoreTntTransaction(plan,receipt:visual,geometry:geometry,blastIDs:blastIDs)}
                guard self.playSourceWildScreenShake(.wild(archetype:plan.archetype,isFinal:false,tntTargetCount:shakeTargetCount),ownerID:plan.id,variant:plan.variant,generation:plan.generation) else {
                    self.onSourcePresentationFailure?("source_tnt_screen_shake_rejected",plan.generation);return
                }
                guard self.playSourceWildMergeSixParticles(ownerID:plan.id,archetype:plan.archetype,variant:plan.variant,
                    destination:entry.destination,generation:plan.generation) else {
                    self.onSourcePresentationFailure?("source_tnt_merge6_particles_rejected",plan.generation);return
                }
                self.retireSourceTntMainEntry(entry)
            },retireNativeRoots:{[weak entry] in entry?.owner.dispose()}))
        entry.capture=capture
        guard prepareSourceSpecialDestination(plan,node:entry.destination,scope:scope,random:{scope.mathRandom.next()},onFaceCancelled:{[weak capture] in
            if capture?.phase == .captured || capture?.phase == .installed {capture?.capturedObjectRetired()}
        },onFacePainted:{[weak capture] in _=capture?.resumeDeliveredMain()}) else{retireSourceTntMainEntry(entry);return false}
        beginSourceGameplay(.mergeSixResolution,id:plan.id,generation:plan.generation)
        let origin=sourceSpecialHUDScreenOrigin(node:entry.destination,generation:plan.generation)
        guard consumeSourceSpecialHUDCall(result,previous:previous,origin:origin) else{retireSourceTntMainEntry(entry);return false}
        var installed:UUID?
        let admitted=entry.owner.startMain(destination:entry.destination.position,current:{[weak self,weak entry] in
            guard let self,let entry,!entry.retired else{return false};return scope.current && self.sourceTntMainScope === scope &&
                self.sourceTntMainEntries[plan.id] === entry && self.sourceMagnetMainNodeCurrent(entry.source,generation:plan.generation) && self.sourceMagnetMainNodeCurrent(entry.destination,generation:plan.generation)
        },onInstalled:{[weak capture] r in installed=r.id;if capture?.mainInstalled(r.id) != true{capture?.capturedObjectRetired()}},
            onCompleted:{[weak capture] in if let installed{_=capture?.mainCompleted(installed)}},
            onInterrupted:{[weak capture] in if let installed{_=capture?.mainInterrupted(installed)}})
        guard admitted,capture.phase == .installed else{retireSourceTntMainEntry(entry);return false}
        return true
    }
    private var sourceTntLockedBonusGuardResumes:[UUID:NativeSourceTntLockedBonusGuardReceipt]=[:]
    private(set) var sourceTntLockedBonusGuardAwaitDeliveredCount=0
    private var sourceTntNativeVisualReceipts:[String:UInt64]=[:]
    private func retireSourceTntMainEntry(_ entry:SourceSpecialMainEntry){
        guard !entry.retired else{return};entry.retired=true
        if sourceTntMainPrepared === entry {sourceTntMainPrepared=nil}
        if let id=entry.plan?.id,sourceTntMainEntries[id] === entry {sourceTntMainEntries.removeValue(forKey:id)}
        let capture=entry.capture,plan=entry.plan;entry.capture=nil
        if let plan,capture?.coreReceipt==nil,engine.state.generation==plan.generation {
            let result=engine.cancelSourceTntMainSetup(transactionID:plan.id,generation:plan.generation)
            if result.accepted {
                for node in [entry.source,entry.destination] where nodesByID[node.tileID] === node {nodesByID.removeValue(forKey:node.tileID);node.dispose();node.removeFromParent()}
                if let visual=sourceTntNativeVisualReceipts.removeValue(forKey:plan.id){finishVisual(visual)}
                sourceSpecialTransactions?.absorbInterrupted(id:plan.id,generation:plan.generation)
                specialPresentationID=nil;specialPresentationIDs.removeAll();navigationLocked=engine.state.terminal != nil
                consume(result,previous:engine.state)
            }
        }
        capture?.capturedObjectRetired();entry.owner.dispose()
    }
    private func retireSourceTntMain(){
        let outer=Array(sourceTntLockedBonusGuardResumes.values);sourceTntLockedBonusGuardResumes=[:]
        engine.sourceTntLockedBonusGuardResume=nil;engine.sourceTntLockedBonusPhysicalGuardsEnabled=false
        for receipt in outer {_=engine.retireSourceTntLockedBonusGuard(receipt)}
        let timers=sourceTntBonusTimers;sourceTntBonusTimers=[];sourceTntBonusBounces=[:]
        timers.forEach{_=sourceAppTimeouts.cancel($0)}
        let blast=sourceTntBoardBlast;sourceTntBoardBlast=nil;blast?.dispose()
        let entries=Array(sourceTntMainEntries.values)+(sourceTntMainPrepared.map{[$0]} ?? [])
        sourceTntMainEntries=[:];sourceTntMainPrepared=nil;sourceTntMainScope=nil
        engine.sourceTntSpawnBegin=nil;engine.sourceTntCoroutineResume=nil;engine.sourceTntCoroutineFinally=nil
        sourceTntResumes=[];sourceTntFinallys=[];sourceTntSpawnClaims=[:]
        // Exact setup cancellation must still see its selected Core admission;
        // unhook callbacks first, then retire captures before disabling it.
        entries.forEach{retireSourceTntMainEntry($0)}
        engine.sourceTntMain80Enabled=false;engine.sourceTntBonusValuesAtImpact=false;engine.sourceTntInitialAwaitEnabled=false;engine.sourceTntPhysicalPreSpawnGuardsEnabled=false;engine.stagedTntWildSpawnAssignments=false
        let visuals=sourceTntNativeVisualReceipts;sourceTntNativeVisualReceipts=[:]
        visuals.values.forEach{finishVisual($0)}
    }
    private var sourceSpecialTransactions:NativeSourceSpecialSceneTransactionOwner?
    private var sourceSpecialContactHook:NativeSourceSpecialContactHook?
    private weak var sourceSpecialTransactionsScope:NativeGameplaySourceContext.Scope?
    @discardableResult func configureSourceSpecialTransactions(scope:NativeGameplaySourceContext.Scope)->Bool {
        guard sourceAnimationBindingAdmissionOpen,scope.current,sourceSpecialTransactions==nil,
              engine.sourceSpecialContactHook==nil else{return false}
        let generation=engine.state.generation
        let owner=NativeSourceSpecialSceneTransactionOwner(scope:scope.registries,mutations:scope.contactMutations,
            current:{[weak self,scope] in guard let self else{return false};return self.sourceAnimationBindingAdmissionOpen && scope.current && self.engine.state.generation==generation},
            guardReleased:{[weak self,weak scope] in
                guard let self,let scope else{return}
                self.requestSourceMeterQueueAfterGuardRelease(scope:scope,generation:generation)
            })
        guard owner.mount(),sourceAnimationBindingAdmissionOpen,scope.current,engine.state.generation==generation,
              sourceSpecialTransactions==nil,engine.sourceSpecialContactHook==nil else{owner.retire();return false}
        let hook=NativeSourceSpecialContactHook(claim:{[weak self,weak owner] source,destination,kind in
            guard let self,let owner else{return nil}
            var starCapture:NativeSourceStarOrbitCapture?
            if self.sourceStarHaloScope?.current == true {
                let star=source.archetype == .star && source.variant==nil ? source:destination.archetype == .star && destination.variant==nil ? destination:nil
                if let star,let node=self.nodesByID[star.id],node.sourceGeneration==generation {
                    let captured=node.sourceStarEarlyCapture(in:self)
                    starCapture = .init(tileID:star.id,generation:generation,savedPositions:captured?.stars.count ?? 0,savedSystem:captured?.systemCount ?? 0)
                }
            }
            guard let lease=self.claimSourceMagnetMain(source:source,destination:destination,kind:kind,
                claim:{owner.claim(source:source,destination:destination,kind:kind,generation:generation)}) else{return nil}
            return NativeSourceSpecialContactLease(isCurrent:lease.isCurrent,rejected:lease.rejected,starOrbitCapture:starCapture)
        })
        sourceSpecialTransactions=owner;sourceSpecialTransactionsScope=scope;sourceSpecialContactHook=hook;engine.sourceSpecialContactHook=hook
        sourceDisposalSealingEnabled=true
        return true
    }
    @discardableResult func ensureSourceSpecialTransactions(scope:NativeGameplaySourceContext.Scope)->Bool {
        if let owner=sourceSpecialTransactions {
            return sourceAnimationBindingAdmissionOpen && scope.current && sourceSpecialTransactionsScope === scope &&
                owner.admissionOpen && engine.sourceSpecialContactHook === sourceSpecialContactHook
        }
        return configureSourceSpecialTransactions(scope:scope)
    }
    private func retireSourceSpecialTransactions(){
        let impacts=Array(sourceMagnetImpacts.values);sourceMagnetImpacts=[:];impacts.forEach{$0.dispose()}
        let badges=Array(sourceMagnetMultiplierPresentations.values);sourceMagnetMultiplierPresentations=[:]
        badges.forEach{$0.dispose()}
        retireSourceTntMain()
        retireSourceMagnetMain()
        retireSourceMagnetVerification()
        let owner=sourceSpecialTransactions,hook=sourceSpecialContactHook
        sourceSpecialTransactions=nil;sourceSpecialTransactionsScope=nil;sourceSpecialContactHook=nil
        if let hook,engine.sourceSpecialContactHook === hook {engine.sourceSpecialContactHook=nil}
        owner?.retire()
    }
    /// The genuine app-merge tail must supply this ONLY from its ownsLifecycle
    /// finally. Current Native Magnet atomic conversion has no such caller yet.
    func sourceMagnetHelperFinally(id:String,generation:UInt64,ownsLifecycle:Bool){
        if ownsLifecycle {sourceMagnetBodyEnd(id:id,generation:generation)}
        sourceSpecialTransactions?.magnetHelperFinally(id:id,generation:generation,ownsLifecycle:ownsLifecycle)
    }
    private var sourceMeterCaller:NativeMeterSceneCaller?
    private var sourceMeterQueue:NativeMeterSourceQueueCoreBridge?
    private var sourceMeterLanding:NativeMeterLandingSourceOwner?
    private var sourceMeterQueueEpoch:UInt64=0,sourceMeterLandingEpoch:UInt64=0
    private var sourceMeterTearingDown=false
    private var sourceMeterRenderEpoch:UInt64=0
    private var sourceMeterConfigurationEpoch:UInt64=0
    func configureSourceMeterOpen(scope:NativeGameplaySourceContext.Scope,
        resources:NativeWildMeterDropResources,
        texturesCurrent:@escaping()->Bool,
        selectedAudio:@escaping(NativeTile,NativeMeterSelectedFinaleWarmup<SKTexture>.Capture)->Void,
        carrierAudio:@escaping(Bool,String,UInt64)->(()->Void),
        dividerMask:@escaping()->(()->Void),
        landing:@escaping(NativeDiceNode,NativeWildMeterDropRuntime.Capture)->Void) -> Bool {
        guard sourceAnimationBindingAdmissionOpen,!sourceMeterTearingDown,sourceMeterCaller==nil,scope.current,!engine.sourceMeterSpawnInProgress else{return false}
        let microtasks=sourceMicrotaskInstallation
        let sourceMicrotasksRequired=microtasks != nil
        let resourcePreparation=microtasks.flatMap{_ in resources.sourceSynchronousPreparationReceipt()}
        // Cold I/O/Assets await is NOT a proven Source producer. Only actual
        // retained original textures can make prepare inline in this task.
        if let microtasks {
            guard microtasks.isCurrent,let ready=resourcePreparation,
                  resources.sourceSynchronousPreparationIsCurrent(ready) else{return false}
        }
        sourceDisposalSealingEnabled=true
        sourceMeterConfigurationEpoch &+= 1
        let configuration=sourceMeterConfigurationEpoch,generation=engine.state.generation
        let admitted:()->Bool = {[weak self,scope] in
            guard let self,self.sourceAnimationBindingAdmissionOpen,!self.sourceMeterTearingDown,self.sourceMeterConfigurationEpoch==configuration else{return false}
            if let microtasks {
                guard self.sourceMicrotaskInstallation === microtasks,microtasks.isCurrent,
                      let ready=resourcePreparation,resources.sourceSynchronousPreparationIsCurrent(ready) else{return false}
            }
            let current=scope.current
            return current && self.sourceAnimationBindingAdmissionOpen && !self.sourceMeterTearingDown && self.sourceMeterConfigurationEpoch==configuration
        }
        let owner=NativeMeterSceneCaller(engine:engine,textures:textures,resources:resources,
            timeouts:sourceAppTimeouts,service:scope.service,stage:canvasRoot,
            hooks:.init(current:admitted,
                viewport:{[weak self] in self?.size ?? .zero},renderEpoch:{[weak self] in self?.sourceMeterRenderEpoch ?? 0},
                node:{[weak self] in self?.nodesByID[$0]},install:{[weak self] node,_ in
                    guard let self,admitted() else{return};self.nodesByID[node.tileID]=node;self.captureSourceTutorialObject(node)
                    if let driver=self.sourceOuterTimelineDriver,let geometry=self.geometry {
                        node.installSourceOuterDriver(driver,generation:self.engine.state.generation,geometryScale:geometry.scale)
                        guard admitted() else{return}
                        if let tween=self.sourceDragTweenDriver {node.installSourceDragTweenDriver(tween)}
                        guard admitted() else{return}
                    }
                    if let idle=sourceIdleScope?.specialIdle {guard node.configureSourceSpecialIdle(idle) else{return}}
                    node.onResourceReady={ [weak self] in guard let self,admitted() else{return};self.onRenderingDemand?(!self.suspended)}
                },retire:{[weak self] id,node in
                    guard let self,self.nodesByID[id] === node else{return}
                    self.nodesByID.removeValue(forKey:id);self.sourcePopulation.remove(id)
                    self.refreshSourceIdlePopulation();node.dispose()
                },cellPose:{[weak self] cell in guard let self,let geometry=self.geometry else{return nil}
                    return (geometry.center(row:cell.row,column:cell.column),geometry.scale)
                },enqueue:{[weak self,microtasks] action in
                    guard let self,admitted() else{return}
                    // Captured optional binding: configuration may not switch
                    // from old Raw delivery into a newly installed Source owner.
                    if let captured=microtasks {self.sourceMeterEnqueue(captured,action)}
                    else if !sourceMicrotasksRequired,self.sourceMicrotaskInstallation==nil {self.sourceMeterEnqueue(nil,action)}
                },
                sourceActivity:{[weak self] id,generation in guard admitted() else{return nil};return self?.beginSourceMotion(.wildSpawnDrop,id:id,generation:generation)},
                carrierAudio:carrierAudio,dividerMask:dividerMask,selectedAudio:selectedAudio,
                texturesCurrent:texturesCurrent,
                onImpact:{[weak self] node,capture in guard admitted() else{return};self?.sourceMeterImpact(node,capture,fallback:landing)},onHaptic:{[weak self] in guard admitted() else{return};self?.onHaptic?("medium")},
                idleAdmitted:{[weak self] node in guard let self,admitted(),self.nodesByID[node.tileID] === node else{return}
                    // Original startLandedIdle runs startWildStars at actual
                    // onLanded, after the deferred meter drop, not construction
                    // or the later tutorial fourth-preparation callback.
                    if node.kind=="wild",node.variant==nil,self.sourceStarHaloScope === scope {
                        guard self.beginSourcePlainStarHalo(node,introBounce:true),admitted() else{
                            if admitted(){self.onSourcePresentationFailure?("source_meter_star_landed_attachment_rejected",generation)}
                            return
                        }
                    }
                    // The actual landed receipt has already released deferIdle.
                    // Only the configured shared Source idle owner may admit
                    // typed Bee uploads; partial Raw fixtures retain their owner.
                    if node.kind=="wild",node.variant=="bee",self.sourceIdleScope === scope {
                        guard self.sourceSpecialIdleAdmissionOpen,
                              self.repairSourceWildSkin(tileID:node.tileID,scope:scope,startSourceIdle:{
                                  guard admitted(),self.sourceIdleScope === scope,
                                        node.configureSourceSpecialIdle(scope.specialIdle) else{return false}
                                  return self.prepareSourceBeeIdleFrames(tileID:node.tileID,scope:scope,completion:{[weak self] ready in
                                      guard let self,admitted(),self.nodesByID[node.tileID] === node else{return}
                                      if !ready {self.onSourcePresentationFailure?("source_meter_bee_frames_rejected",generation)}
                                      self.onRenderingDemand?(!self.suspended)
                                  })
                              }),admitted() else {
                            if admitted(){self.onSourcePresentationFailure?("source_meter_bee_landed_attachment_rejected",generation)}
                            return
                        }
                    }
                    if node.kind=="wild-tnt",node.variant==nil,self.sourceIdleScope === scope {
                        guard self.sourceSpecialIdleAdmissionOpen,
                              self.repairSourceWildSkin(tileID:node.tileID,scope:scope,startSourceIdle:{
                                  admitted() && node.configureSourceSpecialIdle(scope.specialIdle)
                              }),admitted() else {
                            if admitted(){self.onSourcePresentationFailure?("source_meter_tnt_fuse_landed_attachment_rejected",generation)}
                            return
                        }
                    }
                    self.sourcePopulation.insert(node.tileID);self.refreshSourceIdlePopulation()
                },ownershipReleased:{[weak self] in guard admitted() else{return};self?.synchronize()},
                fault:{[weak self] reason in
                    guard let self,admitted() else{return}
                    if ["source_meter_placeholder_constructor_rejected","source_meter_wild_constructor_rejected","source_meter_wild_variant_rejected","source_meter_wild_skin_rejected"].contains(reason) {self.onSourcePresentationFailure?(reason,generation)}
                    else{self.onPresentationFailure?(reason)}
                },consume:{[weak self] result,previous in guard admitted() else{return};self?.consume(result,previous:previous)},
                onDropStarted:{[weak self] node in guard let self,admitted() else{return};self.onTutorialSpecialDropStarted?(node)},
                onDropLanded:{[weak self] node in guard let self,admitted() else{return};self.onTutorialSpecialDropLanded?(node)},
                sourceSkin:microtasks == nil ? nil:{[weak self] node in
                    guard let self,admitted(),self.nodesByID[node.tileID] === node else{return false}
                    return self.repairSourceWildSkin(tileID:node.tileID,scope:scope,startSourceIdle:{false},allowPendingMeter:true)
                }),
            random:{[scope] in scope.smokeSession.nextVisualRandom()},wallNow:{CACurrentMediaTime()*1000},
            sourcePromiseBookkeeping:microtasks != nil)
        guard admitted(),engine.state.generation==generation else{owner.dispose();return false}
        for tile in engine.state.tiles {
            if let node=nodesByID[tile.id] {owner.bind(node,cell:tile.cell,generation:generation)}
            guard admitted(),engine.state.generation==generation else{owner.dispose();return false}
        }
        guard admitted(),engine.state.generation==generation,sourceMeterCaller==nil else{owner.dispose();return false}
        sourceMeterCaller=owner
        // Admission remains explicit until canonical queue/save/retry and
        // landing shake/common smoke callers are independently connected.
        engine.stagedMeterDrops=true;engine.stagedMeterOpen=true
        return true
    }
    // PRIVATE capability only: exact Source environment, app microtask and
    // shared save debounce are mandatory owners, never fabricated defaults.
    @discardableResult func configureSourceMeterQueue(scope:NativeGameplaySourceContext.Scope,
        signals:NativeMeterQueueSignals,
        permission:@escaping(Bool)->NativeMeterSourceQueue.Permission,
        continuation:@escaping()->Bool,meterReady:@escaping()->Bool,
        enqueue:@escaping(@escaping @MainActor ()->Void)->Void,
        queueInProgress:@escaping(Bool)->Void,shimmer:@escaping()->Void,
        canonicalSave:@escaping(Int)->Void,
        validateInstallation:(()->Bool)?=nil)->Bool {
        guard sourceAnimationBindingAdmissionOpen,!sourceMeterTearingDown,sourceMeterCaller != nil,
              sourceMeterQueue==nil,scope.current else{return false}
        sourceMeterQueueEpoch &+= 1
        let epoch=sourceMeterQueueEpoch,generation=engine.state.generation
        let current:()->Bool = {[weak self,scope] in
            guard let self,self.sourceAnimationBindingAdmissionOpen,!self.sourceMeterTearingDown,
                  self.sourceMeterQueueEpoch==epoch,self.engine.state.generation==generation else{return false}
            let admitted=scope.current
            return admitted && self.sourceAnimationBindingAdmissionOpen && !self.sourceMeterTearingDown && self.sourceMeterQueueEpoch==epoch && self.engine.state.generation==generation
        }
        let microtasks=sourceMicrotaskInstallation
        let sourceMicrotasksRequired=microtasks != nil
        if let microtasks {guard microtasks.isCurrent else{return false}}
        let owner=NativeMeterSourceQueueCoreBridge(engine:engine,timeouts:sourceAppTimeouts,signalRegistry:signals,
            hooks:.init(current:current,permission:permission,continuation:continuation,meterReady:meterReady,
                enqueue:{[weak self,microtasks] action in
                    guard let self,current() else{return}
                    if let captured=microtasks {self.sourceMeterEnqueue(captured,action)}
                    else if !sourceMicrotasksRequired,self.sourceMicrotaskInstallation==nil {enqueue(action)}
                },sourceQueueInProgress:queueInProgress,shimmer:shimmer,canonicalSave:canonicalSave,
                consume:{[weak self] result,previous in guard current() else{return};self?.consume(result,previous:previous)},
                fault:{[weak self] in guard current() else{return};self?.onPresentationFailure?($0)}))
        guard current(),sourceMeterQueue==nil,owner.activateSourceSignals(),current() else{owner.dispose();return false}
        sourceMeterQueue=owner
        // Bootstrap can now read the genuine installed queue's initial writer.
        // Refuse the exact installation before it can enqueue or claim a reward.
        let validated=validateInstallation?() ?? true
        guard validated,current(),sourceMeterQueue === owner else {
            if sourceMeterQueue === owner {sourceMeterQueue=nil;sourceMeterQueueEpoch &+= 1}
            owner.dispose();return false
        }
        deliverSourceMeterGuardReleaseIfReady(scope:scope)
        return current() && sourceMeterQueue === owner
    }
    /// A genuine guard-release request survives an unavailable migration queue.
    /// It is not a queue-in-progress observation or permission to spawn/save.
    private struct SourceMeterGuardReleaseRequest:Equatable {
        let id=UUID(),generation:UInt64,scope:ObjectIdentifier
    }
    private var sourceMeterGuardReleasePending:SourceMeterGuardReleaseRequest?
    private(set) var sourceMeterGuardReleaseRequestCount=0
    var sourceMeterGuardReleasePendingGeneration:UInt64? {sourceMeterGuardReleasePending?.generation}
    private func requestSourceMeterQueueAfterGuardRelease(scope:NativeGameplaySourceContext.Scope,generation:UInt64) {
        guard sourceAnimationBindingAdmissionOpen,!sourceMeterTearingDown,scope.current,
              engine.state.generation==generation else{return}
        sourceMeterGuardReleaseRequestCount+=1
        sourceMeterGuardReleasePending=SourceMeterGuardReleaseRequest(generation:generation,scope:ObjectIdentifier(scope))
        deliverSourceMeterGuardReleaseIfReady(scope:scope)
    }
    private func deliverSourceMeterGuardReleaseIfReady(scope:NativeGameplaySourceContext.Scope) {
        guard sourceAnimationBindingAdmissionOpen,!sourceMeterTearingDown,scope.current,
              let pending=sourceMeterGuardReleasePending,pending.generation==engine.state.generation,
              pending.scope==ObjectIdentifier(scope),let queue=sourceMeterQueue,
              queue.captureSourceQueueSignals()?.generation==pending.generation,
              sourceAnimationBindingAdmissionOpen,!sourceMeterTearingDown,scope.current,
              sourceMeterQueue === queue,sourceMeterGuardReleasePending==pending,
              engine.state.generation==pending.generation else{return}
        sourceMeterGuardReleasePending=nil // remove before external request/reentry
        queue.guardReleased()
    }
    func captureSourceMeterQueueSignals()->NativeMeterQueueSignals.Snapshot? {
        guard sourceAnimationBindingAdmissionOpen,!sourceMeterTearingDown,
              let queue=sourceMeterQueue,let value=queue.captureSourceQueueSignals(),
              sourceAnimationBindingAdmissionOpen,sourceMeterQueue === queue,
              value.generation==engine.state.generation else{return nil}
        return value
    }
    func beginSourceMeterDividerMask()->(()->Void)? {
        guard sourceAnimationBindingAdmissionOpen,!sourceMeterTearingDown,sourceMeterCaller != nil else{return nil}
        return roundIndicator.beginSourceBackpackDividerMask()
    }
    @discardableResult func configureSourceMeterLanding(scope:NativeGameplaySourceContext.Scope,
        sound:@escaping()->Void)->Bool {
        guard sourceAnimationBindingAdmissionOpen,!sourceMeterTearingDown,sourceMeterCaller != nil,
              sourceMeterLanding==nil,scope.current else{return false}
        sourceMeterLandingEpoch &+= 1
        let epoch=sourceMeterLandingEpoch,generation=engine.state.generation
        let current:()->Bool = {[weak self,scope] in
            guard let self,self.sourceAnimationBindingAdmissionOpen,!self.sourceMeterTearingDown,
                  self.sourceMeterLandingEpoch==epoch,self.engine.state.generation==generation else{return false}
            let admitted=scope.current
            return admitted && self.sourceAnimationBindingAdmissionOpen && !self.sourceMeterTearingDown && self.sourceMeterLandingEpoch==epoch && self.engine.state.generation==generation
        }
        let owner=NativeMeterLandingSourceOwner(service:scope.service,renderer:scope.smoke,session:scope.smokeSession,
            hooks:.init(current:current,impactCurrent:{[weak self] capture in
                guard current() else{return false};return self?.sourceMeterCaller?.landingOrigin(capture) != nil
            },readShake:{[weak self] in
                guard let self else{return .init(canvas:[0,0],indicator:[0,0],decor:[0,0])}
                let pose=self.boardShake
                return .init(canvas:[Double(pose.canvas.x),Double(pose.canvas.y)],indicator:[Double(pose.indicator.x),Double(pose.indicator.y)],decor:[Double(pose.bottomDecor.x),Double(pose.bottomDecor.y)])
            },paintShake:{[weak self] pose in
                guard let self,current() else{return}
                self.applySourceMeterShake(pose)
            },sound:sound,reduced:{[weak self] in self?.sourceFrames.reducedFx ?? false},
                monotonicMilliseconds:{CACurrentMediaTime()*1000},fault:{[weak self] in guard current() else{return};self?.onPresentationFailure?($0)}))
        guard current(),sourceMeterLanding==nil else{owner.dispose();return false}
        sourceMeterLanding=owner;return true
    }
    private func applySourceMeterShake(_ pose:NativeMeterLandingShakeGraph.Pose) {
        let canvas=CGPoint(x:pose.canvas[0],y:pose.canvas[1]),indicator=CGPoint(x:pose.indicator[0],y:pose.indicator[1]),decor=CGPoint(x:pose.decor[0],y:pose.decor[1])
        boardShake = .init(canvas:canvas,indicator:indicator,bottomDecor:decor)
        canvasRoot.position=CGPoint(x:canvas.x,y:-canvas.y)
        sourceTutorialMeterHUD?.setCanvasShakeOffset(canvasRoot.position)
        let base=NativeGameplayChromePlan.make(viewport:size,safeTop:safeInsets.top).roundCenter
        roundIndicator.position=CGPoint(x:base.x+indicator.x,y:base.y-indicator.y)
        // Internal publication precedes external footer callback. Reentrant C
        // must observe painted pose; retired A has no post-callback writes.
        onJourneyBottomDecorShake?(decor,engine.state.generation)
    }
    private func sourceMeterImpact(_ node:NativeDiceNode,_ capture:NativeWildMeterDropRuntime.Capture,
        fallback:(NativeDiceNode,NativeWildMeterDropRuntime.Capture)->Void) {
        guard let owner=sourceMeterLanding else{fallback(node,capture);return}
        guard sourceAnimationBindingAdmissionOpen,!sourceMeterTearingDown,
              let origin=sourceMeterCaller?.landingOrigin(capture),origin.sourceTile === node else{return}
        _=owner.impact(capture,origin:origin)
    }
    private func retireSourceMeterAuxiliaries() {
        sourceMeterQueueEpoch &+= 1;sourceMeterLandingEpoch &+= 1
        let queue=sourceMeterQueue,landing=sourceMeterLanding
        sourceMeterQueue=nil;sourceMeterLanding=nil // unhook before external cancellation
        sourceMeterGuardReleasePending=nil
        retireSourceMicrotaskBoundaries()
        queue?.dispose();landing?.dispose()
    }
    private func retireSourceMeterOpenBinding() {
        sourceMeterConfigurationEpoch &+= 1
        let old=sourceMeterCaller;sourceMeterCaller=nil
        retireSourceMeterAuxiliaries()
        old?.dispose()
    }

    private var retiringSourceTransports=false
    private var wildScheduledActionIDs=Set<String>()
    private var wildCommandOwners:[String:(SKNode,UInt64)] = [:]
    private var wildSpawnVisuals:[String:(UInt64,UInt64,NativeWildSpawnArrival?,(() -> Void)?)] = [:]
    private var wildBonusVisuals:[String:(UInt64,UInt64)] = [:]
    private var directAbsorb:(NativeDirectWildMovePlan,SKNode,UInt64)?
    private var wildSourceResolution:(id:String,generation:UInt64)?
    private var directFinalReceipt:(String,UInt64,UInt64)?
    private var directPresentationID:String?
    private var directPresentationVariant:String?
    private var specialPresentationID: String?
    private var specialPresentationVariant: String?
    private var candidateSignature: String?
    private(set) var navigationLocked = false
    var isBoardEntryComplete:Bool {!disposed && !sourceDisposalInProgress && !entryInProgress && inputAdmitted}
    private var preparedEntryGeneration:UInt64?
    private var inputAdmitted = false
    var onFirstBoardFrame:(()->Void)?
    var onEndgameHintEvaluation:((NativeResolution)->Void)?
    var onEndgameHintInteraction:(()->Void)?
    private var firstBoardFrameCount=0
    private var hudDropPaints:Int?
    private var entryInProgress = false
    private var entryOwners = 0
    private var hudEntryReveal=NativeHUDEntryReveal()
    private var hudEntryReceipt:NativeHUDEntryReveal.Receipt?
    var roundChromeReceipt:(offset:CGFloat,alpha:CGFloat,hidden:Bool,animating:Bool) {roundIndicator.presentationReceipt}
    var keepsHUDVisibleOnEntry=false
    var boardChromeReceipt:(offset:CGFloat,alpha:CGFloat,entering:Bool) {(hud.position.y,hud.alpha,hud.action(forKey:"hud-enter") != nil)}
    private(set) var isHUDRevealPending=false
    private var suspended = false
    private var hudFeedbackPausedNodes:[(SKNode,Bool)]=[]
    private var hudFeedbackPausedActions:[(SKAction,CGFloat)]=[]
    private var disposed = false
    // Default Raw lifetime remains unchanged. Source bindings opt into an
    // entry seal before ANY captured external cleanup callback can reenter.
    var sourceDisposalSealingEnabled = false
    private var sourceDisposalInProgress = false
    private var sourceDisposalGeneration:UInt64?
    private var sourcePresentationFailureGeneration:UInt64?
    var sourceAnimationBindingAdmissionOpen:Bool {
        !disposed && !sourceDisposalInProgress && !sourceOuterTearingDown && sourcePresentationFailureGeneration != engine.state.generation
    }
    @discardableResult func sealSourcePresentationFailure(generation:UInt64)->Bool {
        guard !disposed,engine.state.generation==generation,sourcePresentationFailureGeneration != generation else{return false}
        inputAdmitted=false;navigationLocked=true
        engine.setInputLock("source-presentation-failure:\(generation)",active:true)
        retireSourceAnimationBindings()
        guard !disposed,engine.state.generation==generation else{return false}
        sourcePresentationFailureGeneration=generation
        return true
    }
    private var exitInProgress = false
    // The exited surface remains owned until a fresh board replaces it. UIKit
    // result mounting may relayout the old SpriteKit view before its next paint.
    private var completedExitGeneration:UInt64?
    private var exitCompletion: ((Bool) -> Void)?
    private var exitOwners = 0

    init(engine: NativeGameplayEngine, resourceRoot: URL, size: CGSize, sourceInitialConstruction:NativeSourceInitialBoardConstruction?=nil) {
        self.sourceInitialConstruction=sourceInitialConstruction
        canvasRoot=sourceInitialConstruction?.canvas ?? SKNode()
        self.engine = engine
        engine.stagedTntActivation = true
        engine.stagedDirectWildMoves = true
        engine.stagedDirectWildAssignments = true
        engine.stagedOrdinaryMoves = true
        engine.stagedOrdinaryAssignments = true
        engine.ordinarySixPresentationAdmitted = {UIFont(name:"Arial-BoldMT",size:33) != nil}
        // Reject an unavailable choreography before RNG/reservation/mutation.
        textures = sourceInitialConstruction?.textures ?? NativeBoardTextures(root: resourceRoot)
        let fonts = JimiV9Artwork(resourceRoot: resourceRoot)
        closeStageFont=fonts.font(size:16)
        fontName = fonts.font(size: 24).fontName
        finaleFontName = fonts.font(size: 24,weight: "ExtraBold").fontName
        roundIndicator = NativeRoundIndicator(font: fonts.font(size: 18,weight: "SemiBold"))
        super.init(size: size)
        scaleMode = .resizeFill; backgroundColor = .clear
        canvasRoot.name="native-gameplay-canvas";addChild(canvasRoot)
        if let sourceInitialConstruction {
            if sourceInitialConstruction.adopt(engine:engine,scene:self) {nodesByID=sourceInitialConstruction.nodes;lastGeneration=engine.state.generation;sourceInitialEntryPending=true}
            else {sourceInitialStartupRejected=true;sourceInitialConstruction.dispose()}
        }
        canvasRoot.addChild(ghosts);canvasRoot.addChild(effects);canvasRoot.addChild(hud);canvasRoot.addChild(hudStarFlights)
        canvasRoot.addChild(dragTrail);dragTrail.zPosition=17999
        dragTrail.onTailChanged = {[weak self] active in
            guard let self else{return}
            if active {
                if self.sourceDragTrailRelease==nil {
                    self.sourceDragTrailRelease=self.beginSourceMotion(.dragTrail,id:"drag-trail",generation:self.engine.state.generation)
                }
            } else {
                let release=self.sourceDragTrailRelease;self.sourceDragTrailRelease=nil;release?()
            }
        }
        hudStarFlights.zPosition = 999999
        hover.fillColor = .clear
        hover.strokeColor = UIColor(red: 138.0/255,green: 110.0/255,blue: 87.0/255,alpha: 0.168)
        // Keep the inset stroke above ordinary faces/HUD, below the separate
        // Star artwork foreground at10001 as well as direct Wild/held dice.
        hover.name = "native-stack-hover"; hover.zPosition = 10000.5; hover.isHidden = true; canvasRoot.addChild(hover)
        hud.name="native-game-hud"
        ghosts.zPosition = -10000; effects.zPosition = 15000; hud.zPosition = 10000
        setupHUD()
        sourceFrames.onTarget={ [weak self] fps in self?.onFrameTarget?(fps);self?.onFrameCadence?(fps) }
        sourceFrames.onBudget={ [weak self] receipt in self?.reducedBoardEffects=receipt.reducedFx }
        sourceFrames.onIdleSuspension={ [weak self] suspended in self?.onSpecialIdleSuspended?(suspended) }
        engine.laserTargetX = { [weak self] tile in self?.geometry.map {Double($0.center(row:tile.cell.row,column:tile.cell.column).x)} ?? .nan }
        engine.specialPresentationAdmitted = { [weak self] archetype,variant in
            guard let self else {return false}
            if archetype == .magnet {return variant != nil || self.directArtworkReady(archetype,variant:nil)}
            if archetype == .star || archetype == .juice {return self.directArtworkReady(archetype,variant:variant)}
            guard archetype == .tnt else {return false}
            guard let variant else {return true}
            return self.authoredTntPresentationReady?(variant) == true
        }
        engine.finalePresentationAdmitted = { [weak self] archetype,variant in
            guard let self else {return false}
            if let variant {return self.authoredFinalePresentationReady?(variant) == true}
            if archetype == .star || archetype == .juice || archetype == .magnet {return self.directArtworkReady(archetype,variant:nil)}
            return true
        }
    }

    private func directArtworkReady(_ archetype:NativeWildArchetype,variant:String?)->Bool {
        if let variant {return authoredFinalePresentationReady?(variant) == true}
        if archetype == .star {return textures.texture("assets/small-star.png") != nil}
        if archetype == .juice {
            let paths=NativeJuiceBubbleMotion.sources+["casa","poklopac","slamka"].map {"assets/shop/juice/\($0).png"}+(1...8).map {"assets/animations/bubble\($0).png"}
            return paths.allSatisfy {textures.texture($0) != nil}
        }
        if archetype == .magnet {return NativeMagnetFinalePresentation.assets.allSatisfy{textures.texture($0) != nil}}
        return false
    }
    func preparePlainMagnetFinaleTextures(){
        guard !disposed else{return}
        for path in NativeMagnetFinalePresentation.assets {textures.prepareSelectedFinaleAsset(.init([path])){_ in}}
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func didMove(to view: SKView) {
        mountGameplayRenderHost(view)
    }

    override func willMove(from view:SKView) {
        retireSourceRendererDragTransport()
        if mountedLifecycleHost === view {mountedLifecycleHost=nil}
        super.willMove(from:view)
    }

    func layout(size: CGSize, insets: UIEdgeInsets, animateEntry: Bool = false) {
        guard !sourceDisposalInProgress else {return }
        guard completedExitGeneration != engine.state.generation else{return}
        if let gen=sourceNoMovesGeneration,gen != engine.state.generation {retireSourceNoMoves()}
        guard !sourceDisposalInProgress else{return}
        guard !disposed else { return }
        guard self.size != size || safeInsets != insets || geometry == nil else { return }
        if exitInProgress || completedExitGeneration == engine.state.generation {
            if frameDiagnosticsEnabled {
                NSLog("[CC_NATIVE_EXIT_RELAYOUT] board=%d generation=%llu oldViewport=%.2fx%.2f newViewport=%.2fx%.2f oldInsets=%.2f,%.2f,%.2f,%.2f newInsets=%.2f,%.2f,%.2f,%.2f",engine.state.board,engine.state.generation,self.size.width,self.size.height,size.width,size.height,safeInsets.top,safeInsets.left,safeInsets.bottom,safeInsets.right,insets.top,insets.left,insets.bottom,insets.right)
            }
            finishExit(completed: false)
        }
        cancelEntry()
        self.size = size; safeInsets = insets
        cancelDrag()
        geometry = nil
        synchronize(animateEntry: animateEntry)
        // A same-route relayout settles the interrupted entrance to canonical
        // geometry. Source load finally resumes deferred idle on that current
        // route; a replacement entrance retains the defer until it completes.
        if !entryInProgress {resumeSourceEntryDeferredIdle()}
    }

    func prepareNextBoardEntry() {
        guard !sourceDisposalInProgress else {return }
        guard !disposed else {return}
        firstBoardFrameCount=0
        cancelEntry();cancelDrag();cancelCandidate();synchronize()
        preparedEntryGeneration=engine.state.generation
        engine.setInputLock("native-board-entry-handoff",active:true)
        inputAdmitted=false;navigationLocked=true
    }

    func releasePreparedBoardEntry(generation:UInt64) {
        guard !sourceDisposalInProgress else {return }
        guard !disposed,preparedEntryGeneration == generation,engine.state.generation == generation else {return}
        preparedEntryGeneration=nil;engine.setInputLock("native-board-entry-handoff",active:false)
        synchronize(animateEntry:true)
        navigationLocked=engine.state.terminal != nil || pendingTerminal != nil
        if !entryInProgress {evaluate()}
    }

    private var gameplayHelpAllowed:Bool { engine.state.mode != .arcade || engine.state.effectiveArcadeVariant != .pureDice }

    private func setupHUD() {
        let brown = UIColor(red: 0.42, green: 0.35, blue: 0.29, alpha: 1)
        for label in [score, noMoves] {
            label.fontName = fontName; label.fontColor = brown
            label.verticalAlignmentMode = .center; hud.addChild(label)
        }
        score.fontSize = 18
        score.horizontalAlignmentMode = .left
        score.fontColor = UIColor(red: 181.0/255,green: 133.0/255,blue: 115.0/255,alpha: 1)
        for label in [comboX,comboNumber] {
            label.fontName = fontName; label.horizontalAlignmentMode = .left; label.verticalAlignmentMode = .center
            label.fontColor = UIColor(red: 231.0/255,green: 116.0/255,blue: 73.0/255,alpha: 1); hud.addChild(label)
        }
        comboX.text = "x"; comboX.fontSize = 14; comboNumber.fontSize = 18
        comboNumber.name = "native-game-combo-value"
        noMoves.fontSize = 42; noMoves.zPosition = 20000; noMoves.isHidden = true
        let close=NativeHUDCloseNode(texture:textures.texture("assets/close-icon.png"),stageFont:closeStageFont)
        closeButton=close;hud.addChild(close)
        close.onTapFinished = { [weak self,weak close] in
            close?.removeAction(forKey:"hud-tap-bounce")
            self?.finishHUDTapFeedback()
        }
        if gameplayHelpAllowed {
            let help = SKSpriteNode(texture: textures.texture(engine.state.mode == .arcade ? "assets/hud/crate - hud.png":"assets/nav/stats-nav.png"))
            help.name = "native-game-help"; let helpDimensions=help.texture?.size() ?? CGSize(width:28,height:28)
            // Shared 34pt HUD icon frame; Arena crate and Journey backpack retain aspect ratio.
            let helpScale=34/max(1,max(helpDimensions.width,helpDimensions.height))
            help.size = CGSize(width:helpDimensions.width*helpScale,height:helpDimensions.height*helpScale); hud.addChild(help)
        }
        scoreArt.texture = textures.texture("assets/hud/score-hud.png")
        scoreArt.name = "native-game-score-art"; hud.addChild(scoreArt)
        comboArt.name = "native-game-combo-art";comboArt.color = .clear; hud.addChild(comboArt)
        comboArtImage.name = "native-game-combo-image";comboArt.addChild(comboArtImage)
        meterBackground.name = "native-game-wild-meter-track"
        meterBackground.fillColor = UIColor(red:234.0/255,green:223.0/255,blue:214.0/255,alpha:1)
        meterBackground.strokeColor = .clear;hud.addChild(meterBackground)
        meter.name = "native-game-wild-meter-fill"
        meter.fillColor = UIColor(red:231.0/255,green:116.0/255,blue:74.0/255,alpha:1)
        meter.strokeColor = .clear; hud.addChild(meter)
        addChild(roundIndicator)
    }

    private func layoutHUD() {
        let chrome = NativeGameplayChromePlan.make(viewport:size,safeTop:safeInsets.top)
        let top = chrome.valueRowY
        closeButton?.layout(valueRowY:top)
        let shift = (size.width*0.05).rounded()
        let spacing: CGFloat = size.width >= 768 ? 110 : 92
        let scoreX = size.width-24-62-spacing-shift
        hud.childNode(withName: "native-game-help")?.position = CGPoint(x: size.width >= 768 ? scoreX-spacing : 118, y: top)
        for icon in [scoreArt,comboArt] {
            let dimensions = (icon === comboArt ? comboArtImage.texture:icon.texture)?.size() ?? CGSize(width: 28,height: 28)
            let scale = 28/max(1,max(dimensions.width,dimensions.height))
            icon.size = CGSize(width: dimensions.width*scale,height: dimensions.height*scale)
        }
        comboArtImage.size=comboArt.size
        scoreArt.position = CGPoint(x: scoreX,y: top)
        score.position = CGPoint(x: scoreX+scoreArt.size.width/2+6,y: top)
        layoutComboValue(top:top)
        scoreHitRect = CGRect(x: scoreX-33,y: top-30,width: 70,height: 60)
        // Combo hit geometry is updated with the number-only balloon layout.
        noMoves.position = CGPoint(x: size.width / 2, y: size.height / 2)
        let rect=chrome.meterRect
        if let owner=sourceTutorialMeterHUD {
            if sourceTutorialMeterRect != rect {
                sourceTutorialMeterRect=rect
                owner.resize(maximum:Double(rect.width),sourceOrigin:.init(x:rect.minX,y:size.height-rect.maxY))
            }
            if sourceTutorialMeterRatio != engine.state.wildMeter {
                sourceTutorialMeterRatio=engine.state.wildMeter
                owner.setProgress(engine.state.wildMeter,animated:true)
            }
            roundIndicator.position=chrome.roundCenter
            return
        }
        meterBackground.path=CGPath(roundedRect:CGRect(origin:.zero,size:rect.size),cornerWidth:5,cornerHeight:5,transform:nil)
        meterBackground.position=rect.origin;meter.position=rect.origin
        let ratio=NativeGameplayChromePlan.visibleMeterRatio(engine.state.wildMeter)
        meter.isHidden=ratio<=0
        meter.path=CGPath(roundedRect:CGRect(x:0,y:0,width:rect.width*ratio,height:rect.height),cornerWidth:5,cornerHeight:5,transform:nil)
        roundIndicator.position=chrome.roundCenter

    }

    private struct SourceHeldOrigin {let tileID:String;let generation:UInt64;let cell:NativeCell;let position:CGPoint;let zPosition:CGFloat}
    private var sourceHeldOrigin:SourceHeldOrigin?
    var sourceOuterTimelineDriver:NativeTileOuterTimelineDriver?
    var sourceDragTweenDriver:NativeDragTweenDriver?
    // PRIVATE opt-in limited to ordinary sub-six. Parent owns the one source
    // service, visual RNG and authoritative feature readiness before model drop.
    var sourceSameNodeStackAbsorbsEnabled=false
    // Independent opt-in full small-stack handoff; no Raw/component defaults change.
    var sourceRegularStackHandoffEnabled=false
    // Independent Core physical-face pairing. Parent installs frozen Core222;
    // defaultfalse preserves the proven component-only Source handoff behavior.
    var sourceStackCoreFaceReceiptsEnabled=false
    private struct SourceFaceDeferredPostcheck {let id:String,generation:UInt64,order:UInt64}
    private var sourceFaceDeferredPostchecks:[String:SourceFaceDeferredPostcheck]=[:]
    private var sourceFaceDeferredPostcheckSequence:UInt64=0
    private var sourceStackFrameService:NativeSourceAnimationClockService?
    private var sourceStackFrameAdmission:(()->Bool)?
    private var sourceStackFeedback:[String:NativeRegularStackFeedbackNodeBridge]=[:]
    var sourceRegularStackFeedbackRootCount:Int {sourceStackFeedback.values.reduce(0){$0+$1.activeRootCount}}
    func configureSourceRegularStackHandoff(service:NativeSourceAnimationClockService,admitted:@escaping()->Bool) {
        guard sourceAnimationBindingAdmissionOpen,service.sourceFrameTransportAdmissionOpen else{return}
        sourceStackFrameService=service;sourceStackFrameAdmission=admitted
        if frameDiagnosticsEnabled {service.enableSchedulingDiagnostics()}
    }
    private func sourceStackFrameReady(_ target:NativeDiceNode,generation:UInt64)->Bool {
        guard sourceAnimationBindingAdmissionOpen,let service=sourceStackFrameService,service.sourceFrameTransportAdmissionOpen,engine.state.generation==generation,target.parent === canvasRoot,nodesByID[target.tileID] === target,target.sourceGeneration==generation,sourceStackFrameAdmission?()==true else{return false}
        return sourceAnimationBindingAdmissionOpen && sourceStackFrameService === service && service.sourceFrameTransportAdmissionOpen && engine.state.generation==generation && target.parent === canvasRoot && nodesByID[target.tileID] === target && target.sourceGeneration==generation && target.sourceContactNodeAlive && target.sourceNumbersSkinsAvailable().contains(.base)
    }
    private func sourceStackDecisionMatches(_ captured:NativeBoardState,source:NativeTile,destination:NativeTile)->Bool {
        guard sourceAnimationBindingAdmissionOpen,engine.stagedOrdinaryMoves,(engine.sourceOrdinaryStackFacesEnabled == sourceStackCoreFaceReceiptsEnabled),engine.state==captured,let sourceNode=nodesByID[source.id],let destinationNode=nodesByID[destination.id],sourceNode.sourceContactNodeAlive,destinationNode.sourceContactNodeAlive,sourceNode.parent === canvasRoot,destinationNode.parent === canvasRoot,sourceNode.sourceGeneration==captured.generation,destinationNode.sourceGeneration==captured.generation,(sourceStackCoreFaceReceiptsEnabled || (!sourceNode.sourceRegularFramePending && !destinationNode.sourceRegularFramePending)) else{return false}
        // Source value is immediate, physical depth is RAF-owned. Do not accept
        // another merge using a precommitted Core depth while its face is pending.
        return sourceNode.value==source.value && destinationNode.value==destination.value && sourceNode.depth==source.stackDepth && destinationNode.depth==destination.stackDepth
    }
    private func retireSourceStackHandoff() {
        retireSourceDragMoves()
        sourceStackFrameService=nil;sourceStackFrameAdmission=nil
        let expired=Array(sourceFaceDeferredPostchecks.values);sourceFaceDeferredPostchecks.removeAll()
        for post in expired where engine.state.generation==post.generation {_=engine.cancelOrdinaryPostcheck(receiptID:post.id,generation:post.generation)}
        let captured=Array(sourceStackFeedback.values);sourceStackFeedback.removeAll()
        for feedback in captured {feedback.dispose()}
        for node in Array(nodesByID.values) {node.retireSourceStackFrames()}
    }
    var sourceContactVisualRandom:(()->Double)?
    private var sourceRegularContactCompanions:NativeRegularContactSceneCompanions?
    func configureSourceRegularContact(_ companions:NativeRegularContactSceneCompanions,admitted:@escaping()->Bool) {
        guard sourceAnimationBindingAdmissionOpen else{return}
        sourceRegularContactCompanions=companions
        sourceContactVisualRandom={ [companions] in companions.nextVisualRandom() }
        sourceStackAbsorbAdmission={ [weak self,weak companions] source,destination in
            guard let self,let companions,admitted(),!self.disposed,!self.sourceOuterTearingDown,self.sourceRegularContactCompanions === companions,let target=self.nodesByID[destination.id],companions.ready(canvas:self.canvasRoot,target:target,generation:self.engine.state.generation) else{return false}
            return self.engine.state.tiles.allSatisfy{tile in tile.id==source.id || tile.id==destination.id || tile.locked || tile.isWild || tile.variant != nil || tile.value<=0 || self.engine.noMovesTileRuntime[tile.id]?.destroyed==true || self.nodesByID[tile.id] != nil}
        }
    }
    var sourceStackAbsorbAdmission:((NativeTile,NativeTile)->Bool)?
    // Full contact callsite companions remain separately admitted: layer-click
    // BEFORE impact, neighbour recoil + source shared smoke AFTER impact. These
    // seams consume the same injected visual draw stream in original order.
    var onSourceStackContactPrefix:((NativeDiceNode,NativeDiceNode,()->Double)->Void)?
    var onSourceStackContactSuffix:((NativeDiceNode,NativeDiceNode,()->Double)->Void)?
    private struct SourceAcceptedStack {
        let plan:NativeOrdinaryMovePlan,node:NativeDiceNode,owner:NativeSourceAcceptedAbsorbOwner,visual:UInt64
    }
    private var sourceAcceptedStacks:[String:SourceAcceptedStack]=[:]
    private var sourceOuterTearingDown=false
    func sourceNativeTileNode(_ tileID:String)->NativeDiceNode? {nodesByID[tileID]}
    /// Physical Source read for save/endgame callers. Never reconstruct c/r
    /// from Core or a tweened position, and never supplies absent marker owners.
    private final class SourcePhysicalObserverEntry {
        weak var node:NativeDiceNode?
        let generation:UInt64,observer:NativeSourceNodeRuntimeObservation
        init(node:NativeDiceNode,generation:UInt64,observer:NativeSourceNodeRuntimeObservation) {
            self.node=node;self.generation=generation;self.observer=observer
        }
    }
    private var sourcePhysicalObservers:[String:SourcePhysicalObserverEntry]=[:]
    struct SourcePhysicalReadDiagnostics {
        var boardCaptures=0,boardRevalidations=0,tileObservationReads=0,observerCreations=0
    }
    private(set) var sourcePhysicalReadDiagnostics=SourcePhysicalReadDiagnostics()
    func resetSourcePhysicalReadDiagnostics(){sourcePhysicalReadDiagnostics = .init()}
#if DEBUG
    private(set) var sourcePhysicalObserverCreationCount=0
    var sourcePhysicalObserverCacheCount:Int {sourcePhysicalObservers.count}
#endif
    private func retireSourcePhysicalObservers(){
        for entry in sourcePhysicalObservers.values {entry.observer.retire()}
        sourcePhysicalObservers.removeAll()
    }
    func sourcePhysicalTileObservation(_ model:NativeTile)->NativeSourcePhysicalTileObservation? {
        if frameDiagnosticsEnabled {sourcePhysicalReadDiagnostics.tileObservationReads+=1}
        guard sourceAnimationBindingAdmissionOpen,let node=nodesByID[model.id],
              model.id==node.tileID,node.sourceGridCell != nil else{return nil}
        let generation=engine.state.generation
        if let entry=sourcePhysicalObservers[model.id],entry.node === node,entry.generation==generation {
            return entry.observer.read(model)
        }
        sourcePhysicalObservers.removeValue(forKey:model.id)?.observer.retire()
        let observer=NativeSourceNodeRuntimeObservation(node:node,canvas:canvasRoot,generation:generation,
            lookup:{[weak self] in self?.nodesByID[$0]},current:{[weak self] in
                guard let self else{return false}
                return self.sourceAnimationBindingAdmissionOpen && self.engine.state.generation==generation
            })
        sourcePhysicalObservers[model.id]=SourcePhysicalObserverEntry(node:node,generation:generation,observer:observer)
        if frameDiagnosticsEnabled {sourcePhysicalReadDiagnostics.observerCreations+=1}
#if DEBUG
        sourcePhysicalObserverCreationCount+=1
#endif
        return observer.read(model)
    }
    /// Constructor-owned absence and actual captured cleanup/pull/drop writers.
    /// Canonical fields are deliberately not used to fill a missing owner.
    func captureSourceGameplayTileMarkers(_ id:String)->NativeSourceTileOwnerMarkers? {
        let generation=engine.state.generation
        guard sourceAnimationBindingAdmissionOpen,let node=nodesByID[id],node.parent === canvasRoot,
              node.sourceGeneration==generation,let absent=node.captureSourceConstructorMarkerAbsence() else{return nil}
        let drop:NativeWildMeterDropRuntime.SourceTileMarkers
        if node.isSpecial || node.sourceResidualWildPresence {
            guard let actual=sourceWildDropTileMarkers(node) else{return nil};drop=actual
        } else {drop = .init(dropping:false,handoffLocked:false)}
        guard sourceAnimationBindingAdmissionOpen,engine.state.generation==generation,
              nodesByID[id] === node,node.parent === canvasRoot,node.sourceGeneration==generation,
              node.captureSourceConstructorMarkerAbsence() != nil else{return nil}
        let cleanup=node.sourceMergeSixCleanupToken != nil,pull=node.sourceMagnetPullProtected
        return .init(destroyed:!node.sourceContactNodeAlive,beingRemoved:absent.beingRemoved,
            cleanupQueued:absent.cleanupQueued,cleanupClaim:cleanup,magnetAffected:pull,
            pendingRemoval:absent.pendingRemoval,resolutionOwned:cleanup || pull,
            mergeSixCleanupOwned:cleanup,nonFinalMergeSix:node.sourceNonFinalMergeSix,
            wildDropping:drop.dropping,wildHandoff:drop.handoffLocked,
            ccSpawnAnimating:absent.ccSpawnAnimating,spawnAnimating:absent.spawnAnimating,
            isSpawning:absent.isSpawning,spawnTweenActive:absent.spawnTweenActive,
            explicitFinal:node.sourceMergeSixLastMerge || node.sourceMergeSixFinalAllowedByResolver)
    }
    private var sourceRegularIdleOwner:NativeSourceRegularIdleOwner?
    private weak var sourceRegularIdleScope:NativeGameplaySourceContext.Scope?
    private var sourceRegularIdleGeneration:UInt64?
    private var sourceRegularIdleHidden=false
    private var sourceRegularIdleCaptures:[UUID:(NativeDiceNode,NativeTileOuterReceipt)]=[:]
    var sourceRegularIdleAdmissionOpen:Bool {
        sourceAnimationBindingAdmissionOpen && sourceRegularIdleScope?.current==true &&
        sourceRegularIdleGeneration==engine.state.generation && sourceRegularIdleOwner != nil
    }
    @discardableResult func configureSourceRegularIdle(scope:NativeGameplaySourceContext.Scope)->Bool {
        guard sourceAnimationBindingAdmissionOpen,!exitInProgress,scope.current,sourceRegularIdleOwner==nil,
              sourceMicrotaskBoundariesInstalled,sourceAppTimeouts.sourceMicrotaskTasks === scope.sourceMicrotaskTasks,
              let physical=captureSourcePhysicalBoard(),physical.isStillCurrent() else{return false}
        let generation=engine.state.generation
        sourceRegularIdleScope=scope;sourceRegularIdleGeneration=generation
        let current:()->Bool = {[weak self,weak scope] in
            guard let self,let scope else{return false}
            return self.sourceRegularIdleAdmissionOpen && self.sourceRegularIdleScope === scope
        }
        let owner=NativeSourceRegularIdleOwner(hooks:.init(current:current,
            date:{[weak scope] in scope?.captureSourceDateMilliseconds() ?? .nan},
            random:{[weak scope] in scope?.mathRandom.next() ?? .nan},
            available:{[weak self] in self?.sourceRegularIdleAvailableIDs() ?? []},
            dragActive:{[weak self] in self?.draggedID != nil},
            begin:{[weak self] cycle in self?.beginSourceRegularIdle(cycle)},
            stopAnimations:{[weak self] in self?.stopSourceRegularIdleAnimations()},
            schedule:{[weak self] ms,callback in
                guard let self,current() else{return {}}
                let receipt=self.sourceAppTimeouts.schedule(sourceID:"source-regular-idle-wake",generation:generation,
                    delayMilliseconds:ms,elapsed:callback)
                return {[weak self] in _=self?.sourceAppTimeouts.cancel(receipt)}
            }))
        sourceRegularIdleOwner=owner
        owner.setHidden(sourceRegularIdleHidden)
        guard current(),owner.start(),current() else{if sourceRegularIdleOwner === owner {retireSourceRegularIdle()};return false}
        return true
    }
    private func sourceRegularIdleAvailableIDs()->[String] {
        guard sourceRegularIdleAdmissionOpen,let board=captureSourcePhysicalBoard(),
              let ids=captureSourceRegularIdleEligibleIDs(board),sourceRegularIdleAdmissionOpen,
              board.isStillCurrent() else{return []}
        return ids
    }
    /// Ordinary marker reads use synchronous constructor/node fields. Special
    /// marker reads can invoke captured meter/scope owners, so fence the whole
    /// board immediately after each of those callbacks as well as both batch
    /// boundaries. The injected reader is always treated as external.
    func captureSourceRegularIdleEligibleIDs(_ board:SourcePhysicalBoardCapture,
        externalMarkerReader:((String)->NativeSourceTileOwnerMarkers?)?=nil)->[String]? {
        guard board.isStillCurrent() else{return nil}
        var ids:[String]=[]
        for model in board.canonicalState.tiles {
            guard sourceAnimationBindingAdmissionOpen,engine.state.generation==board.canonicalState.generation,
                  let node=nodesByID[model.id],node.sourceGeneration==board.canonicalState.generation,
                  node.parent === canvasRoot,let physical=board.tiles[model.id] else{return nil}
            let readsExternalOwner=externalMarkerReader != nil || node.isSpecial || node.sourceResidualWildPresence
            let markers:NativeSourceTileOwnerMarkers?
            if let externalMarkerReader {markers=externalMarkerReader(model.id)}
            else {markers=captureSourceGameplayTileMarkers(model.id)}
            if readsExternalOwner {guard board.isStillCurrent() else{return nil}}
            guard let markers,sourceAnimationBindingAdmissionOpen,
                  engine.state.generation==board.canonicalState.generation,
                  nodesByID[model.id] === node,node.parent === canvasRoot,
                  node.sourceGeneration==board.canonicalState.generation else{return nil}
            var eligible=NativeTileOuterEligibility()
            eligible.destroyed=markers.destroyed;eligible.visible=physical.tile.visible
            eligible.locked=physical.tile.locked;eligible.value=physical.tile.value
            eligible.variant=physical.tile.variant;eligible.eventMode=physical.eventMode
            eligible.gridMembership=node.parent === canvasRoot && node.sourceGridCell==model.cell && draggedID != model.id ? .sameIdentity:.missingOrDifferentIdentity
            eligible.idleTimelinePresent=node.sourceIdleTimelinePresent;eligible.activeIdle=node.sourceActiveIdle
            eligible.owners=node.sourceOuterOwners
            eligible.owners.pendingRemoval=markers.pendingRemoval
            eligible.owners.beingRemoved=markers.beingRemoved;eligible.owners.cleanupQueued=markers.cleanupQueued
            eligible.owners.wildSpawnDropping=markers.wildDropping
            eligible.owners.isBeingSpawned=node.sourceIsBeingSpawned || markers.ccSpawnAnimating || markers.spawnAnimating || markers.isSpawning || markers.spawnTweenActive
            eligible.owners.skipIdleScaleReset=node.sourceSkipIdleScaleReset
            if eligible.canBeginOuterIdle {ids.append(model.id)}
        }
        return board.isStillCurrent() ? ids:nil
    }
    private func beginSourceRegularIdle(_ cycle:NativeRegularIdleSchedule.Cycle) {
        guard sourceRegularIdleAdmissionOpen,sourceRegularIdleAvailableIDs().contains(cycle.tileID),
              let node=nodesByID[cycle.tileID],let scope=sourceRegularIdleScope else{return}
        let generation=engine.state.generation,id=UUID()
        guard let release=beginSourceMotion(.regularIdleBounce,id:id.uuidString,generation:generation) else{return}
        guard sourceRegularIdleAdmissionOpen,sourceRegularIdleScope === scope,scope.current,
              engine.state.generation==generation,nodesByID[cycle.tileID] === node,node.parent === canvasRoot else{release();return}
        let admitted=node.beginSourceIdle(cycle.motion,release:release,onSmoke:{[weak self,weak node,weak scope] in
            guard let self,let node,let scope,self.sourceRegularIdleAdmissionOpen,
                  self.sourceRegularIdleScope === scope,self.nodesByID[node.tileID] === node,
                  node.parent === self.canvasRoot,node.sourceGeneration==generation,!node.isSpecial else{return}
            _=scope.smoke.admit(recipe:NativeSharedSmokeRecipes.regularIdle(tileDepth:Double(node.depth)),
                canvas:self.canvasRoot,tile:node,generation:generation,origin:node.position,
                renderScale:node.sourceGeometryScale,monotonicMilliseconds:CACurrentMediaTime()*1000,
                reduced:self.sourceFrames.reducedFx,current:{[weak self,weak node] gen in
                    guard let self,let node else{return false}
                    return self.sourceRegularIdleAdmissionOpen && gen==generation && self.nodesByID[node.tileID] === node && node.parent === self.canvasRoot
                },acquireActivity:{_ in nil}) // Source idle smoke has no extra authored activity lease.
        },onFinished:{[weak self] in self?.sourceRegularIdleCaptures.removeValue(forKey:id)})
        guard admitted,sourceRegularIdleAdmissionOpen,nodesByID[node.tileID] === node,
              let receipt=node.sourceOuterReceipt,receipt.kind == .idle else{release();return}
        sourceRegularIdleCaptures[id]=(node,receipt)
    }
    private func stopSourceRegularIdleAnimations(){
        let captured=Array(sourceRegularIdleCaptures.values);sourceRegularIdleCaptures.removeAll()
        for (node,receipt) in captured {node.interruptSourceOuter(receipt:receipt)}
    }
    func stopSourceRegularIdle(){sourceRegularIdleOwner?.stop()}
    @discardableResult func restartSourceRegularIdle()->Bool {
        guard sourceRegularIdleAdmissionOpen,!exitInProgress,tutorialSpecialBarFocus.isEmpty else{return false}
        return sourceRegularIdleOwner?.start()==true
    }
    func setSourceRegularIdleForeground(_ value:Bool){sourceRegularIdleHidden = !value;sourceRegularIdleOwner?.setHidden(!value)}
    private func retireSourceRegularIdle(){
        let old=sourceRegularIdleOwner;sourceRegularIdleOwner=nil;sourceRegularIdleScope=nil;sourceRegularIdleGeneration=nil
        old?.dispose();stopSourceRegularIdleAnimations()
    }
    private weak var sourceRuntimeObservationScope:NativeGameplaySourceContext.Scope?
    private var sourceRuntimeObservation:NativeSourceGameplayRuntimeProducer?
    private var sourceRuntimeMarkerEndpoints:[NativeGameplaySourceRegistrySession.EndpointLease]=[]
    private var sourceRuntimeObservationEpoch:UInt64=0
    /// Actual application observation is partial until genuine global/terminal
    /// owners are mounted. A missing owner remains typed missing, never false.
    @discardableResult func configureSourceGameplayRuntimeObservation(scope:NativeGameplaySourceContext.Scope)->Bool {
        guard sourceAnimationBindingAdmissionOpen,scope.current,sourceRuntimeObservation==nil,
              let board=captureSourcePhysicalBoard(),board.isStillCurrent(),
              board.canonicalState.tiles.allSatisfy({captureSourceGameplayTileMarkers($0.id) != nil}) else{return false}
        let generation=engine.state.generation,epoch=sourceRuntimeObservationEpoch
        guard board.isStillCurrent(),scope.current,
              let life=scope.registries.mountCapturedEndpoint(.sourceTileLifecycle) else{return false}
        guard board.isStillCurrent(),scope.current,
              let spawn=scope.registries.mountCapturedEndpoint(.sourceSpawnMarkers) else {
            _=scope.registries.unmountCapturedEndpoint(life);return false
        }
        guard sourceAnimationBindingAdmissionOpen,scope.current,board.isStillCurrent(),
              sourceRuntimeObservationEpoch==epoch,sourceRuntimeObservation==nil else {
            _=scope.registries.unmountCapturedEndpoint(spawn);_=scope.registries.unmountCapturedEndpoint(life);return false
        }
        sourceRuntimeObservationScope=scope;sourceRuntimeMarkerEndpoints=[life,spawn]
        let current:()->Bool = {[weak self,weak scope] in
            guard let self,let scope else{return false}
            return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceRuntimeObservationScope === scope &&
                self.sourceRuntimeObservationEpoch==epoch && self.engine.state.generation==generation
        }
        sourceRuntimeObservation=NativeSourceGameplayRuntimeProducer(engine:engine,scope:scope.registries,hooks:.init(
            physicalRoster:{[weak self] in guard current(),let board=self?.captureSourcePhysicalBoard(),board.isStillCurrent(),current() else{return nil};return board.canonicalState.tiles.map(\.id)},
            physicalTile:{[weak self] model in guard current() else{return nil};let value=self?.sourcePhysicalTileObservation(model);return current() ? value:nil},
            tileMarkers:{[weak self] id in guard current() else{return nil};let value=self?.captureSourceGameplayTileMarkers(id);return current() ? value:nil},
            globalOwners:{[weak self] in
                guard current(),let self else{return nil}
                let policy=NativeSourceBoardWildPolicy(board:self.engine.state.board)
                let queue=self.captureSourceMeterQueueSignals()
                guard current() else{return nil}
                let drop=self.captureSourceWildDropActiveCount()
                guard current() else{return nil}
                let pull=self.captureSourceMagnetPullInProgress(scope:scope)
                guard current() else{return nil}
                let transition=scope.captureSourceBoardTransitionActive()
                guard current() else{return nil}
                let six=self.captureSourceMergeSixSpawnInProgress()
                guard current() else{return nil}
                // Actual active token proves true; missing ordinary/Special
                // acquisition coverage keeps its idle observation unknown.
                return .init(boardMeterEnabled:policy.meterEnabled,boardSpawnEnabled:policy.spawnEnabled,
                    queueInProgress:queue?.inProgress,boardTransitionActive:transition,
                    mergeSixSpawnInProgress:six,wildMagnetPullInProgress:pull,wildDropInProgress:drop.map{$0>0})
            }))
        return current()
    }
    func captureSourceGameplayRuntime(isWild:Bool)->NativeSourceGameplayRuntimeProducer.Snapshot? {
        guard sourceAnimationBindingAdmissionOpen,sourceRuntimeObservationScope?.current==true,
              let producer=sourceRuntimeObservation,let physical=captureSourcePhysicalBoard(),
              physical.isStillCurrent() else{return nil}
        let value=producer.capture(isWild:isWild)
        return physical.isStillCurrent() && sourceRuntimeObservation === producer && sourceRuntimeObservationScope?.current==true ? value:nil
    }
    /// Save borrows the physical roster directly and keeps every transient
    /// registry read lazy; queue/global Date snapshots are not save admission.
    func captureSourceCanonicalSaveState(guardFields:NativeSourceCanonicalSaveGuard)->NativeSourceCanonicalSaveCapture? {
        guard let scope=sourceRuntimeObservationScope,scope.current,
              let physical=captureSourcePhysicalBoard(),physical.isStillCurrent() else{return nil}
        let generation=physical.canonicalState.generation
        let current:()->Bool = {[weak self,weak scope] in
            guard let self,let scope else{return false}
            return self.sourceAnimationBindingAdmissionOpen && scope.current &&
                self.sourceRuntimeObservationScope === scope && self.engine.state.generation==generation
        }
        let transient=NativeSourceCanonicalSaveTransient.Hooks(current:current,
            busyEnding:{[weak self] in guard current(),let self else{return nil};return self.engine.flags.busyEnding},
            spawningOrPulling:{[weak self,weak scope] in
                guard current(),let self,let scope,
                      let queue=self.captureSourceMeterQueueSignals(),
                      let six=self.captureSourceMergeSixSpawnInProgress(),
                      let pull=self.captureSourceMagnetPullInProgress(scope:scope),current() else{return nil}
                return queue.inProgress || six || pull
            },specialActive:{[weak scope] in guard current() else{return nil};return scope?.registries.specialActiveForSave()},
            regularHandoff:{[weak self] in
                guard current(),let self,self.sourceEndgameMutationLedgerAdmissionOpen else{return nil}
                return self.sourceGameplay.keys.contains{$0.kind == .regularMergeHandoff}
            },cleanupClaim:{[weak self,weak scope] in
                guard current(),let self,let scope,self.sourceSixScope === scope,
                      let board=self.captureSourcePhysicalBoard() else{return nil}
                return self.scanSourceSynchronousPhysicalBoard(board,current:current,readsExternalOwner:{_ in false},read:{_,node in
                    scope.mergeSixDestinationCleanup.hasClaim(node)
                })
            },livingDrag:{[weak self] in
                guard current(),let self,self.sourceOuterTimelineDriver === scope.timeline,
                      self.sourceDragTweenDriver === scope.tween else{return nil}
                guard let id=self.draggedID else{return false}
                guard let node=self.nodesByID[id] else{return nil}
                return node.sourceContactNodeAlive
            },foregroundDrop:{[weak self] in
                guard current(),let count=self?.captureSourceWildDropActiveCount(),current() else{return nil}
                return count>0
            },livingTileMarker:{[weak self] in
                guard current(),let self,let board=self.captureSourcePhysicalBoard() else{return nil}
                return self.scanSourceSynchronousPhysicalBoard(board,current:current,readsExternalOwner:{$0.isSpecial || $0.sourceResidualWildPresence},read:{model,_ in
                    guard let m=self.captureSourceSaveTileMarkers(id:model.id) else{return nil}
                    return !m.destroyed && (m.wildSpawnDropping || m.wildSpawnHandoffLock || m.isBeingSpawned || m.pendingRemoval || m.beingRemoved || m.cleanupQueued || m.ccSpawnAnimating || m.spawnAnimating || m.isSpawning || m.hasSpawnTween)
                })
            })
        return NativeSourceCanonicalSaveCapture.physical(canonicalState:physical.canonicalState,
            physicalState:physical.observedState,eventModes:physical.tiles.mapValues(\.eventMode),
            guardFields:guardFields,transient:transient,
            missingOwners:scope.registries.missing([.specialContactCommitRelease,.sourceTileLifecycle,.sourceSpawnMarkers]),
            physicalStillMatches:physical.isStillCurrent)
    }
    func requestSourceMeterQueueAfterSaveMounted(){
        guard sourceAnimationBindingAdmissionOpen,sourceCanonicalSaveBinding?.current==true else{return}
        sourceMeterQueue?.guardReleased()
    }
    /// Ordered getNoMovesCommitBlockReason authority. Physical observations
    /// do not call the global producer because that would eagerly query Date
    /// and Special ahead of Source's forced current checker.
    func makeSourceNoMovesRuntimeAuthority(scope:NativeGameplaySourceContext.Scope)->NativeSourceNoMovesRuntimeAuthority? {
        let generation=engine.state.generation
        let current:()->Bool = {[weak self,weak scope] in
            guard let self,let scope else{return false}
            return self.sourceAnimationBindingAdmissionOpen && scope.current &&
                self.sourceRuntimeObservationScope === scope && self.sourceSixScope === scope &&
                self.sourceDirectScope === scope && self.sourceMagnetPullScope === scope &&
                self.sourceEndgameMutationLedgerAdmissionOpen && self.engine.state.generation==generation &&
                scope.registries.missing([.sourceTileLifecycle,.sourceSpawnMarkers,.specialContactCommitRelease,.magnetGuardBeginFinally]).isEmpty
        }
        guard current() else{return nil}
        return NativeSourceNoMovesRuntimeAuthority(isCurrent:current,capture:{[weak self,weak scope] in
            guard let self,let scope,current() else{return nil}
            let hooks=NativeSourceNoMovesRuntimeAuthority.OrderedCaptureHooks(current:current,
                livingDrag:{[weak self] in
                    guard current(),let self else{return nil}
                    guard let id=self.draggedID else{return false}
                    guard let node=self.nodesByID[id] else{return nil};return node.sourceContactNodeAlive
                },endgameGuard:{[weak scope] in
                    guard current(),let value=scope?.registries.snapshot(isWild:false),current() else{return nil}
                    return value.endgameGuard.active
                },physical:{[weak self] in
                    guard current(),let self,let board=self.captureSourcePhysicalBoard(),board.isStillCurrent(),
                          let nonfinal=self.captureSourceNonFinalMergeSixGuardActive() else{return nil}
                    var state=board.observedState,runtime:[String:NativeNoMovesTileRuntime]=[:],index=0
                    guard self.scanSourceSynchronousPhysicalBoard(board,current:current,readsExternalOwner:{$0.isSpecial || $0.sourceResidualWildPresence},read:{model,_ in
                        let id=model.id
                        guard index<state.tiles.count,state.tiles[index].id==id,
                              let tile=board.tiles[id],let marker=self.captureSourceGameplayTileMarkers(id) else{return nil}
                        state.tiles[index].pendingRemoval=marker.pendingRemoval
                        state.tiles[index].magnetOwned=marker.magnetAffected
                        state.tiles[index].resolutionOwned=marker.resolutionOwned
                        state.tiles[index].merge6CleanupOwned=marker.mergeSixCleanupOwned
                        state.tiles[index].nonFinalMerge6=marker.nonFinalMergeSix
                        state.tiles[index].transientSpawn=marker.ccSpawnAnimating
                        runtime[id]=marker.noMovesRuntime(eventMode:tile.eventMode)
                        index+=1;return false
                    }) != nil else{return nil}
                    guard current(),let receipt=NativeSourceNoMovesRuntimeSnapshot.PaintedStateReceipt(
                        canonicalState:board.canonicalState,paintedState:state) else{return nil}
                    return .init(state:state,tiles:runtime,nonFinalMergeSixGuardActive:nonfinal,paintedStateReceipt:receipt)
                },fresh:{physical,guardActive in
                    guard current() else{return nil}
                    return NativeSourceEndgameChecker.check(state:physical.state,runtime:physical.tiles,
                        endgameGuard:guardActive,nonFinalGuard:physical.nonFinalMergeSixGuardActive)
                },wildContinuation:{[weak self] in
                    guard current(),let self,let queue=self.captureSourceMeterQueueSignals(),
                          let drops=self.captureSourceWildDropActiveCount(),current() else{return nil}
                    return queue.inProgress || queue.retryPending || drops>0 ||
                        (self.engine.state.wildMeter.isFinite && self.engine.state.wildMeter>=1-0.000001)
                },spawningOrPulling:{[weak self,weak scope] in
                    guard current(),let self,let scope,let queue=self.captureSourceMeterQueueSignals(),
                          let six=self.captureSourceMergeSixSpawnInProgress(),
                          let pull=self.captureSourceMagnetPullInProgress(scope:scope),current() else{return nil}
                    return queue.inProgress || six || pull
                },specialActive:{[weak scope] in guard current() else{return nil};return scope?.registries.specialActiveForSave()},
                regularHandoff:{[weak self] in guard current(),let self else{return nil};return self.sourceGameplay.keys.contains{$0.kind == .regularMergeHandoff}},
                capabilities:Set(NativeSourceNoMovesRuntimeSnapshot.Capability.allCases))
            return NativeSourceNoMovesRuntimeAuthority.captureSourceOrdered(hooks)
        })
    }
    private func retireSourceGameplayRuntimeObservation() {
        sourceRuntimeObservationEpoch &+= 1
        let producer=sourceRuntimeObservation;sourceRuntimeObservation=nil
        let scope=sourceRuntimeObservationScope;sourceRuntimeObservationScope=nil
        let endpoints=sourceRuntimeMarkerEndpoints;sourceRuntimeMarkerEndpoints=[]
        producer?.retire()
        if let scope {for endpoint in endpoints {_=scope.registries.unmountCapturedEndpoint(endpoint)}}
    }
    struct SourcePhysicalBoardCapture {
        /// Exact frozen Core identity fences this read, never overwrites it.
        let canonicalState:NativeBoardState
        let observedState:NativeBoardState
        let tiles:[String:NativeSourcePhysicalTileObservation]
        let isStillCurrent:()->Bool
        var paintedStateReceipt:NativeSourceNoMovesRuntimeSnapshot.PaintedStateReceipt? {
            .init(canonicalState:canonicalState,paintedState:observedState)
        }
    }
    /// Synchronous Source roster scan. Ordinary node reads cannot invoke
    /// external owners, so complete physical fences bracket their batch.
    /// Wild marker reads CAN call carrier/current hooks: fence immediately on
    /// both sides and stop before reading another tile if any sibling changed.
    /// A true reader result retains ordered early-return behavior; nil refuses.
    /// No receipt or result is reused across a callback/microtask boundary.
    func scanSourceSynchronousPhysicalBoard(_ board:SourcePhysicalBoardCapture,
        current:()->Bool,readsExternalOwner:(NativeDiceNode)->Bool,
        read:(NativeTile,NativeDiceNode)->Bool?)->Bool? {
        guard current(),board.isStillCurrent(),current() else{return nil}
        let generation=board.canonicalState.generation
        let captured=nodesByID
        for model in board.observedState.tiles {
            guard current(),sourceAnimationBindingAdmissionOpen,engine.state.generation==generation,
                  let node=captured[model.id],nodesByID[model.id] === node,
                  node.parent === canvasRoot,node.sourceGeneration==generation else{return nil}
            let external=readsExternalOwner(node)
            if external {guard current(),board.isStillCurrent(),current() else{return nil}}
            guard let stop=read(model,node),current(),sourceAnimationBindingAdmissionOpen,
                  engine.state.generation==generation,nodesByID[model.id] === node,
                  node.parent === canvasRoot,node.sourceGeneration==generation else{return nil}
            if external {guard board.isStillCurrent(),current() else{return nil}}
            if stop {return board.isStillCurrent() && current() ? true:nil}
        }
        return board.isStillCurrent() && current() ? false:nil
    }
    /// One actual retained-object roster capture for the future save/endgame
    /// adapters. Lifecycle/spawn/global capabilities are deliberately separate.
    private(set) var sourcePhysicalBoardCaptureDiagnostic="not-captured"
    func captureSourcePhysicalBoard()->SourcePhysicalBoardCapture? {
        if frameDiagnosticsEnabled {sourcePhysicalReadDiagnostics.boardCaptures+=1}
        sourcePhysicalBoardCaptureDiagnostic="admission-closed"
        guard sourceAnimationBindingAdmissionOpen else{return nil}
        let canonical=engine.state,captured=nodesByID
        let modelIDs=Set(canonical.tiles.map(\.id)),nodeIDs=Set(captured.keys)
        guard nodeIDs==modelIDs,canonical.tiles.count==captured.count else{
            sourcePhysicalBoardCaptureDiagnostic="roster model-only=\(modelIDs.subtracting(nodeIDs).sorted()) node-only=\(nodeIDs.subtracting(modelIDs).sorted())"
            return nil
        }
        // Bound retained observers to this actual roster. Removed/replaced
        // objects are never kept alive or reused for their successor.
        for id in Array(sourcePhysicalObservers.keys) {
            guard let entry=sourcePhysicalObservers[id],let installed=captured[id],
                  entry.generation==canonical.generation,entry.node === installed else {
                sourcePhysicalObservers.removeValue(forKey:id)?.observer.retire();continue
            }
        }
        func current()->Bool {
            sourceAnimationBindingAdmissionOpen && engine.state==canonical &&
            nodesByID.count==captured.count && captured.allSatisfy{nodesByID[$0.key] === $0.value}
        }
        // These MainActor reads are synchronous and do not call external owners.
        // Fence the complete roster once on each side of the batch; each tile
        // reader still validates its own generation, node identity and parent.
        // Rechecking every tile's full roster made this batch quadratic.
        guard current() else{return nil}
        var observed=canonical,tiles:[String:NativeSourcePhysicalTileObservation]=[:]
        for (index,model) in canonical.tiles.enumerated() {
            guard let physical=sourcePhysicalTileObservation(model),
                  physical.tile.cell==model.cell else{
                sourcePhysicalBoardCaptureDiagnostic="tile=\(model.id) cell=\(model.cell)";return nil
            }
            observed.tiles[index]=physical.tile;tiles[model.id]=physical
        }
        guard current() else{return nil}
        sourcePhysicalBoardCaptureDiagnostic="captured"
        return .init(canonicalState:canonical,observedState:observed,tiles:tiles,isStillCurrent:{[weak self] in
            guard let self else{return false}
            if self.frameDiagnosticsEnabled {self.sourcePhysicalReadDiagnostics.boardRevalidations+=1}
            guard self.sourceAnimationBindingAdmissionOpen,self.engine.state==canonical,
                  self.nodesByID.count==captured.count,captured.allSatisfy({self.nodesByID[$0.key] === $0.value}) else{return false}
            for model in canonical.tiles {
                guard self.sourcePhysicalTileObservation(model)==tiles[model.id] else{return false}
            }
            return self.sourceAnimationBindingAdmissionOpen && self.engine.state==canonical &&
                self.nodesByID.count==captured.count && captured.allSatisfy{self.nodesByID[$0.key] === $0.value}
        })
    }
    private func sourceAcceptedStackOwns(_ tileID:String,generation:UInt64)->Bool {
        sourceAcceptedStacks.values.contains{$0.plan.source.id==tileID && $0.plan.generation==generation && nodesByID[tileID] === $0.node && $0.node.parent === canvasRoot && $0.node.sourceGeneration==generation && $0.node.sourceContactNodeAlive}
    }
    // Genuine source markers supplied by their captured native feature owners.
    // Decorative inner actions never populate this dictionary.
    var sourceOuterTileMarkers:[String:NativeTileOuterEligibility.Owners]=[:]
    func sourceOuterEligibility(tile:NativeTile,node:NativeDiceNode)->NativeTileOuterEligibility {
        var result=NativeTileOuterEligibility();result.visible=tile.visible;result.locked=tile.locked;result.value=tile.value;result.variant=tile.variant;result.eventMode=node.sourceEventMode
        let currentOwner=engine.state.tile(at:tile.cell)?.id==tile.id && nodesByID[tile.id] === node
        result.destroyed=engine.noMovesTileRuntime[tile.id]?.destroyed ?? false
        result.gridMembership=currentOwner && draggedID != tile.id ? .sameIdentity:.missingOrDifferentIdentity
        result.idleTimelinePresent=node.sourceIdleTimelinePresent;result.activeIdle=node.sourceActiveIdle
        var markers=sourceOuterTileMarkers[tile.id] ?? .init()
        markers.mergeImpact=markers.mergeImpact || node.sourceOuterOwners.mergeImpact
        markers.pickupScale=markers.pickupScale || node.sourceOuterOwners.pickupScale
        markers.snapBack=markers.snapBack || node.sourceOuterOwners.snapBack
        markers.isBeingSpawned=markers.isBeingSpawned || tile.transientSpawn
        markers.pendingRemoval=markers.pendingRemoval || tile.pendingRemoval
        let runtime=engine.noMovesTileRuntime[tile.id]
        markers.beingRemoved=markers.beingRemoved || runtime?.beingRemoved == true
        markers.cleanupQueued=markers.cleanupQueued || runtime?.cleanupQueued == true
        markers.wildSpawnDropping=markers.wildSpawnDropping || runtime?.wildDropping == true || engine.meterDropReservations.values.contains{$0.tileID==tile.id && $0.assetsPrepared && !$0.landed}
        markers.skipIdleScaleReset=markers.skipIdleScaleReset || node.sourceSkipIdleScaleReset
        result.owners=markers;return result
    }

    func synchronize(animateEntry: Bool = false) {
        defer{sourceTutorialFourthExitAlpha?.paint()}
        guard !sourceDisposalInProgress else {return }
        guard !disposed else { return }
        guard completedExitGeneration != engine.state.generation else{return}
        completedExitGeneration=nil
        onRenderingDemand?(true)
        guard !sourceDisposalInProgress else {return}
        let state = engine.state
        if sourceTutorialHUD != nil,(state.tutorial?.active != true || (state.tutorial?.step != .stack && state.tutorial?.step != .mergeSix && !sourceTutorialSecondPresentationActive && !sourceTutorialThirdPresentationActive)){retireSourceTutorialHUD()}
        if sourceTutorialPreparation != nil,state.tutorial?.step != .stack,!sourceTutorialFirstStepPresentationActive {retireSourceTutorialActivation()}
        if sourceTutorialSecondPreparation != nil,state.tutorial?.step != .mergeSix,!sourceTutorialSecondPresentationActive {retireSourceTutorialActivation()}
        if sourceInitialStartupRejected {onPresentationFailure?("source_initial_startup_not_adopted");return}
        if let initial=sourceInitialConstruction,!initial.isCurrent {sourceInitialConstruction=nil;initial.dispose()}
        if lastGeneration != state.generation {
            if lastGeneration != nil {retireSourceBoardEntry()}
            if lastGeneration != nil {retireSourceEndgameMutationLedger()}
            retireSourceSpecialIdleBindings()
            retireSourceSixBindings()
            if lastGeneration != nil {retireSourceHUDStarJobs()}
            sourceFaceDeferredPostchecks.removeAll()
            let oldFeedback=Array(sourceStackFeedback.values);sourceStackFeedback.removeAll()
            for feedback in oldFeedback {feedback.dispose()}
            if let previous=lastGeneration {retireSourceSpecialTransactions();retireSourceMeterAuxiliaries();sourceMeterCaller?.retireGeneration(previous)}
            if sourceMeterCaller != nil || sourceMeterTearingDown {guard sourceAnimationBindingAdmissionOpen,engine.state.generation==state.generation else{return}}
            let enclosingSourceRetirement=sourceOuterTearingDown
            if !sourceAcceptedStacks.isEmpty {retireSourceAcceptedStacks()};sourceOuterTearingDown=enclosingSourceRetirement
            sourceOuterTileMarkers.removeAll()
            invalidateWildTransports()
            sourceCallbackTime()
            retireSourceSpawns()
            if let previous=lastGeneration {sourceRegularContactCompanions?.retire(generation:previous);sourceFrames.retireGeneration(previous)}
            sourceGameplay.removeAll();sourceRegularHandoffMutationReceipts.removeAll();sourcePopulation.removeAll();sourceFrames.registerPopulation([]);sourceStars=nil
            if sourceFramesAttached {sourceFrames.newBoard(nowMs:sourceFrames.nowMs,configuredFPS:Double(gameplayRenderHost?.renderingFPS ?? 60))}
            retireRegularSixPresentations()
            finishExit(completed: false)
            cancelEntry()
            removeAllActions(); retireEffects(); meterTimeoutIDs.removeAll();laserSpawnCallbacks.removeAll();cancelCandidate()
            textures.invalidatePendingPreparation()
            nodesByID.values.forEach { $0.dispose() }
            guard !sourceDisposalInProgress else {return}
            retireSourcePhysicalObservers();nodesByID.removeAll()
            hudStarFlights.removeAllChildren(); hudStarIDs.removeAll();hudStarNodes.removeAll(); hudStarVisualReceipts.removeAll()
            specialPresentationIDs.removeAll(); specialPresentationID = nil;directPresentationID=nil;directPresentationVariant=nil;directFinalReceipt=nil
            ordinaryAbsorbs.removeAll();ordinaryPostchecks.removeAll();ordinarySpawnVisuals.removeAll();ordinaryDeferred.removeAll();ordinaryPrimaryVisuals.removeAll();ordinarySixVisual=nil
            terminalPresentedGeneration = nil; inputAdmitted = !animateEntry
            pendingTerminal = nil; pendingTerminalGeneration = nil; visualLifetime += 1; visualOwners = 0
            navigationLocked = state.terminal != nil
            lastGeneration = state.generation; lastFrame = nil
        }
        if geometry == nil || geometry?.columns != state.columns || geometry?.rows != state.rows {
            geometry = NativeBoardGeometry(columns:state.columns,rows:state.rows,viewport:size,safeInsets:safeInsets)
            if let preparation=sourceTutorialPreparation,sourceTutorialCurrent(sourceTutorialEpoch),let geometry {
                let positions=Dictionary(uniqueKeysWithValues:state.tiles.map{($0.id,geometry.center(row:$0.cell.row,column:$0.cell.column))})
                guard preparation.relayout(positions:positions,geometryScale:geometry.scale) else {
                    onPresentationFailure?("source_tutorial_relayout_rejected");return
                }
            }
        }
        guard let geometry else { return }
        engine.laserViewportWidth=Double(size.width)
        // Destroyed/detached captured source is a real interruption. Retire
        // that exact accepted-small receipt, not a replacement object, before
        // resynchronizing the atomic committed state. Pure pause keeps parent.
        if let invalid=sourceAcceptedStacks.values.first(where:{$0.plan.generation==state.generation && (nodesByID[$0.plan.source.id] !== $0.node || $0.node.parent !== canvasRoot || !$0.node.sourceContactNodeAlive || $0.node.sourceGeneration != state.generation)}) {
            invalid.owner.cancelAll()
            finishSourceAcceptedStack(invalid.plan.id,generation:invalid.plan.generation,interrupted:true)
            return // finalizer consumed/synchronized the fresh state already
        }
        if let invalid=sourceSixContacts.values.first(where:{entry in
            entry.generation==state.generation && entry.capture?.destinationWatchdogKeepsSource != true && (nodesByID[entry.source.tileID] !== entry.source ||
                nodesByID[entry.destination.tileID] !== entry.destination || entry.source.parent !== canvasRoot ||
                entry.destination.parent !== canvasRoot || !entry.source.sourceContactNodeAlive || !entry.destination.sourceContactNodeAlive)
        }) {
            invalid.capture?.capturedObjectRetired();retireSourceSixContact(invalid)
            return // captured cancellation published its fresh coherent state.
        }
        for entry in Array(sourceMagnetMainEntries.values) where !entry.retired && entry.capture?.phase != .entered {
            if !sourceMagnetMainNodeCurrent(entry.source,generation:entry.generation) || !sourceMagnetMainNodeCurrent(entry.destination,generation:entry.generation) {entry.capture?.capturedObjectRetired();retireSourceSpecialMainEntry(entry)}
        }
        let live = state.tiles.filter { (nodesByID[$0.id].map{sourceSixOwns($0,generation:state.generation) || sourceMagnetMainOwns($0) || sourceTntMainOwns($0)}==true) || sourceAcceptedStackOwns($0.id,generation:state.generation) || (!$0.pendingRemoval && $0.visible && $0.alpha > 0.01) }
        let sixRetainedIDs=Set(nodesByID.values.filter{sourceSixOwns($0,generation:state.generation) || sourceMagnetMainOwns($0) || sourceTntMainOwns($0)}.map(\.tileID))
        let liveIDs = Set(live.map(\.id)).union(sourceMeterCaller?.retainedNodeIDs ?? []).union(sixRetainedIDs)
        for id in Array(nodesByID.keys) where !liveIDs.contains(id) {
            if let node=nodesByID[id] {sourceMeterCaller?.remove(node)}
            if sourceMeterCaller != nil || sourceMeterTearingDown {guard sourceAnimationBindingAdmissionOpen,engine.state.generation==state.generation else{return}}
            if let node=nodesByID[id] {shortWildBoardBlast?.interrupt(node)}
            if let node=nodesByID[id],let scope=sourceDirectScope {
                for (ownerID,retained) in Array(sourceDirectRetainedDestinations) where retained.1 === node {
                    _=scope.mergeSixDestinationCleanup.release(node,token:retained.2)
                    sourceDirectRetainedDestinations.removeValue(forKey:ownerID)
                }
            }
            retireSourceSpawns(tileID:id)
            finishOrdinarySpawnVisual(id)
            finishWildSpawnVisual(id,interrupted:true)
            sourceStackFeedback.removeValue(forKey:id)?.dispose()
            sourcePopulation.remove(id);refreshSourceIdlePopulation()
            sourcePhysicalObservers.removeValue(forKey:id)?.observer.retire()
            nodesByID.removeValue(forKey: id)?.dispose()
        }
        for tile in live {
            let node: NativeDiceNode
            if let existing = nodesByID[tile.id] {
                node = existing
                if sourceTutorialOwns(node) {continue}
                if sourceBoardEntryOwns(node) {continue}
                // Reservation locks the donors before .specialReserved starts
                // the pull caller. Source only changes their input fields here;
                // it does not repaint the visible numbered face as a locked
                // placeholder. Keep the exact admitted physical donors through
                // this first synchronize, just as the active pull does below.
                if sourceMagnetPullScope != nil,let plan=engine.pendingSpecial,
                   plan.archetype == .magnet,plan.generation==state.generation,
                   tile.magnetOwned,!tile.pendingRemoval,
                   plan.targets.contains(where:{$0.id==tile.id && !$0.locked && $0.visible && $0.alpha>0.01}),
                   sourceMagnetMainNodeCurrent(node,generation:state.generation) {continue}
                if sourceMagnetSourcePulls.values.contains(where:{$0.nodes[node.tileID] === node && sourceMagnetPullCurrent($0)}) {continue}
                if sourceMagnetSurvivorOwns(node) {continue}
                if sourceMagnetFallbackOwns(node) || sourceMagnetNormalOwns(node) {continue}
                if sourceSixOwns(node,generation:state.generation) || sourceMagnetMainOwns(node) || sourceTntMainOwns(node) {continue}
                if sourceMeterCaller?.owns(node)==true {sourceMeterCaller?.bind(node,cell:tile.cell,generation:state.generation);if sourceMeterCaller != nil || sourceMeterTearingDown {guard sourceAnimationBindingAdmissionOpen,engine.state.generation==state.generation else{return}};continue}
                node.update(value: tile.value, kind: tile.gameplayArchetype?.rawValue ?? "regular", variant: tile.variant,
                            depth: tile.stackDepth, locked: tile.locked)
            } else {
                node = NativeDiceNode(id: tile.id, value: tile.value, kind: tile.gameplayArchetype?.rawValue ?? "regular",
                    variant: tile.variant, depth: tile.stackDepth, locked: tile.locked, textures: textures,sourceSpecialIdle:sourceIdleScope?.specialIdle)
                node.onResourceReady = { [weak self] in
                    guard let self, !self.disposed else { return }
                    self.requestRendering(!self.suspended)
                }
                nodesByID[tile.id] = node; canvasRoot.addChild(node);captureSourceTutorialObject(node)
            }
            if let sourceOuterTimelineDriver {
                node.installSourceOuterDriver(sourceOuterTimelineDriver,generation:state.generation,geometryScale:geometry.scale)
                if let sourceDragTweenDriver {node.installSourceDragTweenDriver(sourceDragTweenDriver)}
                if sourceInitialConstruction?.ownsHiddenInitialObject(node) != true {node.isHidden = !tile.visible} // initial hidden capture is exact-object-only.
            }
            if !entryInProgress || node.action(forKey: "entry") == nil {
                node.synchronizeSourceGeometry(geometry.scale)
                node.alpha = presentationAlpha(tile,state: state)
                if tile.id != draggedID && !node.sourceOuterOwners.snapBack && !sourceAcceptedStackOwns(tile.id,generation:state.generation) && !specialPresentationIDs.contains(tile.id) && shortWildBoardBlast?.owns(node) != true { node.position = geometry.center(row: tile.cell.row, column: tile.cell.column) }
            }
            if shortWildBoardBlast?.owns(node) != true && !specialPresentationIDs.contains(tile.id) &&
                (sourceOuterTimelineDriver == nil || (tile.id != draggedID && !sourceAcceptedStackOwns(tile.id,generation:state.generation))) {
                node.zPosition = tile.isWild ? 12001 : (sourceBoardEntryEnabled && node.sourceOuterDriven ? (tile.locked ? 5:20):CGFloat(tile.cell.row * state.columns + tile.cell.column))
            }
            sourceMeterCaller?.bind(node,cell:tile.cell,generation:state.generation)
            if sourceMeterCaller != nil || sourceMeterTearingDown {guard sourceAnimationBindingAdmissionOpen,engine.state.generation==state.generation else{return}}
            // Source admission is canonical Special identity, including assets
            // and phase waiting. Rendering readiness does not define population.
            if tile.gameplayArchetype != nil || tile.variant.flatMap({NativeSpecialDiceRegistry.variants[$0]}) != nil {sourcePopulation.insert(tile.id)}
            else {sourcePopulation.remove(tile.id)}
        }
        refreshSourceIdlePopulation()
        renderGhosts(state: state, geometry: geometry)
        score.text = String(state.score)
        synchronizeComboHUD()
        // Source startup owns its initial fade; after guide completion the
        // completion-assist HUD lock still owns dimming, including cleanup refreshes.
        let tutorialHUDAlpha:CGFloat=state.tutorial?.shouldLockHUD==true && (!sourceTutorialHUDEnabled || state.tutorial?.active != true) ? 0.2:1
        roundIndicator.synchronize(round:state.stage,arcade:state.mode == .arcade && state.tutorial?.shouldLockHUD != true,viewport:size,alpha:(!tutorialSpecialBarFocus.isEmpty || sourceTutorialHUD?.owns(roundIndicator)==true) ? roundIndicator.alpha:tutorialHUDAlpha,variant:state.effectiveArcadeVariant)
        layoutHUD()
        applyBoardShake(boardShake)
        for child in hud.children where child !== noMoves && sourceTutorialHUD?.owns(child) != true && tutorialSpecialBarFocus.isEmpty {child.alpha = tutorialHUDAlpha}
        if animateEntry && !UIAccessibility.isReduceMotionEnabled {
            animateBoardEntry(tiles: live,geometry: geometry)
        } else if !entryInProgress { inputAdmitted = state.terminal == nil && pendingTerminal == nil;roundIndicator.enter(animated:false) }
        if preparedEntryGeneration == state.generation {inputAdmitted=false;navigationLocked=true}
        publishFishIdleFrames(force:true)
        applyTutorialSpecialBarFocus()
    }

    private func layoutComboValue(top:CGFloat) {
        let normalNumberWidth=comboNumber.frame.width/max(0.00001,abs(comboNumber.xScale))
        let width=comboArt.size.width+4+comboX.frame.width+normalNumberWidth
        let center=size.width-36-width/2-(size.width*0.05).rounded()
        comboArt.position=CGPoint(x:center,y:top)
        comboX.position=CGPoint(x:center+comboArt.size.width/2+4,y:top)
        comboNumber.position=CGPoint(x:comboX.position.x+comboX.frame.width,y:top)
        let overflow=max(0,comboNumber.frame.maxX-(size.width-12))
        if overflow>0 {comboArt.position.x-=overflow;comboX.position.x-=overflow;comboNumber.position.x-=overflow}
        comboHitRect=CGRect(x:center-53,y:top-30,width:106,height:60)
    }

    private func synchronizeComboHUD() {
        let combo = engine.state.combo
        comboNumber.text = String(combo)
        if exitInProgress || engine.state.terminal != nil {comboNumberMotion.stop()}
        else {comboNumberMotion.synchronize(combo:combo,generation:engine.state.generation,reducedMotion:UIAccessibility.isReduceMotionEnabled)}
        comboArtImage.texture = textures.texture(combo >= 10 ? "assets/hud/mega-combo-hud.png" : combo >= 5 ? "assets/hud/extra-combo-hud.png" : "assets/hud/combo-hud.png")
        comboHUDMotion.synchronize(combo:exitInProgress || engine.state.terminal != nil ? 0:combo,generation:engine.state.generation)
    }

    private func presentationAlpha(_ tile: NativeTile,state: NativeBoardState) -> CGFloat {
        // Older Native saves stored alpha1 for fresh locked-zero holders.
        // Keep v9's ghost ceiling on every refresh without brightening the
        // lower-alpha holders owned by Magnet/locked-bonus presentation.
        let alpha=CGFloat(tile.locked && tile.value==0 && !tile.isWild ? min(0.25,tile.alpha):tile.alpha)
        guard let tutorial = state.tutorial,tutorial.active,
              tutorial.step == .stack || tutorial.step == .mergeSix,
              !tutorial.guidedPair.contains(tile.id),!tile.isWild else { return alpha }
        return alpha*0.2
    }

    private func animateBoardEntry(tiles: [NativeTile],geometry: NativeBoardGeometry) {
        // Repeated UIKit layout must not recapture the in-flight alpha/scale
        // as a new destination or replace the current entry receipt.
        guard !entryInProgress else{return}
        if sourceBoardEntryEnabled {
            guard startSourceBoardEntry(tiles:tiles,geometry:geometry) else {inputAdmitted=false;onPresentationFailure?("source_board_entry_not_admitted");return}
            return
        }
        let targets = tiles.compactMap { nodesByID[$0.id] }
        if let initial=sourceInitialConstruction {initial.releaseToExistingNativeEntry();for node in targets {node.isHidden=false}}
        let positions = targets.map { CGPoint(x: $0.position.x,y: size.height-$0.position.y) }
        let plans = NativeBoardEntryPlan.make(positions: positions,maxOffset: geometry.tileSize*0.42)
        // The original empty owner resolves before installing midpoint work.
        guard !plans.isEmpty else {
            sourceCallbackTime()
            let empty=sourceFrames.begin(.init(kind:.boardPopIn,generation:engine.state.generation,id:UUID().uuidString))
            sourceFrames.end(empty)
            inputAdmitted=true;evaluate();return
        }
        entryInProgress = true; entryOwners = plans.count; inputAdmitted = false
        let generation = engine.state.generation
        sourceCallbackTime();sourcePopIn=sourceFrames.begin(.init(kind:.boardPopIn,generation:generation,id:UUID().uuidString))
        let receipt=hudEntryReveal.begin(generation:generation,tileCount:plans.count)
        hudEntryReceipt=receipt;isHUDRevealPending=true
        primeHUDForBoardEntry()
        let waveDuration=plans.map(\.end).max() ?? 0
        run(.sequence([.wait(forDuration:max(0.01,waveDuration*0.5)),.run { [weak self] in
            guard let self,!self.disposed,self.hudEntryReceipt==receipt,self.engine.state.generation==generation else{return}
            self.hudEntryReveal.midpoint(receipt)
        }]),withKey:"hud-midpoint")
        onBoardEntry?(waveDuration+0.03,NativeBoardEntryPlan.hapticBeats(plans))
        for plan in plans {
            let node = targets[plan.tileIndex]
            let rest = node.position, rotation = node.zRotation, alpha = node.alpha
            let start = CGPoint(x: rest.x+plan.offset.x,y: rest.y-plan.offset.y)
            node.position = start; node.zRotation = rotation-plan.rotation; node.setScale(0); node.alpha = 0
            node.run(.sequence([.wait(forDuration: plan.delay),.group([
                NativeBoardMotion.move(from: start,to: rest,duration: 0.42,ease: .backOut(1.7)),
                NativeBoardMotion.rotate(from: rotation-plan.rotation,to: rotation,duration: 0.42,ease: .backOut(1.7)),
                NativeBoardMotion.fade(from: 0,to: alpha,duration: 0.08,ease: .power2Out),
                NativeBoardMotion.enter(base: geometry.scale)
            ]),.run { [weak self,weak node] in
                guard let self,!self.disposed,self.entryInProgress,self.hudEntryReceipt==receipt,self.engine.state.generation == generation else { return }
                node?.position = rest; node?.zRotation = rotation; node?.setScale(geometry.scale)
                self.hudEntryReveal.tileCompleted(receipt)
                self.entryOwners = max(0,self.entryOwners-1)
                if self.entryOwners == 0 {self.scheduleEntryAdmission(receipt)}
            }]),withKey: "entry")
        }
    }

    private func scheduleEntryAdmission(_ receipt:NativeHUDEntryReveal.Receipt) {
        run(.sequence([.wait(forDuration:0.03),.run { [weak self] in
            guard let self,!self.disposed,self.entryInProgress,self.hudEntryReceipt==receipt,self.engine.state.generation==receipt.generation else{return}
            self.finishSourceEntry()
            self.entryInProgress=false;self.inputAdmitted=true;self.resumeSourceEntryDeferredIdle();self.evaluate()
        }]),withKey:"entry-admission")
    }

    private func primeHUDForBoardEntry() {
        hud.removeAction(forKey:"hud-enter")
        if keepsHUDVisibleOnEntry {
            isHUDRevealPending=false;hud.position = .zero;hud.alpha=1;roundIndicator.enter(animated:false)
        } else {hud.position.y=140;hud.alpha=0;roundIndicator.primeEntry()}
    }
    private func startHUDDrop(_ receipt:NativeHUDEntryReveal.Receipt) {
        guard !disposed,!exitInProgress,hudEntryReceipt==receipt,engine.state.generation==receipt.generation else{return}
        isHUDRevealPending=false
        if keepsHUDVisibleOnEntry {
            hud.position = .zero;hud.alpha=1;roundIndicator.enter(animated:false)
            onHUDDrop?(receipt.generation);return
        }
        hud.run(.sequence([.customAction(withDuration:NativeHUDTransitionMotion.dropDuration) { node,time in
            let pose=NativeHUDTransitionMotion.drop(at:Double(time))
            node.position.y=CGFloat(pose.offset);node.alpha=CGFloat(pose.alpha)
        },.run { [weak self] in
            guard let self,self.hudEntryReceipt==receipt,self.engine.state.generation==receipt.generation else{return}
            self.hud.position = .zero;self.hud.alpha=1
            self.hud.removeAction(forKey:"hud-enter")
            self.finishHUDTapFeedback()
        }]),withKey:"hud-enter")
        roundIndicator.enter(animated:true);onHUDDrop?(receipt.generation)
    }

    private func cancelEntry(restoreHUD:Bool=true) {
        if let captured=sourceBoardEntryOwner {
            let epoch=sourceBoardEntryEpoch
            captured.abort() // Settle while the actual captured route is current.
            guard sourceBoardEntryEpoch==epoch else{return}
            if sourceBoardEntryOwner === captured {sourceBoardEntryOwner=nil;sourceBoardEntryNodes.removeAll()}
            completedSourceBoardEntry=nil;sourceBoardEntryEpoch &+= 1
            entryInProgress=false;entryOwners=0;inputAdmitted=false
        }
        finishSourceEntry()
        if let receipt=hudEntryReceipt {hudEntryReveal.cancel(receipt)}
        hudEntryReceipt=nil;isHUDRevealPending=false
        removeAction(forKey:"hud-midpoint");hud.removeAction(forKey:"hud-enter")
        if restoreHUD {hud.position = .zero;hud.alpha=1;roundIndicator.cancelExit()}
        guard entryInProgress else { return }
        entryInProgress = false; entryOwners = 0; removeAction(forKey: "entry-admission")
        removeAction(forKey:"hud-midpoint");hudDropPaints=nil;hud.removeAction(forKey:"hud-enter");hud.position = .zero;hud.alpha=1
        for node in nodesByID.values {
            node.removeAction(forKey: "entry"); node.zRotation = 0
            if let geometry { node.setScale(geometry.scale) }
        }
    }

    private func renderGhosts(state: NativeBoardState, geometry: NativeBoardGeometry) {
        guard !disposed,!sourceDisposalInProgress else{return}
        let occupied = Set(state.tiles.filter { !$0.pendingRemoval && $0.visible && $0.alpha > 0.01 }.map(\.cell))
        let texture = textures.texture("assets/ghost-placeholder.png")
        // v9 retains each cell's background object. Occupied cells remain in
        // this bounded cache, detached so existing exit targets/RNG stay exact.
        for cell in Array(ghostNodesByCell.keys) where cell.row<0 || cell.row>=state.rows || cell.column<0 || cell.column>=state.columns {
            ghostNodesByCell.removeValue(forKey:cell)?.removeFromParent()
        }
        var paintIndex=0
        for row in 0..<state.rows {
            for column in 0..<state.columns {
                let cell=NativeCell(column:column,row:row)
                if occupied.contains(cell) {ghostNodesByCell[cell]?.removeFromParent();continue}
                let ghost:SKSpriteNode
                if let existing=ghostNodesByCell[cell] {ghost=existing}
                else {
                    ghost=SKSpriteNode(texture:texture)
                    ghost.name="native-ghost-\(column)-\(row)"
                    ghostNodesByCell[cell]=ghost
                }
                if ghost.texture !== texture {ghost.texture=texture}
                // Former fresh nodes had these defaults after every refresh.
                // Reset a completed exit pose without retaining stale actions.
                ghost.removeAllActions();ghost.setScale(1);ghost.zRotation=0
                ghost.size=CGSize(width:geometry.tileSize,height:geometry.tileSize)
                ghost.alpha=1;ghost.isHidden=false;ghost.position=geometry.center(row:row,column:column)
                // Retain the original row-major exit/RNG order after a cell
                // becomes empty again, rather than appending it at the end.
                if ghost.parent !== ghosts || ghosts.children[paintIndex] !== ghost {
                    ghost.removeFromParent();ghosts.insertChild(ghost,at:paintIndex)
                }
                paintIndex+=1
            }
        }
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        if let binding=sourceMicrotaskInstallation {
            _=binding.inputTask{[self] in sourceTouchesBegan(touches,with:event)}
        } else {sourceTouchesBegan(touches,with:event)}
    }
    private func sourceTouchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard !sourceDisposalInProgress else {return }
        guard !disposed,!touches.isEmpty else{return}
        if renderPipelineProbe?.active==true {renderPipelineProbe?.cancel(scene:self,reason:"actual-touch")}
        sourceCallbackTime();sourceFrames.pointerBegan()
        guard !disposed, !suspended, activeTouch == nil, draggedID == nil, let touch = touches.first else { return }
        requestRendering(true)
        let point = touchLocationInGameplayScene(touch)
        if handleHUDContact(at:point) {return}
        if beginDrag(at:point) { activeTouch = touch }
    }
    /// Shared real pointer dispatch; admission remains identical for every HUD route.
    @discardableResult func handleHUDContact(at point:CGPoint)->Bool {
        guard !disposed,!suspended else{return false}
        let canvasPoint=canvasRoot.convert(point,from:self)
        if closeButton?.hitRect.contains(canvasPoint)==true {
            guard inputAdmitted,!navigationLocked,engine.state.tutorial?.shouldLockHUD != true else{return true}
            closeButton?.playTapBounce();requestRendering(true)
            onExitRequest?();return true
        }
        if gameplayHelpAllowed,nodes(at:point).contains(where:{$0.name == "native-game-help"}) {
            guard inputAdmitted,!navigationLocked,engine.state.tutorial?.shouldLockHUD != true else {return true}
            if let icon=hud.childNode(withName:"native-game-help") {playHUDTapFeedback(on:icon)}
            onHelpRequest?()
            return true
        }
        if scoreHitRect.contains(canvasPoint) || comboHitRect.contains(canvasPoint) {
            guard inputAdmitted,!navigationLocked,engine.state.tutorial?.shouldLockHUD != true else { return true }
            if comboHitRect.contains(canvasPoint) {playHUDTapFeedback(on:comboArt);onComboRequest?()}
            else {playHUDTapFeedback(on:scoreArt);onScoreRequest?()}
            return true
        }
        return false
    }

    private var sourceWildSkinAssets:(scope:NativeGameplaySourceContext.Scope,generation:UInt64,installation:NativeSourceSceneMicrotaskInstallation,reactions:NativeSourceMicrotaskFIFO.Scope)?
    private func retireSourceWildSkinAssets() {
        let captured=sourceWildSkinAssets;sourceWildSkinAssets=nil;sourceRestoredWildSkinsConfigured=false;captured?.reactions.dispose()
    }
    @discardableResult func repairSourceWildSkin(tileID:String,scope:NativeGameplaySourceContext.Scope,
        startSourceIdle:()->Bool,currentSourceFaceAnchor:(()->CGPoint?)?=nil,allowPendingMeter:Bool=false)->Bool {
        guard sourceAnimationBindingAdmissionOpen,scope.current,sourceOuterTimelineDriver === scope.timeline,
              let installation=sourceMicrotaskInstallation,installation.isCurrent,
              scope.sourceMicrotaskTasks === installation.tasks,
              let node=nodesByID[tileID],node.parent === canvasRoot,node.sourceContactNodeAlive,
              node.sourceGeneration==engine.state.generation else{return false}
        let generation=engine.state.generation,kind=node.kind,variant=node.variant
        let pendingID=allowPendingMeter ? engine.pendingMeterOpen?.id:nil
        let modelCurrent:()->Bool = {[weak self,weak node] in
            guard let self,let node else{return false}
            if self.engine.state.tiles.contains(where:{$0.id==tileID && $0.gameplayArchetype?.rawValue==kind && $0.variant==variant}) {return true}
            // Source openAtCell can reuse the captured zero holder. Core's
            // completeMeterOpen validates that holder and retains its actual ID;
            // the proposed new tile ID is only used for a new placeholder.
            guard allowPendingMeter,node.sourceOpenedWildConstructorCurrent,node.sourceIdleDeferred,
                  let request=self.engine.pendingMeterOpen,request.id==pendingID,request.generation==generation,
                  (request.tile.id==tileID || request.expectedHolderID==tileID),
                  request.tile.gameplayArchetype?.rawValue==kind else{return false}
            return variant==nil || request.tile.variant==variant
        }
        guard modelCurrent() else{return false}
        if let bound=sourceWildSkinAssets,bound.scope !== scope || bound.generation != generation || bound.installation !== installation {
            retireSourceWildSkinAssets()
        }
        if sourceWildSkinAssets==nil {
            guard let reactions=installation.tasks.fifo.makeAssetScope(boundProducer:.sourceAssetCompletionTask,isCurrent:{[weak self,weak scope,weak installation] in
                guard let self,let scope,let installation else{return false}
                return self.sourceAnimationBindingAdmissionOpen && scope.current &&
                    self.sourceOuterTimelineDriver === scope.timeline && self.engine.state.generation==generation &&
                    self.sourceMicrotaskInstallation === installation && installation.isCurrent
            }) else{return false}
            sourceWildSkinAssets=(scope,generation,installation,reactions)
        }
        guard let reactions=sourceWildSkinAssets?.reactions,reactions.admissionOpen else{return false}
        let current:()->Bool = {[weak self,weak node,weak scope,weak installation] in
            guard let self,let node,let scope,let installation else{return false}
            guard self.sourceAnimationBindingAdmissionOpen,scope.current,self.engine.state.generation==generation,
                  self.sourceOuterTimelineDriver === scope.timeline,self.sourceMicrotaskInstallation === installation,
                  installation.isCurrent,self.sourceWildSkinAssets?.reactions === reactions,
                  self.nodesByID[tileID] === node,node.parent === self.canvasRoot,node.sourceContactNodeAlive,
                  node.sourceGeneration==generation,node.kind==kind,node.variant==variant else{return false}
            return modelCurrent()
        }
        return node.repairSourceWildSkin(generation:generation,assetTasks:installation.tasks,reactionScope:reactions,
            current:current,startSourceIdle:startSourceIdle,startSourceTntFuse:kind=="wild-tnt" && variant==nil ? {
                node.beginSourceTntFuse(service:scope.service,current:current,paintable:{[weak self] in
                    guard let self else{return false}
                    return self.sourceFizzCanvasPaintable && self.engine.state.terminal==nil && !self.exitInProgress && !self.specialPresentationIDs.contains(tileID)
                })
            }:nil,startSourceShimmer:sourceWildShimmerEnabled ? {
                node.beginSourceWildShimmer(service:scope.service,random:{scope.mathRandom.next()},current:current,canvasPaintable:self.sourceShimmerCanvasPaintable)
            }:nil,startSourceIdleBubbles:sourceSpecialIdleAdmissionOpen && sourceIdleScope === scope &&
                NativeIdleBubbleMotion.family(kind:kind,variant:variant) != nil ? {
                    guard let tasks=installation.reactionScope else{return nil}
                    let paintable:()->Bool = {[weak self] in self?.sourceFizzCanvasPaintable==true}
                    guard let field=node.beginSourceIdleBubbles(scope:scope.specialIdle,service:scope.service,tasks:tasks,
                        canvasPaintable:paintable,current:current) else{return nil}
                    if kind=="wild-magnet",variant=="bottle" || variant=="honey" {
                        guard node.scheduleSourceMagnetFizzRestart(service:scope.service,tasks:tasks,
                            canvasPaintable:paintable,current:current) else{field.dispose();return nil}
                    }
                    return field
                }:nil,currentSourceFaceAnchor:currentSourceFaceAnchor,completion:{[weak self] accepted in
                guard current() else{return}
                if !accepted {self?.onSourcePresentationFailure?("source_wild_skin_texture_rejected",generation)}
            })
    }
    @discardableResult func prepareSourceBeeIdleFrames(tileID:String,scope:NativeGameplaySourceContext.Scope,
        completion:@escaping(Bool)->Void)->Bool {
        guard sourceAnimationBindingAdmissionOpen,scope.current,sourceOuterTimelineDriver === scope.timeline,
              let bound=sourceWildSkinAssets,bound.scope === scope,bound.generation==engine.state.generation,
              sourceMicrotaskInstallation === bound.installation,bound.installation.isCurrent,
              scope.sourceMicrotaskTasks === bound.installation.tasks,
              let node=nodesByID[tileID],node.parent === canvasRoot,node.kind=="wild",node.variant=="bee",
              engine.state.tiles.contains(where:{$0.id==tileID && $0.gameplayArchetype?.rawValue=="wild" && $0.variant=="bee"}) else{return false}
        let generation=engine.state.generation,reactions=bound.reactions,installation=bound.installation
        return node.prepareSourceBeeIdleFrames(generation:generation,assetTasks:installation.tasks,reactionScope:reactions,
            current:{[weak self,weak node,weak scope,weak installation] in
                guard let self,let node,let scope,let installation else{return false}
                return self.sourceAnimationBindingAdmissionOpen && scope.current && self.engine.state.generation==generation &&
                    self.sourceOuterTimelineDriver === scope.timeline && self.sourceMicrotaskInstallation === installation &&
                    installation.isCurrent && self.sourceWildSkinAssets?.reactions === reactions &&
                    self.nodesByID[tileID] === node && node.parent === self.canvasRoot &&
                    self.engine.state.tiles.contains(where:{$0.id==tileID && $0.gameplayArchetype?.rawValue=="wild" && $0.variant=="bee"})
            },completion:completion)
    }

    private func sourceInputTile(at point:CGPoint)->NativeTile? {
        // Explicit Source hit shapes follow the exact current painted object.
        // Raw/unbound nodes retain their existing stable cell input recipe.
        let candidates=canvasRoot.children.reversed().compactMap{$0 as? NativeDiceNode}.filter{$0.hasSourceSkinHitArea}
        let ordered=candidates.enumerated().sorted{a,b in
            a.element.zPosition==b.element.zPosition ? a.offset<b.offset:a.element.zPosition>b.element.zPosition
        }.map(\.element)
        for node in ordered {
            if node.containsSourceSkinInput(point,in:canvasRoot,generation:engine.state.generation),
               let tile=engine.state.tiles.first(where:{$0.id==node.tileID}),nodesByID[node.tileID] === node {return tile}
        }
        guard let hit=geometry?.cell(at:point),let tile=engine.state.tile(at:.init(column:hit.column,row:hit.row)),
              nodesByID[tile.id]?.hasSourceSkinHitArea != true else{return nil}
        return tile
    }
    @discardableResult
    func beginDrag(at point: CGPoint) -> Bool {
        // Programmatic QA shares the existing callback domain; no new ticker.
        guard sourceAnimationBindingAdmissionOpen else{return false}
        if let interaction=onTutorialSpecialBarInteraction {
            guard !disposed,!sourceOuterTearingDown,!suspended,!exitInProgress,draggedID==nil,inputAdmitted,
                let tile=sourceInputTile(at:canvasRoot.convert(point,from:self)),
                let node=nodesByID[tile.id],(!node.sourceOuterDriven || node.sourceEventMode == "static"),
                !sourceMagnetSurvivorEntries.values.contains(where:{$0.node === node && sourceMagnetSurvivorCurrent($0) && $0.owner?.inputBound != true}),
                (sourceOuterTimelineDriver==nil || engine.state.generation==node.sourceGeneration),
                interaction(tile) else{return false}
        }
        onEndgameHintInteraction?()
        guard sourceAnimationBindingAdmissionOpen else{return false};sourceCallbackTime();sourceFrames.pointerBegan()
        let point=canvasRoot.convert(point,from:self)
        guard !disposed,!sourceOuterTearingDown, !suspended, !exitInProgress, draggedID == nil, inputAdmitted,
              let tile = sourceInputTile(at:point),
              let node = nodesByID[tile.id],(!node.sourceOuterDriven || node.sourceEventMode == "static"), !sourceMagnetSurvivorEntries.values.contains(where:{$0.node === node && sourceMagnetSurvivorCurrent($0) && $0.owner?.inputBound != true}),
              (sourceOuterTimelineDriver==nil || engine.state.generation==node.sourceGeneration),
              engine.beginDrag(tileID: tile.id, pointerID: 1) else { return false }
        if tutorialSpecialBarFocus.isEmpty{sourceRegularIdleOwner?.interact()}
        shortWildBoardBlast?.interrupt(node)
        guard sourceAnimationBindingAdmissionOpen,
              (sourceOuterTimelineDriver==nil || engine.state.generation==node.sourceGeneration),
              nodesByID[tile.id] === node else{return false}
        sourceTutorialBoardRestore?.retire(node)
        onRenderingDemand?(true)
        cancelCandidate()
        draggedID = tile.id; dragMoved = false; touchStart = point; lastTouchPoint = point
        if frameDiagnosticsEnabled {diagnosticDrags+=1;diagnosticAnyDragging=true}
        dragHoverCadence.reset()
        lastPointerTime=CACurrentMediaTime();pointerVelocity = .zero
        fingerOffset = CGPoint(x: node.position.x - point.x, y: node.position.y - point.y)
        retireSourceSpawns(tileID:tile.id)
        finishOrdinarySpawnVisual(tile.id)
        // Source pickup kills bounce children; its parent settles on the next
        // genuine APP root, rather than a synthetic interruption here.
        if sourceWildOpenBounces[tile.id]==nil {finishWildSpawnVisual(tile.id,interrupted:true)}
        sourceHeldOrigin=node.sourceOuterDriven ? SourceHeldOrigin(tileID:tile.id,generation:engine.state.generation,cell:tile.cell,position:node.position,zPosition:node.zPosition):nil
        if node.sourceOuterDriven {
            // Captured Source outer owner replaces only its own transform.
            // Exact spawn receipts were retired above; inner family cues survive.
            _ = node.beginSourcePickup()
        } else {node.removeAllActions();node.visual.removeAllActions()}
        node.zPosition = 18000
        node.setDragging(true,sourceOuterTransform:node.sourceOuterDriven)
        dragTrail.begin(at:node.position,time:CACurrentMediaTime()*1000)
        retireSourceDragMoves()
        if let service=sourceStackFrameService,service.sourceFrameTransportAdmissionOpen {
            let generation=engine.state.generation,id=tile.id
            sourceDragMoves=NativeSourceDragMoveQueue(service:service,ownerID:"drag-move:"+id,generation:generation,
                current:{[weak self,weak node,weak service] in
                    guard let self,let node,let service else{return false}
                    guard self.sourceAnimationBindingAdmissionOpen,self.sourceStackFrameAdmission?()==true else{return false}
                    return self.sourceAnimationBindingAdmissionOpen && self.engine.state.generation==generation &&
                        self.draggedID==id && self.nodesByID[id] === node && node.parent === self.canvasRoot &&
                        self.sourceStackFrameService === service && service.sourceFrameTransportAdmissionOpen
                },paint:{[weak self] point in
                    guard let self else{return}
                    self.moveDrag(to:point)
                    if self.frameDiagnosticsEnabled,self.sourceAnimationBindingAdmissionOpen,
                       self.engine.state.generation==generation,self.draggedID==id {
                        self.diagnosticDragRender.painted(at:CACurrentMediaTime()*1000,touchMilliseconds:self.diagnosticLatestTouchMilliseconds)
                    }
                })
            retainSourceDragTransport()
            retainSourceRendererDragTransport()
        }
        if node.sourceOuterDriven {sourceRegularContactCompanions?.pointerDown(node);node.sourcePointerDown()}
        publishFishIdleFrames(force:true)
        onPointerState?(true)
        onGameplayEvent?(NativeGameplayEvent(.dragBegan, tileIDs: [tile.id], archetype: tile.gameplayArchetype))
        return true
    }


    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        if let binding=sourceMicrotaskInstallation {
            _=binding.inputTask{[self] in sourceTouchesMoved(touches,with:event)}
        } else {sourceTouchesMoved(touches,with:event)}
    }
    private func sourceTouchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = activeTouch, touches.contains(touch) else { return }
        if frameDiagnosticsEnabled {
            let now=CACurrentMediaTime()*1000,stamp=touch.timestamp*1000
            let coalesced=event?.coalescedTouches(for:touch)
            diagnosticDragInput.osSamples+=1;diagnosticDragInput.osTimestampMs=stamp
            diagnosticDragInput.callbackAgeWorst=max(diagnosticDragInput.callbackAgeWorst,max(0,now-stamp))
            diagnosticDragInput.coalescedTimestampMs=coalesced?.last.map{$0.timestamp*1000}
            if let coalesced,!coalesced.isEmpty {
                diagnosticDragInput.coalescedEvents+=1;diagnosticDragInput.coalescedSamples+=coalesced.count
                if let latest=diagnosticDragInput.coalescedTimestampMs {diagnosticDragInput.coalescedCallbackAgeWorst=max(diagnosticDragInput.coalescedCallbackAgeWorst,max(0,now-latest))}
            }
        }
        dispatchSourceTouchMove(to:touchLocationInGameplayScene(touch))
    }

    /// Real touch dispatcher; programmatic QA retains synchronous moveDrag.
    func dispatchSourceTouchMove(to point:CGPoint) {
        if frameDiagnosticsEnabled {diagnosticTouchSamples+=1}
        if frameDiagnosticsEnabled {diagnosticLatestTouchMilliseconds=CACurrentMediaTime()*1000}
        if let sourceDragMoves {sourceDragMoves.enqueue(point)}else{moveDrag(to:point)}
    }
    private func retireSourceDragMoves() {
        retireSourceRendererDragTransport()
        let transport=sourceDragTransport;sourceDragTransport=nil;transport?.cancel()
        let captured=sourceDragMoves;sourceDragMoves=nil;captured?.dispose()
        diagnosticLatestTouchMilliseconds=nil
        if frameDiagnosticsEnabled {
            diagnosticDragInput.arrivalTime=nil
        diagnosticDragInput.osTimestampMs=nil;diagnosticDragInput.coalescedTimestampMs=nil
            diagnosticDragInput.paintedOSTimestampMs=nil;diagnosticDragInput.paintedCoalescedTimestampMs=nil
            diagnosticExpectedDragNode=nil;diagnosticExpectedDragPosition=nil;diagnosticExpectedDragGeneration=nil
        }
        diagnosticDragRender.retireDrag()
    }
    private func retainSourceDragTransport() {
        guard sourceDragTransport?.active != true,!disposed,!suspended,sourceDragMoves != nil,
              let id=draggedID,let node=nodesByID[id],let service=sourceStackFrameService else{return}
        let generation=engine.state.generation
        sourceDragTransport=service.retainDirectManipulationTransport(ownerID:"drag-move:"+id,generation:generation,
            current:{[weak self,weak node,weak service] in
                guard let self,let node,let service,!self.disposed,!self.suspended,
                      self.sourceAnimationBindingAdmissionOpen,self.sourceStackFrameAdmission?()==true else{return false}
                return !self.disposed && !self.suspended && self.sourceAnimationBindingAdmissionOpen &&
                    self.engine.state.generation==generation && self.draggedID==id && self.nodesByID[id] === node &&
                    node.parent === self.canvasRoot && self.sourceStackFrameService === service && service.sourceFrameTransportAdmissionOpen
            })
    }

    /// Revoke before the renderer can stop producing frames; the same Source
    /// CAD transport then resumes without creating a second animation clock.
    func retireSourceRendererDragTransport() {
        let captured=sourceRendererDragTransport;sourceRendererDragTransport=nil;captured?.cancel()
    }
    private func retainSourceRendererDragTransport() {
        guard sourceRendererDragTransport?.active != true,sourceDragTransport?.active==true,
              let service=sourceStackFrameService,let id=draggedID,let node=nodesByID[id] else{return}
        let generation=engine.state.generation
        sourceRendererDragTransport=service.retainRendererDragTransport(ownerID:"drag-render:"+id,generation:generation,
            current:{[weak self,weak node,weak service] in
                guard let self,let node,let service,let host=self.gameplayRenderHost else{return false}
                return !self.disposed && !self.suspended && !self.isPaused &&
                    host.renderedScene === self && host.renderView.window != nil && !host.renderView.isHidden && !host.renderingPaused &&
                    host.renderingFPS>=60 && self.gameplayRenderHostVisible(host) && self.sourceAnimationBindingAdmissionOpen &&
                    self.sourceStackFrameAdmission?()==true && self.engine.state.generation==generation &&
                    self.draggedID==id && self.nodesByID[id] === node && node.parent === self.canvasRoot &&
                    self.sourceStackFrameService === service && service.sourceFrameTransportAdmissionOpen
            })
    }

    func moveDrag(to point: CGPoint,now:TimeInterval=CACurrentMediaTime()) {
        guard !sourceDisposalInProgress else {return }
        let point=canvasRoot.convert(point,from:self)
        guard let id = draggedID, let node = nodesByID[id] else { return }
        let diagnosticStart=frameDiagnosticsEnabled ? CACurrentMediaTime():nil
        if frameDiagnosticsEnabled {diagnosticMoves+=1;diagnosticAnyDragging=true}
        defer {if let diagnosticStart {diagnosticMoveWorstMs=max(diagnosticMoveWorstMs,(CACurrentMediaTime()-diagnosticStart)*1000)}}
        node.position = CGPoint(x: point.x + fingerOffset.x, y: point.y + fingerOffset.y)
        if frameDiagnosticsEnabled {
            let now=CACurrentMediaTime()*1000
            if let stamp=diagnosticDragInput.osTimestampMs {diagnosticDragInput.paintAgeWorst=max(diagnosticDragInput.paintAgeWorst,max(0,now-stamp))}
            if let stamp=diagnosticDragInput.coalescedTimestampMs {diagnosticDragInput.coalescedPaintAgeWorst=max(diagnosticDragInput.coalescedPaintAgeWorst,max(0,now-stamp))}
            diagnosticDragInput.paintedOSTimestampMs=diagnosticDragInput.osTimestampMs
            diagnosticDragInput.paintedCoalescedTimestampMs=diagnosticDragInput.coalescedTimestampMs
            diagnosticExpectedDragNode=node;diagnosticExpectedDragPosition=node.position;diagnosticExpectedDragGeneration=engine.state.generation
        }
        let tile=engine.state.tiles.first(where:{$0.id==id})
        let trailStyle=NativeDragTrailStyle.resolve(core:tile?.gameplayArchetype,variant:tile?.isWild == true ? tile?.variant:nil)
        dragTrail.emit(at:node.position,time:now*1000,scale:geometry?.scale ?? 1,style:trailStyle,reduced:sourceFrames.reducedFx)
        let milliseconds=max(1,(now-lastPointerTime)*1000)
        pointerVelocity.x+=((point.x-lastTouchPoint.x)/milliseconds-pointerVelocity.x)*0.10
        pointerVelocity.y+=((lastTouchPoint.y-point.y)/milliseconds-pointerVelocity.y)*0.10
        let scale=max(0.0001,geometry?.scale ?? 1)
        if hypot(point.x-touchStart.x,point.y-touchStart.y)/scale > 4 {dragMoved=true}
        node.updateIdleDrag(offset:CGPoint(x:(point.x-touchStart.x)/scale,y:(touchStart.y-point.y)/scale),velocity:pointerVelocity)
        lastPointerTime=now
        if node.sourceOuterDriven {node.sourcePointerMoved(filteredVelocity:pointerVelocity)}
        else {node.updateShadow(direction: CGPoint(x: point.x-lastTouchPoint.x, y: point.y-lastTouchPoint.y))}
        lastTouchPoint = point
        guard let geometry,let source=engine.state.tiles.first(where:{$0.id==id}),
              let target=dragTarget(source:source,pointer:nil,now:now) else {clearHover(animated:true);return}
        let geometryKey=CGSize(width:geometry.tileSize,height:geometry.scale)
        if hoverGeometryKey != geometryKey {
            hoverGeometryKey=geometryKey
            // Match app-core's authored PWA hover (not drag-core defaults).
            let side = geometry.tileSize, pad = 3*geometry.scale
            let radius = (NativeBoardGeometry.tile*0.26).rounded()*geometry.scale
            hover.path = CGPath(roundedRect: CGRect(x: -side/2+pad,y: -side/2+pad,width: side-2*pad,height: side-2*pad),
                                cornerWidth: radius,cornerHeight: radius,transform: nil)
            hover.lineWidth = 10*geometry.scale
        }
        if hoverTargetID != target.id {
            let position = geometry.center(row: target.cell.row,column: target.cell.column)
            let resumingExit = hover.action(forKey:"stack-hover-exit") != nil && hoverVisualTargetID == target.id
            hoverVisualTargetID = target.id
            hoverTargetID = target.id; hover.isHidden = false
            hover.position = position
            hover.removeAction(forKey:"stack-hover-enter")
            hover.removeAction(forKey:"stack-hover-exit")
            if !resumingExit {hover.alpha = 0}
            let reveal = SKAction.fadeAlpha(to:1,duration:0.10)
            reveal.timingMode = .easeIn
            hover.run(reveal,withKey:"stack-hover-enter")
        }
    }

    private func dragTarget(source: NativeTile, pointer: CGPoint?,now:TimeInterval=CACurrentMediaTime()) -> NativeTile? {
        guard let geometry else { return nil }
        guard let node = nodesByID[source.id] else {return nil}
        let selected=dragHoverCadence.pick(sourceID:source.id,generation:engine.state.generation,
            revision:engine.state.revision,nowMs:now*1000,force:pointer != nil) {
        let candidates = engine.state.tiles.compactMap { tile -> NativeRegularDropTarget.Candidate? in
            guard tile.id != source.id, NativeGameplayResolver.canDrop(source,onto:tile),
                  NativeTutorialRules.allowsDrop(source:source,destination:tile,tutorial:engine.state.tutorial,rows:engine.state.rows),
                  let target = nodesByID[tile.id], !tile.transientSpawn else { return nil }
            let width=source.isWild ? NativeBoardGeometry.tile*abs(target.xScale):geometry.tileSize
            let height=source.isWild ? NativeBoardGeometry.tile*abs(target.yScale):geometry.tileSize
            return .init(id:tile.id,bounds:source.isWild ? target.dragContactBounds:target.calculateAccumulatedFrame(),
                         pointerBounds:CGRect(x:target.position.x-width/2,y:target.position.y-height/2,width:width,height:height))
        }
        if source.isWild {
            let policy:NativeSpecialDropTarget.Policy = source.gameplayArchetype == .magnet ? .magnet:
                source.variant == "barell" ? .barrel:.direct
            let bounds:CGRect
            if policy == .barrel {
                // v9 deliberately excludes the Barrel's transparent jump canvas.
                let width=NativeBoardGeometry.tile*abs(node.xScale),height=NativeBoardGeometry.tile*abs(node.yScale)
                bounds=CGRect(x:node.position.x-width/2,y:node.position.y-height/2,width:width,height:height)
            } else {bounds=node.dragContactBounds}
            return NativeSpecialDropTarget.pick(source:bounds,center:node.position,candidates:candidates,
                pointer:pointer,tileSize:geometry.tileSize,policy:policy)
        }
        return NativeRegularDropTarget.pick(source:node.calculateAccumulatedFrame(),candidates:candidates,pointer:pointer,tileSize:geometry.tileSize)
        }
        return selected.flatMap {id in engine.state.tiles.first {$0.id==id && !$0.transientSpawn &&
            nodesByID[id]?.parent === canvasRoot && NativeGameplayResolver.canDrop(source,onto:$0) &&
            NativeTutorialRules.allowsDrop(source:source,destination:$0,tutorial:engine.state.tutorial,rows:engine.state.rows)}}
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        if let binding=sourceMicrotaskInstallation {
            _=binding.inputTask{[self] in sourceTouchesEnded(touches,with:event)}
        } else {sourceTouchesEnded(touches,with:event)}
    }
    private func sourceTouchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        sourceCallbackTime();sourceFrames.pointerEnded()
        guard let touch = activeTouch, touches.contains(touch) else { return }
        finishDrag(at:touchLocationInGameplayScene(touch),now:CACurrentMediaTime())
    }

    @discardableResult
    func finishDrag(at point: CGPoint, now: TimeInterval) -> NativeMoveResult? {
        guard !sourceDisposalInProgress else {return nil }
        sourceCallbackTime();sourceFrames.pointerEnded()
        guard !disposed,let id=draggedID else{return nil}
        let pendingSourceMove=sourceDragMoves?.hasPendingSample==true
        retireSourceDragMoves()
        // Accepted v9 interaction: consume the real release sample before lookup.
        let releasePoint=canvasRoot.convert(point,from:self)
        if pendingSourceMove || releasePoint != lastTouchPoint {moveDrag(to:point,now:now)}
        let point=releasePoint,moved=dragMoved
        let tile=engine.state.tiles.first(where:{$0.id==id})
        let target=moved ? tile.flatMap{dragTarget(source:$0,pointer:point,now:now)?.cell}:nil
        let oldState = engine.state
        let heldOrigin=sourceHeldOrigin;sourceHeldOrigin=nil
        let source = nodesByID[id]
        let sourcePosition = source?.position
        let sourceVisual = sourceSameNodeStackAbsorbsEnabled ? nil:source?.detachedArtworkCarrier()
        activeTouch = nil; draggedID = nil; source?.setDragging(false,sourceOuterTransform:source?.sourceOuterDriven == true)
        if source?.sourceOuterDriven==true {
            source?.sourcePointerUp()
            if let heldOrigin,heldOrigin.tileID==id,heldOrigin.generation==engine.state.generation {source?.zPosition=heldOrigin.zPosition}
        }
        publishFishIdleFrames(force:true)
        onPointerState?(false)
        clearHover(animated:true)
        // Reject unadmitted presentation BEFORE gameplay capture, value/score,
        // RNG or revision mutation. Full Six/direct80 waits its exact destructive
        // callback owner; never disguise a killed tween as arrival.
        if sourceSameNodeStackAbsorbsEnabled,(!sourceRegularStackHandoffEnabled || engine.pendingOrdinaryStack==nil),let sourceTile=oldState.tiles.first(where:{$0.id==id}),let target,let destinationTile=oldState.tile(at:target) {
            let bounded = (!sourceTile.isWild && !destinationTile.isWild && sourceTile.value+destinationTile.value<6) || sourceSixReady(source:sourceTile,destination:destinationTile,generation:oldState.generation) || sourceDirectReady(source:sourceTile,destination:destinationTile,generation:oldState.generation) || sourceMagnetMainReady(sourceTile,destinationTile,generation:oldState.generation) || sourceTntMainReady(sourceTile,destinationTile,generation:oldState.generation)
            let handoffReady = !sourceRegularStackHandoffEnabled || (sourceStackDecisionMatches(oldState,source:sourceTile,destination:destinationTile) && nodesByID[destinationTile.id].map{sourceStackFrameReady($0,generation:oldState.generation)}==true)
            let ready = handoffReady && bounded && source?.sourceOuterDriven==true && sourceDragTweenDriver != nil && sourceContactVisualRandom != nil && !sourceOuterTearingDown && (sourceSixReady(source:sourceTile,destination:destinationTile,generation:oldState.generation) || sourceDirectReady(source:sourceTile,destination:destinationTile,generation:oldState.generation) || sourceMagnetMainReady(sourceTile,destinationTile,generation:oldState.generation) || sourceTntMainReady(sourceTile,destinationTile,generation:oldState.generation) || sourceStackAbsorbAdmission?(sourceTile,destinationTile)==true) && !disposed && !sourceOuterTearingDown && sourceDragTweenDriver != nil && sourceContactVisualRandom != nil && source?.parent === canvasRoot && nodesByID[id] === source && source?.sourceContactNodeAlive==true && source?.sourceGeneration==oldState.generation && engine.state.generation==oldState.generation && (!sourceRegularStackHandoffEnabled || sourceStackDecisionMatches(oldState,source:sourceTile,destination:destinationTile))
            if !ready {
                if !sourceRegularStackHandoffEnabled || (engine.state.generation==oldState.generation && engine.state.revision==oldState.revision) {engine.cancelDrag()}
                let rejection=NativeMoveResult(accepted:false,state:engine.state,events:[NativeGameplayEvent(.blocked,tileIDs:[id],reason:"source_same_node_absorb_not_admitted")],resolution:engine.resolve())
                if let source,let heldOrigin,(!sourceRegularStackHandoffEnabled || (engine.state.generation==oldState.generation && source.sourceGeneration==oldState.generation && nodesByID[id] === source && source.parent === canvasRoot)) {
                    let generation=engine.state.generation
                    _ = source.beginSourceReturn(to:heldOrigin.position,onCompleted:{[weak self,weak source] in guard let self,!self.disposed,self.engine.state.generation==generation else{return};source?.sourceSnapBackCompleted();if let source,self.sourceTutorialTargetCurrent(source){self.onSourceGuidedSnapBack?(source)}})
                }
                traceSourceMagnetContact("drop_presentation_refused",id:id,target:target,result:rejection)
                consume(rejection,previous:oldState,preserveRejectedPosition:id);return rejection
            }
        }
        let preDebitEpoch=sourceOrdinaryPreDebitEpoch
        var preDebitContact:SourcePreDebitContact?
        if sourceOrdinaryPreDebitPresentationEnabled,let target,
            let srcModel=oldState.tiles.first(where:{$0.id==id}),let dstModel=oldState.tiles.first(where:{$0.cell==target}),
            !srcModel.isWild,!dstModel.isWild,srcModel.value+dstModel.value<6 {
            guard let contact=captureSourcePreDebitContact(sourceID:id,destinationID:dstModel.id,generation:oldState.generation),
                sourceAnimationBindingAdmissionOpen,sourceOrdinaryPreDebitEpoch==preDebitEpoch,
                engine.state==oldState,sourceOrdinaryPreDebitPresentationEnabled else {
                let rejected=NativeMoveResult(accepted:false,state:engine.state,events:[.init(.blocked,tileIDs:[id],reason:"source_predebit_contact_not_admitted")],resolution:engine.resolve())
                if engine.state.generation==oldState.generation {engine.cancelDrag()}
                traceSourceMagnetContact("drop_predebit_refused",id:id,target:target,result:rejected)
                return rejected
            }
            preDebitContact=contact
        }
        let result = engine.drop(target: target, pointerID: 1, now: now)
        if result.accepted,let target,let destination=oldState.tile(at:target),let node=nodesByID[destination.id] {
            shortWildBoardBlast?.interrupt(node)
        }
        if result.accepted,let contact=preDebitContact,sourceOrdinaryPreDebitEpoch==preDebitEpoch,
            sourceAnimationBindingAdmissionOpen,let plan=engine.pendingOrdinaryStack,
            plan.source.id==id,plan.destination.id==contact.destination.tileID,plan.generation==contact.generation {
            sourcePreDebitContacts[plan.id]=contact
        }
        if let transactions=sourceSpecialTransactions {
            if result.accepted {_ = transactions.acceptedContact(result,direct:engine.pendingDirectWild,special:engine.pendingSpecial)}
            else {transactions.rejectedContact()}
        }
        if !result.accepted {
            traceSourceMagnetContact("drop_engine_refused",id:id,target:target,result:result)
            if let tile = oldState.tiles.first(where: { $0.id == id }), let geometry, let source {
                let captured=heldOrigin
                let destination = source.sourceOuterDriven && captured?.tileID==id && captured?.generation==engine.state.generation ? captured!.position:geometry.center(row: tile.cell.row, column: tile.cell.column)
                if source.sourceOuterDriven {
                    let generation=engine.state.generation
                    _ = source.beginSourceReturn(to:destination,onCompleted:{[weak self,weak source] in
                        guard let self,!self.disposed,self.engine.state.generation==generation else{return}
                        source?.sourceSnapBackCompleted();source?.resumeIdleAfterLanding();if let source,self.sourceTutorialTargetCurrent(source){self.onSourceGuidedSnapBack?(source)}
                    })
                } else {
                let action = NativeBoardMotion.move(from: source.position, to: destination, duration: 0.18, ease: .backOut(1.65))
                source.run(action, withKey: "snapback")
                let generation=engine.state.generation
                source.visual.run(.sequence([NativeBoardMotion.rejectedLanding(),.run { [weak self,weak source] in
                    guard let self,self.engine.state.generation==generation,!self.disposed else {return}
                    source?.resumeIdleAfterLanding()
                }]),withKey:"rejected-landing")
                }
            }
            consume(result, previous: oldState, preserveRejectedPosition: id)
        } else {
            if sourceTntMainScope != nil,let plan=engine.pendingSpecial,plan.archetype == .tnt,plan.source.id==id {
                if !startSourceTntMain(plan,result:result,previous:oldState) {onSourcePresentationFailure?("source_tnt_main80_setup_failed",plan.generation)}
                return result
            }
            if sourceMagnetMainScope != nil,let plan=engine.pendingSpecial,plan.archetype == .magnet,plan.source.id==id {
                if !startSourceMagnetMain(plan,result:result,previous:oldState) {onPresentationFailure?("source_magnet_main80_setup_failed")}
                return result
            }
            if sourceDirectWildSameNodeEnabled,let plan=engine.pendingDirectWild,plan.source.id==id {
                if !startSourceDirectContact(plan,result:result,previous:oldState) {onPresentationFailure?("source_direct_main_setup_failed")}
                return result
            }
            if sourceOrdinarySixSameNodeEnabled,let plan=engine.pendingOrdinarySix,plan.source.id==id {
                if !startSourceSixContact(plan,result:result,previous:oldState) {onPresentationFailure?("source_six_main_setup_failed")}
                return result
            }
            // Literal v9 ordinary sub-six disables only the consumed source.
            // Main-six eventMode is not inferred from this branch.
            if source?.sourceOuterDriven==true,engine.pendingOrdinaryStack?.source.id==id {source?.sourceEventMode="none"}
            if sourceSameNodeStackAbsorbsEnabled,let source,let driver=sourceDragTweenDriver,let plan=engine.pendingOrdinaryStack,plan.source.id==id,
               let destination=nodesByID[plan.destination.id] {
                let owner=NativeSourceAcceptedAbsorbOwner(host:source,driver:driver),receipt=beginVisual()
                sourceAcceptedStacks[plan.id]=SourceAcceptedStack(plan:plan,node:source,owner:owner,visual:receipt)
                ordinaryAbsorbs[plan.id]=(source,receipt)
                let ready=owner.begin(destination:destination.position,onAutoScaleInitialize:{[weak source] in source?.killSourceActiveScaleChildren()},onBeforeMainRegistration:{[weak self,weak source] in
                    self?.consume(result,previous:oldState)
                    guard let self,let source,self.sourceAnimationBindingAdmissionOpen,
                        self.engine.state.generation==plan.generation,self.nodesByID[id] === source,
                        source.parent === self.canvasRoot,source.sourceContactNodeAlive,
                        source.sourceGeneration==plan.generation,self.sourceSameNodeStackAbsorbsEnabled else{return}
                    // Actual literal <6 contact, not a generic merged observer.
                    _=self.sourceCanonicalSaveBinding?.notify(.ordinarySubSixContact)
                },isCurrent:{[weak self,weak source] in
                    guard let self,let source else{return false};return !self.disposed && self.engine.state.generation==plan.generation && self.nodesByID[id] === source && source.parent === self.canvasRoot && source.sourceContactNodeAlive && source.sourceGeneration==plan.generation
                },onMainCompleted:{[weak self] in self?.finishSourceAcceptedStack(plan.id,generation:plan.generation,interrupted:false)},onMainInterrupted:{[weak self] in self?.finishSourceAcceptedStack(plan.id,generation:plan.generation,interrupted:true)})
                if !ready {finishSourceAcceptedStack(plan.id,generation:plan.generation,interrupted:true);onPresentationFailure?("source_same_node_absorb_setup_failed")}
                return result
            }
            if let sourceVisual, let sourcePosition, let target, let geometry {
                sourceVisual.removeAllActions()
                sourceVisual.position = sourcePosition; sourceVisual.setScale(geometry.scale)
                sourceVisual.zPosition = 18000; effects.addChild(sourceVisual)
                let receipt = beginVisual()
                let destination = geometry.center(row: target.row,column: target.column)
                let ordinaryPlan=[engine.pendingOrdinaryStack,engine.pendingOrdinarySix].compactMap {$0}.first {$0.source.id==id}
                if let ordinaryPlan {ordinaryAbsorbs[ordinaryPlan.id]=(sourceVisual,receipt)}
                let directPlan=engine.pendingDirectWild.flatMap {$0.source.id==id ? $0:nil}
                sourceVisual.run(.sequence([NativeBoardMotion.move(from: sourcePosition,to: destination,duration: 0.08,ease: .power2Out),
                    .run { [weak self] in
                        if let ordinaryPlan {self?.finishOrdinaryAbsorb(ordinaryPlan)}
                        if let directPlan {self?.finishDirectWildAbsorb(directPlan)}
                        self?.finishVisual(receipt)
                    }, .removeFromParent()]))
            }
            consume(result, previous: oldState)
        }
        return result
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        if let binding=sourceMicrotaskInstallation {
            _=binding.inputTask{[self] in sourceTouchesCancelled(touches,with:event)}
        } else {sourceTouchesCancelled(touches,with:event)}
    }
    private func sourceTouchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        sourceCallbackTime();sourceFrames.pointerEnded()
        if let touch = activeTouch,touches.contains(touch) {cancelDrag(pointerCancelled:true);evaluate()}
    }

    func cancelDrag(pointerCancelled:Bool=false) {
        retireSourceDragMoves()
        dragTrail.end()
        sourceCallbackTime();sourceFrames.pointerEnded()
        let id=draggedID,held=sourceHeldOrigin;sourceHeldOrigin=nil
        activeTouch=nil;draggedID=nil
        let matchingSourceGeneration = sourceDisposalGeneration == nil || sourceDisposalGeneration == engine.state.generation
        if matchingSourceGeneration {engine.cancelDrag()}
        if id != nil {onPointerState?(false)}
        clearHover(animated:pointerCancelled && !sourceDisposalInProgress && !disposed && !exitInProgress)
        // onPointerState is external and can restart the shared engine. The
        // captured pre-callback permit cannot authorize painting a new run.
        if matchingSourceGeneration,(sourceDisposalGeneration == nil || sourceDisposalGeneration == engine.state.generation),let id,let node=nodesByID[id],let tile=engine.state.tiles.first(where:{$0.id==id}),let geometry {
            node.setDragging(false,sourceOuterTransform:node.sourceOuterDriven)
            node.zPosition=node.sourceOuterDriven && held?.tileID==id && held?.generation==engine.state.generation ? held!.zPosition:(tile.isWild ? 12001:CGFloat(tile.cell.row*engine.state.columns+tile.cell.column))
            if node.sourceOuterDriven {
                // Literal cancelActive/cleanup clears pointer/family ownership
                // without a new position/scale/shadow return. Pure pause never
                // calls this destructive path. UIKit pointercancel is onCancel.
                if pointerCancelled,let held,held.tileID==id,held.generation==engine.state.generation {
                    let generation=held.generation
                    _ = node.beginSourceReturn(to:held.position,onCompleted:{[weak self,weak node] in
                        guard let self,!self.disposed,self.engine.state.generation==generation else{return}
                        node?.sourceSnapBackCompleted();node?.resumeIdleAfterLanding();if let node,self.sourceTutorialTargetCurrent(node){self.onSourceGuidedSnapBack?(node)}
                    })
                }
            } else {
                node.removeAllActions();node.position=geometry.center(row:tile.cell.row,column:tile.cell.column)
            }
        }
        publishFishIdleFrames(force:true)
    }

    func prepareFishMedia(tileID:String,generation:UInt64) {
        guard !disposed,engine.state.generation==generation else {return}
        nodesByID[tileID]?.prepareFishMediaPhase();publishFishIdleFrames(force:true)
    }
    func setFishMediaReady(tileID:String,generation:UInt64,ready:Bool) {
        guard !disposed,engine.state.generation==generation else {return}
        nodesByID[tileID]?.setFishMediaReady(ready);publishFishIdleFrames(force:true)
    }
    private func publishFishIdleFrames(force:Bool=false) {
        guard !sourceDisposalInProgress else {return}
        guard !disposed else {return}
        var frames:[String:NativeFishIdleFrame]=[:]
        for (id,node) in nodesByID {
            if let frame=node.fishFrame(in:self,visible:gameplayRenderHost != nil && !suspended && (exitInProgress || engine.state.terminal==nil) && !specialPresentationIDs.contains(id)) {frames[id]=frame}
        }
        onFishIdleFrames?(frames,engine.state.generation,force || exitInProgress || completedExitGeneration == engine.state.generation)
    }

    private func clearHover(animated:Bool=false) {
        guard hoverTargetID != nil || !hover.isHidden else { return }
        if animated {
            // Clear target admission now; only its visual receipt fades out.
            // Repeated invalid move samples must not restart the exit clock.
            guard hoverTargetID != nil else {return}
            hoverTargetID = nil
            hover.removeAction(forKey:"stack-hover-enter")
            let fade = SKAction.fadeAlpha(to:0,duration:0.18)
            fade.timingMode = .easeInEaseOut
            hover.run(.sequence([fade,.hide()]),withKey:"stack-hover-exit")
        } else {
            hover.removeAction(forKey:"stack-hover-enter")
            hover.removeAction(forKey:"stack-hover-exit")
            hover.alpha = 0; hoverTargetID = nil; hoverVisualTargetID = nil; hover.isHidden = true
        }
    }

    private func consume(_ result: NativeMoveResult, previous: NativeBoardState, preserveRejectedPosition: String? = nil) {
        guard !sourceDisposalInProgress else {return}
        cancelCandidate(clearNativeText:nativeNoMovesExitCapture?.generation != result.state.generation)
        let rejectedPosition = preserveRejectedPosition.flatMap { nodesByID[$0]?.position }
        sourceMeterQueue?.receive(result)
        if sourceMeterQueue != nil {guard sourceAnimationBindingAdmissionOpen,engine.state.generation==result.state.generation else{return}}
        sourceMeterCaller?.receive(result)
        if sourceMeterCaller != nil || sourceMeterTearingDown {guard sourceAnimationBindingAdmissionOpen,engine.state.generation==result.state.generation else{return}}
        if result.accepted,result.events.contains(where:{$0.kind == .meterDropChargeConsumed}),
            let owner=sourceTutorialMeterHUD,sourceMeterHUDScope?.current==true {
            // Exact Source consumeWildCharge event, rather than guessing a
            // drain from any logical decrease/reset. Cache before HUD redraw.
            sourceTutorialMeterRatio=result.state.wildMeter
            owner.consume(result.state.wildMeter,reducedMotion:false)
        }
        // Literal setValue schedules ONE actual RAF before contact. Its immediate
        // value is visible now; old stack objects/depth remain until that callback.
        if sourceRegularStackHandoffEnabled,sourceSameNodeStackAbsorbsEnabled {
            for event in result.events where event.kind == .merged && event.archetype==nil && (event.value ?? 6)<6 {
                guard let sourceID=event.tileIDs.first,sourceAcceptedStackOwns(sourceID,generation:previous.generation),let destinationID=event.tileIDs.dropFirst().first,let target=nodesByID[destinationID],let source=previous.tiles.first(where:{$0.id==sourceID}),let value=event.value,let service=sourceStackFrameService,let random=sourceContactVisualRandom,sourceStackFrameReady(target,generation:previous.generation) else{continue}
                let generation=previous.generation
                let face = sourceStackCoreFaceReceiptsEnabled ? engine.pendingSourceOrdinaryStackFaces.first(where:{$0.ordinaryMoveID==engine.pendingOrdinaryStack?.id && $0.destinationID==destinationID && $0.generation==generation}):nil
                if sourceStackCoreFaceReceiptsEnabled && face==nil {onPresentationFailure?("source_core_face_receipt_missing");return}
                var observation:(NativeMoveResult,NativeBoardState)?
                let physical:(()->Bool)? = face.map {face in { [weak self,weak target] in
                    guard let self,let target,self.sourceAnimationBindingAdmissionOpen,self.engine.state.generation==generation,self.nodesByID[destinationID] === target,target.parent === self.canvasRoot,target.sourceGeneration==generation else{return false}
                    let before=self.engine.state,result=self.engine.commitSourceOrdinaryStackFace(receiptID:face.id,generation:generation)
                    if result.accepted {observation=(result,before)}
                    return result.accepted
                }}
                let finished:(()->Void)? = face.map { _ in { [weak self,weak target] in
                    guard let self,let target,self.sourceAnimationBindingAdmissionOpen,self.engine.state.generation==generation,self.nodesByID[destinationID] === target,target.parent === self.canvasRoot,let captured=observation else{return}
                    observation=nil
                    self.consume(captured.0,previous:captured.1)
                    self.resumeSourceFacePostchecks(generation:generation)
                }}
                let cancelled:(()->Void)? = face.map {face in { [weak self] in
                    guard let self,self.engine.state.generation==generation else{return}
                    _=self.engine.cancelSourceOrdinaryStackFace(receiptID:face.id,generation:generation)
                }}
                let admitted=target.queueSourceStackValue(value,addStack:source.stackDepth,service:service,random:random,current:{[weak self,weak target,weak service] in
                    guard let self,let target,let service else{return false}
                    return self.sourceAnimationBindingAdmissionOpen && self.sourceStackFrameService === service && service.sourceFrameTransportAdmissionOpen && self.engine.state.generation==generation && self.nodesByID[destinationID] === target && target.parent === self.canvasRoot && target.sourceGeneration==generation
                },onPhysicalCommit:physical,onFinished:finished,onCancelled:cancelled)
                if !admitted {onPresentationFailure?("source_stack_face_frame_not_admitted")}
                guard sourceAnimationBindingAdmissionOpen,engine.state.generation==generation else{return}
            }
        }
        synchronize()
        if result.accepted,!exitInProgress,engine.state.terminal==nil,
           result.events.contains(where:{$0.kind == .comboChanged}),result.state.combo>0 {
            let merge=result.events.first{$0.kind == .merged}
            let special=result.events.first{$0.kind == .specialBoardCommitted}
            // TNT's later board commit repeats its already-counted combo event.
            let newContact=result.state.combo != previous.combo || merge != nil || special.map{$0.archetype != .tnt} == true || (special == nil && engine.pendingSpecial?.archetype == .tnt)
            if newContact {
                let six:Bool
                if let merge {six=merge.value == 6}
                else if let special {six=special.archetype != .magnet}
                else {six=engine.pendingSpecial?.archetype == .tnt}
                comboNumberMotion.bump(kind:six ? .mergeSix:.stack,combo:result.state.combo,
                    generation:result.state.generation,reducedMotion:UIAccessibility.isReduceMotionEnabled)
            }
        }
        if let id = preserveRejectedPosition, let rejectedPosition { nodesByID[id]?.position = rejectedPosition }
        for event in result.events {
            guard !sourceDisposalInProgress else {return}
            // Internal Source request dispatches before generic event observers;
            // actual active token +Date must precede prepare scheduling. This
            // request itself is never a Date/ownership capability.
            if event.kind == .sourceOrdinarySixSpawnOwnerBeginRequested {
                let selected=sourceOrdinarySixSpawnScope,epoch=sourceEndgameMutationEpoch
                guard acceptSourceOrdinarySixSpawnBegin(event:event,generation:result.state.generation) else {
                    if sourceAnimationBindingAdmissionOpen,sourceOrdinarySixSpawnScope === selected,selected?.current==true,
                        sourceEndgameMutationEpoch==epoch,engine.state.generation==result.state.generation {
                        onPresentationFailure?("source_ordinary_spawn_owner_begin_refused")
                    }
                    return
                }
                continue
            }
            if event.kind == .specialBoardCommitted,let id=event.reason,let entry=sourceMagnetMainEntries[id] {retireSourceSpecialMainEntry(entry)}
            let deferSourceContactAudio=sourceRegularContactCompanions != nil && sourceSameNodeStackAbsorbsEnabled && event.kind == .merged && event.archetype==nil && (event.value ?? 6)<6 && event.tileIDs.first.map{sourceAcceptedStackOwns($0,generation:previous.generation)}==true
            if !deferSourceContactAudio {onGameplayEvent?(event)}
            guard !sourceDisposalInProgress else {return}
            let source = event.tileIDs.first.flatMap { id in previous.tiles.first { $0.id == id } }
            let destination = event.tileIDs.dropFirst().first.flatMap { id in previous.tiles.first { $0.id == id } }
            if !deferSourceContactAudio {onGameplayReceipt?(event,source,destination,previous.generation)}
            guard !sourceDisposalInProgress else {return}
            switch event.kind {
            case .sourceOrdinarySixSpawnOwnerBeginRequested:break
            case .ordinarySpawnsPrepareRequested:
                if let plan=engine.pendingOrdinarySix,event.reason==plan.id {
                    scheduleOrdinaryCommand(key:"prepare:"+plan.id,generation:plan.generation,delay:Double(event.value ?? 50)/1000) { [weak self] in
                        guard let self else {return}
                        let previous=self.engine.state
                        self.consume(self.engine.prepareOrdinarySpawns(receiptID:plan.id,generation:plan.generation),previous:previous)
                        self.releaseOrdinarySixIfReady()
                    }
                }
            case .sourceOrdinaryEndgameResumePrepared:
                guard let scope=sourceOrdinaryMinimumScope,scope.current,
                      let receipt=engine.pendingSourceOrdinaryEndgameResume,receipt.id.uuidString==event.reason,
                      let installation=sourceMicrotaskInstallation,installation.isCurrent else {
                    onSourcePresentationFailure?("source_ordinary_endgame_resume_not_bound",engine.state.generation);return
                }
                guard installation.enqueue({[weak self,weak scope,weak installation] in
                    guard let self,let scope,let installation,self.sourceAnimationBindingAdmissionOpen,scope.current,
                          self.sourceOrdinaryMinimumScope === scope,self.sourceMicrotaskInstallation === installation,
                          installation.isCurrent,self.engine.pendingSourceOrdinaryEndgameResume==receipt else{return}
                    let previous=self.engine.state,result=self.engine.resumeSourceOrdinaryEndgame(receipt)
                    guard result.accepted else {self.onSourcePresentationFailure?("source_ordinary_endgame_resume_refused",receipt.generation);return}
                    self.consume(result,previous:previous)
                }) else {onSourcePresentationFailure?("source_ordinary_endgame_resume_fifo_refused",receipt.generation);return}
            case .sourceOrdinaryEndgameVerificationPrepared:
                guard let scope=sourceOrdinaryMinimumScope,scope.current,
                      let receipt=engine.pendingSourceOrdinaryEndgameVerification,receipt.id.uuidString==event.reason,
                      let installation=sourceMicrotaskInstallation,installation.isCurrent else {
                    onSourcePresentationFailure?("source_ordinary_endgame_verification_not_bound",engine.state.generation);return
                }
                guard installation.enqueue({[weak self,weak scope,weak installation] in
                    guard let self,let scope,let installation,self.sourceAnimationBindingAdmissionOpen,scope.current,
                          self.sourceOrdinaryMinimumScope === scope,self.sourceMicrotaskInstallation === installation,
                          installation.isCurrent,self.engine.pendingSourceOrdinaryEndgameVerification==receipt else{return}
                    let previous=self.engine.state,result=self.engine.verifySourceOrdinaryEndgamePrimary(receipt)
                    guard result.accepted else {
                        if scope.current,self.engine.state.generation==receipt.generation {
                            self.onSourcePresentationFailure?("source_ordinary_endgame_physical_verification_refused",receipt.generation)
                        }
                        return
                    }
                    self.consume(result,previous:previous)
                }) else {onSourcePresentationFailure?("source_ordinary_endgame_verification_fifo_refused",receipt.generation);return}
            case .sourceOrdinaryEndgameCoroutineSettled:
                guard let ownerID=event.reason,engine.sourceOrdinaryEndgameCoroutineEnabled,
                      engine.pendingOrdinarySix?.id==ownerID else{return}
                enqueueSourceOrdinaryMinimumFinally(ownerID:ownerID,generation:result.state.generation)
            case .sourceOrdinaryMinimumPhasePrepared:
                guard let scope=sourceOrdinaryMinimumScope,scope.current,
                      let receipt=engine.pendingSourceOrdinaryMinimumPhase,receipt.id.uuidString==event.reason,
                      let installation=sourceMicrotaskInstallation,installation.isCurrent else {
                    onSourcePresentationFailure?("source_ordinary_minimum_phase_producer_not_bound",engine.state.generation);return
                }
                guard installation.enqueue({[weak self,weak scope,weak installation] in
                    guard let self,let scope,let installation,self.sourceAnimationBindingAdmissionOpen,scope.current,
                          self.sourceOrdinaryMinimumScope === scope,self.sourceMicrotaskInstallation === installation,
                          installation.isCurrent,self.engine.pendingSourceOrdinaryMinimumPhase==receipt else{return}
                    guard self.sourceOrdinaryMinimumCaptureBound else {
                        self.onSourcePresentationFailure?("source_ordinary_minimum_capture_missing",receipt.generation);return
                    }
                    for model in self.engine.state.tiles {
                        guard let node=self.nodesByID[model.id],node.parent === self.canvasRoot,
                              node.sourceGeneration==receipt.generation,node.sourcePhysicalMarkersCovered else {
                            self.onSourcePresentationFailure?("source_ordinary_minimum_markers_missing",receipt.generation);return
                        }
                    }
                    let previous=self.engine.state,result=self.engine.advanceSourceOrdinaryMinimumPhase(receipt)
                    guard self.engine.state.generation==receipt.generation,scope.current,self.sourceOrdinaryMinimumScope === scope,
                          self.sourceMicrotaskInstallation === installation,installation.isCurrent else{return}
                    guard result.accepted else {self.onSourcePresentationFailure?("source_ordinary_minimum_phase_rejected",receipt.generation);return}
                    self.consume(result,previous:previous)
                    if self.engine.pendingSourceOrdinaryMinimumPhase==nil {
                        self.enqueueSourceOrdinaryMinimumFinally(ownerID:receipt.ownerID,generation:receipt.generation)
                    }
                }) else {onSourcePresentationFailure?("source_ordinary_minimum_phase_fifo_rejected",receipt.generation);return}
            case .sourceOrdinaryLockedSettlementPrepared:
                guard let receipt=engine.pendingSourceOrdinaryLockedSettlement,receipt.id.uuidString==event.reason,
                      let installation=sourceMicrotaskInstallation,installation.isCurrent else {
                    onSourcePresentationFailure?("source_ordinary_locked_settlement_fifo_missing",engine.state.generation);return
                }
                guard installation.enqueue({[weak self,weak installation] in
                    guard let self,let installation,self.sourceAnimationBindingAdmissionOpen,
                          self.sourceMicrotaskInstallation === installation,installation.isCurrent else{return}
                    let minimum=self.engine.pendingSourceOrdinaryMinimumPhase
                    let previous=self.engine.state
                    let result=self.engine.continueSourceOrdinaryLockedSettlement(receipt)
                    guard result.accepted else {
                        if self.engine.pendingSourceOrdinaryLockedSettlement==receipt {
                            self.onSourcePresentationFailure?("source_ordinary_locked_continuation_rejected",receipt.generation)
                        }
                        return
                    }
                    self.consume(result,previous:previous);self.releaseOrdinarySixIfReady()
                    if let minimum,self.engine.pendingSourceOrdinaryMinimumPhase==nil {
                        self.enqueueSourceOrdinaryMinimumFinally(ownerID:minimum.ownerID,generation:minimum.generation)
                    }
                }) else {onSourcePresentationFailure?("source_ordinary_locked_settlement_fifo_rejected",engine.state.generation);return}
            case .ordinaryAssignmentsPrepared:
                startOrdinaryAssignments(ids:event.tileIDs)
            case .ordinaryDestinationCleanupPrepared:
                if let plan=engine.pendingOrdinarySix,event.reason==plan.id {
                    scheduleOrdinaryCommand(key:"cleanup:"+plan.id,generation:plan.generation,delay:Double(event.value ?? 100)/1000) { [weak self] in
                        guard let self,self.engine.pendingOrdinaryDestinationCleanup?.id == plan.id else {return}
                        let previous=self.engine.state
                        self.consume(self.engine.commitOrdinaryDestinationCleanup(receiptID:plan.id,generation:plan.generation),previous:previous)
                        self.releaseOrdinarySixIfReady()
                    }
                }
            case .ordinaryStackReserved:
                if let plan=engine.pendingOrdinaryStack {beginSourceGameplay(.regularMergeHandoff,id:plan.id,generation:plan.generation)}
            case .ordinarySixReserved:
                if let plan=engine.pendingOrdinarySix,ordinarySixVisual==nil {
                    beginSourceGameplay(.mergeSixResolution,id:plan.id,generation:plan.generation)
                    ordinarySixVisual=OrdinarySixVisual(id:plan.id,generation:plan.generation,receipt:beginVisual())
                    if sourceSixContacts[plan.id] != nil {
                        if !playSourceSixHeroAndFace(plan) {sourceSixContacts[plan.id]?.capture?.capturedObjectRetired();onPresentationFailure?("source_six_prefix_setup_failed")}
                    } else {playRegularSixHero(plan)}
                }
            case .ordinaryPostcheckPrepared:
                if let id=event.reason {startOrdinaryPostcheck(id:id)}
            case .merged:
                let regularSix=event.value==6 && event.reason==engine.pendingOrdinarySix?.id
                let sourceStackContact=sourceSameNodeStackAbsorbsEnabled && event.archetype==nil && (event.value ?? 6)<6 && event.tileIDs.first.map{sourceAcceptedStackOwns($0,generation:previous.generation)}==true
                let sourceDirectContact=engine.pendingDirectWild.map{sourceSixContacts[$0.id]?.directPlan != nil}==true
                for id in event.tileIDs {retireSourceSpawns(tileID:id);finishOrdinarySpawnVisual(id);finishWildSpawnVisual(id,interrupted:true);if !regularSix && !sourceStackContact && !sourceDirectContact && nodesByID[id].map{!sourceMagnetMainOwns($0) && !sourceTntMainOwns($0)} != false {nodesByID[id]?.stackFeedback()}}
                if sourceStackContact,let destinationID=event.tileIDs.dropFirst().first,let target=nodesByID[destinationID],let random=sourceContactVisualRandom {
                    // Exact Source contact consumes variant THEN variation, before
                    // neighbour recoil/smoke. Their shared RNG/callsite remain
                    // separately admitted; no fallback Double.random here.
                    let capturedGeneration=previous.generation
                    if let companions=sourceRegularContactCompanions,let sourceID=event.tileIDs.first,let sourceNode=nodesByID[sourceID] {
                        guard companions.prefix(destination:target,generation:capturedGeneration),!disposed,engine.state.generation==capturedGeneration else{onPresentationFailure?("source_stack_click_setup_failed");continue}
                        let motion=NativeMergeImpactMotion(variantDraw:random(),variationDraw:random())
                        guard target.beginSourceMergeImpact(motion),!disposed,engine.state.generation==capturedGeneration,let geometry else{onPresentationFailure?("source_stack_impact_setup_failed");continue}
                        guard companions.suffix(source:sourceNode,destination:target,tiles:engine.state.tiles,nodes:nodesByID,destroyedTileIDs:Set(engine.noMovesTileRuntime.compactMap{ $0.value.destroyed ? $0.key:nil }),canvas:canvasRoot,generation:capturedGeneration,tileSize:geometry.tileSize,renderScale:geometry.scale,reduced:sourceFrames.reducedFx,current:{[weak self,weak target] generation in
                            guard let self,let target else{return false};return !self.disposed && self.engine.state.generation==generation && self.nodesByID[target.tileID] === target && target.parent === self.canvasRoot
                        }) else{onPresentationFailure?("source_stack_suffix_setup_failed");continue}
                        // Literal v9 playOrdinaryStackSound8325 follows the full
                        // contact owner; deliver the existing semantic event once.
                        if deferSourceContactAudio {onGameplayEvent?(event);onGameplayReceipt?(event,source,destination,capturedGeneration)}
                        if sourceRegularStackHandoffEnabled {
                            // Original8325 authored audio precedes OLD-child overlays,
                            // alternating rotation and delayed fade. Capture exact target.
                            guard sourceAnimationBindingAdmissionOpen,engine.state.generation==capturedGeneration,nodesByID[destinationID] === target,target.parent === canvasRoot,let source,let service=sourceStackFrameService,service.sourceFrameTransportAdmissionOpen else{return}
                            let feedback:NativeRegularStackFeedbackNodeBridge
                            if let existing=sourceStackFeedback[destinationID] {feedback=existing}
                            else {
                                feedback=NativeRegularStackFeedbackNodeBridge(tile:target,service:service,current:{[weak self,weak target,weak service] in
                                    guard let self,let target,let service else{return false}
                                    return self.sourceAnimationBindingAdmissionOpen && self.sourceStackFrameService === service && self.engine.state.generation==capturedGeneration && self.nodesByID[destinationID] === target && target.parent === self.canvasRoot
                                });sourceStackFeedback[destinationID]=feedback
                            }
                            if !feedback.play(sourceDepth:source.stackDepth,random:random) {onPresentationFailure?("source_stack_old_feedback_not_admitted")}
                            guard sourceAnimationBindingAdmissionOpen,engine.state.generation==capturedGeneration else{return}
                        }
                    } else {
                        // Retained bounded component-test seam, not full product
                        // admission; parent must configure real companions.
                        if let sourceID=event.tileIDs.first,let source=nodesByID[sourceID] {onSourceStackContactPrefix?(source,target,random)}
                        let motion=NativeMergeImpactMotion(variantDraw:random(),variationDraw:random())
                        if !target.beginSourceMergeImpact(motion) {onPresentationFailure?("source_stack_impact_setup_failed")}
                        if let sourceID=event.tileIDs.first,let source=nodesByID[sourceID] {onSourceStackContactSuffix?(source,target,random)}
                    }
                }
                if regularSix,let plan=engine.pendingOrdinarySix {
                    if sourceSixContacts[plan.id] != nil {if !playSourceSixMain(plan) {onPresentationFailure?("source_six_main_visual_not_admitted")}}
                    else {playRegularSixMain(plan)}
                }
                else if event.value == 6 && engine.pendingSpecial == nil {
                    let tile = event.tileIDs.reversed().compactMap { id in previous.tiles.first { $0.id == id } }.first
                    let carrier = event.tileIDs.compactMap { id in previous.tiles.first { $0.id == id } }.first { $0.isWild }
                    let sourcePrefixBlast=engine.pendingDirectWild.flatMap{sourceSixContacts[$0.id]}?.shortWildBlastAdmitted == true
                    if !sourcePrefixBlast,(event.archetype == .star || event.archetype == .juice),let tile,let geometry,
                       let sourceID=event.tileIDs.first,let destinationID=event.tileIDs.last {
                        playShortWildBoardBlast(sourceID:sourceID,destinationID:destinationID,
                            center:geometry.center(row:tile.cell.row,column:tile.cell.column))
                    }
                    if let variant = event.variant,["fish","bottle","honey","spaceship","laser-gun","flower","barell","beach-ball","kanta","bee","cubero","mushroom","robo-cube"].contains(variant),let tile,let geometry,
                       authoredFinale(variant,at: geometry.center(row: tile.cell.row,column: tile.cell.column)) {
                        // Native media/glyph owner holds its own visible receipt.
                    } else if event.archetype == .tnt && carrier?.variant == nil {
                        coreTntFinale()
                    } else if event.archetype == .star && carrier?.variant == nil {
                        coreStarFinale()
                    } else if event.archetype == .juice && carrier?.variant == nil {
                        coreJuiceFinale()
                    } else if event.archetype == .magnet && carrier?.variant == nil {
                        coreMagnetFinale()
                    } else if let tile, let geometry {
                        smoke(at: geometry.center(row: tile.cell.row, column: tile.cell.column), special: event.archetype != nil)
                    }
                }
            case .mergeSixAbsorbInterrupted:
                if let id=event.reason {sourceSpecialTransactions?.absorbInterrupted(id:id,generation:previous.generation)}
            case .directWildReserved:
                if let plan=engine.pendingDirectWild {
                    wildSourceResolution=(plan.id,plan.generation)
                    beginSourceGameplay(.mergeSixResolution,id:plan.id,generation:plan.generation)
                    if sourceSixContacts[plan.id]?.directPlan != nil {
                        if !prepareSourceDirectPrefix(plan) {sourceSixContacts[plan.id]?.capture?.capturedObjectRetired();onPresentationFailure?("source_direct_prefix_setup_failed")}
                    } else {playDirectWild(plan)}
                }
            case .wildSpawnActionsPrepared:
                startWildSpawnActions(ids:event.tileIDs)
            case .wildLockedBonusPrepared:
                startWildLockedBonus(ids:event.tileIDs)
            case .wildRecoveryCheckPrepared:
                if let id=event.reason {startWildRecoveryCheck(id:id)}
            case .meterRewardPrepared:
                startMeterRewards(ids: event.tileIDs)
            case .hudStarsPrepared:
                startHUDStarFlights(ids: event.tileIDs,lead: event.archetype == .magnet && engine.pendingSpecial != nil ? 0.2 : 0)
            case .specialReserved:
                if let plan = engine.pendingSpecial { playReservedSpecial(plan) }
            case .specialImpact:
                var paintedIDs=Set<String>()
                for id in event.tileIDs where paintedIDs.insert(id).inserted { if let node = nodesByID[id] {
                    if sourceTntBonusBounces[id] != nil {
                        guard startSourceOrdinaryOpenBounce(node,completed:{[weak self] in
                            guard let callback=self?.sourceTntBonusBounces.removeValue(forKey:id) else{return};callback()
                        }) else {onSourcePresentationFailure?("source_tnt_bonus_bounce_not_admitted",engine.state.generation);return}
                        continue
                    }
                    if sourceStackCoreFaceReceiptsEnabled,node.sourceOuterDriven,
                       let variant=event.variant,["flower","barell","beach-ball"].contains(variant) {
                        // These replacements borrow the Source fresh constructor,
                        // whose initial .30 scale lives on the outer carrier.
                        // An inner SKAction cannot settle that captured scale.
                        guard startSourceOrdinaryOpenBounce(node,completed:{}) else {
                            onSourcePresentationFailure?("source_authored_tnt_bonus_bounce_not_admitted",engine.state.generation);return
                        }
                        continue
                    }
                    node.visual.setScale(0.30)
                    if let completed=laserSpawnCallbacks.removeValue(forKey:id) {
                        runSourceSpawn(node,key:"special-impact-spawn",postDelay:0.05,settleOnInterruption:true,completion:completed)
                    } else {runSourceSpawn(node,key:"special-impact-spawn")}
                } }
            case .spawned:
                if sourceMagnetSurvivorOwnsSpawn(event) || sourceMagnetFallbackCallers.values.contains(where:{$0.ownsSpawnEvent(event)}) || sourceMagnetNormalCallers.values.contains(where:{$0.ownsSpawnEvent(event)}) {continue}
                for id in event.tileIDs {
                    guard let node=nodesByID[id] else {continue}
                    if engine.pendingWildLockedBonusPresentations.contains(where:{$0.tileID==id && $0.generation==engine.state.generation}) && event.value==0 {continue}
                    if let presentation=engine.pendingWildSpawnPresentations.first(where:{$0.tileID==id && $0.generation==engine.state.generation}) {
                        startWildSpawnVisual(presentation,node:node,actionID:event.reason ?? presentation.tileID)
                        continue
                    }
                    if let actionID=event.reason,wildScheduledActionIDs.contains(actionID) {
                        // A source fallback value assignment without a bounce
                        // receipt is plain logical normalization, never generic FX.
                        finishWildSpawnVisual(id,interrupted:true)
                        node.visual.setScale(1);node.visual.zRotation=0
                        continue
                    }
                    let sourceOrdinaryOpen=sourceStackCoreFaceReceiptsEnabled && engine.sourceOrdinaryLockedSettlementsEnabled && !node.isSpecial &&
                        ordinarySixVisual.map{$0.committed && (event.reason != nil || $0.consuming)}==true
                    if !sourceOrdinaryOpen {node.visual.setScale(0.30)}
                    if let ordinary=ordinarySixVisual,ordinary.committed,
                       event.reason != nil || ordinary.consuming {
                        if engine.pendingOrdinarySpawns.contains(id) {
                            _ = engine.commitOrdinarySpawnArrival(receiptID:ordinary.id,generation:ordinary.generation,tileID:id)
                        }
                        finishOrdinarySpawnVisual(id)
                        ordinarySpawnVisuals[id]=beginVisual()
                        if let primary=engine.pendingOrdinaryPrimaryArrival,primary.id==event.reason {
                            ordinaryPrimaryVisuals[id]=(ordinary.id,primary.id,primary.generation)
                        }
                        let isLevelFlow=event.reason.map{sourceLockedBounceActionIDs.contains($0)} ?? false
                        let completed:()->Void = { [weak self,weak node] in
                            guard let self,self.engine.state.generation==ordinary.generation else {return}
                            if isLevelFlow,let node {self.completeSourceLevelFlowBounce(node,generation:ordinary.generation)}
                            self.finishOrdinarySpawnVisual(id,interrupted:false)
                        }
                        if sourceOrdinaryOpen {
                            guard startSourceOrdinaryOpenBounce(node,completed:completed) else {
                                onSourcePresentationFailure?("source_ordinary_open_bounce_not_admitted",ordinary.generation);return
                            }
                        } else {runSourceSpawn(node,key:"spawn",completion:completed)}
                    } else {node.visual.run(NativeBoardMotion.spawnBounce(),withKey:"spawn")}
                }
            default: break
            }
        }
        guard !sourceDisposalInProgress else {return}
        onStateChange?(engine.state)
        guard !sourceDisposalInProgress else {return}
        handleResolution(result.resolution)
    }

    func evaluate() {
        guard !sourceDisposalInProgress,!disposed else{return}
        if let caller=sourceLevelEndCaller,sourceLevelEndCallerGeneration==engine.state.generation {caller.check();return}
        let result=engine.resolve()
        if result.kind == .fail,engine.state.terminal==nil,sourceNoMovesPresentationEnabled,engine.stagedSourceNoMoves {
            _=beginSourceNoMovesFromLevelEndCaller()
        }
        guard !sourceDisposalInProgress,!disposed else{return}
        handleResolution(result)
        guard !sourceDisposalInProgress,!disposed else{return}
        onEndgameHintEvaluation?(result)
    }

    private func finishSourceAcceptedStack(_ id:String,generation:UInt64,interrupted:Bool) {
        guard let captured=sourceAcceptedStacks[id],captured.plan.generation==generation else{return}
        sourceAcceptedStacks.removeValue(forKey:id) // retire before logical reentry
        if !disposed,engine.state.generation==generation,engine.pendingOrdinaryStack?.id==id {
            if interrupted {
                sourcePreDebitContacts.removeValue(forKey:id);sourcePreDebitMain.removeValue(forKey:id)
                ordinaryAbsorbs.removeValue(forKey:id)
                let previous=engine.state
                consume(engine.finishOrdinaryStackAbsorb(receiptID:id,generation:generation,interrupted:true),previous:previous)
                finishSourceGameplay(.regularMergeHandoff,id:id,generation:generation)
            } else {
                // Canonical source delivery is authoritative even if an earlier
                // captured lazy callback just paused the global timeline.
                ordinaryAbsorbs.removeValue(forKey:id)
                captureSourcePreDebitMain(id:id,generation:generation)
                let preDebitEpoch=sourceOrdinaryPreDebitEpoch,preDebitEndpoint=sourceOrdinaryPreDebitAdmission
                let deferred=sourceOrdinaryPreDebitPresentationEnabled && sourcePreDebitMain[id] != nil
                if deferred {sourcePreDebitDeferredMain.insert(id)}
                let previous=engine.state
                // consume performs the actual captured source removal / destination
                // normalization. The postcheck event is held until Source release.
                consume(engine.finishOrdinaryStackAbsorb(receiptID:id,generation:generation),previous:previous)
                finishSourceGameplay(.regularMergeHandoff,id:id,generation:generation)
                // Literal finalizeRegularMergeBoardCommit releases frames/idle
                // before pre-debit busy query and the one genuine app-wall100.
                if deferred,sourcePreDebitDeferredMain.remove(id) != nil,
                    sourceAnimationBindingAdmissionOpen,engine.state.generation==generation,
                    sourceOrdinaryPreDebitEpoch==preDebitEpoch,sourceOrdinaryPreDebitAdmission === preDebitEndpoint,
                    sourcePreDebitMain[id] != nil {startOrdinaryPostcheck(id:id)}
            }
        }
        finishVisual(captured.visual)
    }
    private func retireSourceAcceptedStacks() {
        sourceOuterTearingDown=true
        let captured=Array(sourceAcceptedStacks.values)
        for stack in captured {
            stack.owner.cancelAll()
            // Contact acquisition can destroy Scene before main registration;
            // accepted ordinary atomic finalizer still owns its captured state.
            finishSourceAcceptedStack(stack.plan.id,generation:stack.plan.generation,interrupted:true)
        }
        sourceAcceptedStacks.removeAll()
    }

    private func finishOrdinaryAbsorb(_ plan:NativeOrdinaryMovePlan) {
        guard !disposed,!suspended,engine.state.generation==plan.generation,
              ordinaryAbsorbs.removeValue(forKey:plan.id) != nil else {return}
        let previous=engine.state
        if engine.pendingOrdinaryStack?.id==plan.id {
            consume(engine.finishOrdinaryStackAbsorb(receiptID:plan.id,generation:plan.generation),previous:previous)
            finishSourceGameplay(.regularMergeHandoff,id:plan.id,generation:plan.generation)
        } else if engine.pendingOrdinarySix?.id==plan.id {
            ordinarySixVisual?.committed=true;ordinarySixVisual?.consuming=true
            let result=engine.commitOrdinarySix(receiptID:plan.id,generation:plan.generation)
            consume(result,previous:previous)
            ordinarySixVisual?.consuming=false
            if !result.accepted {retireOrdinarySixVisual()}
            else {releaseOrdinarySixIfReady()}
        }
    }

    private func resumeSourceFacePostchecks(generation:UInt64) {
        guard sourceAnimationBindingAdmissionOpen,engine.state.generation==generation,!engine.hasPendingSourceOrdinaryStackFace else{return}
        let captured=sourceFaceDeferredPostchecks.values.filter{$0.generation==generation}.sorted{$0.order<$1.order}
        for post in captured {
            guard sourceAnimationBindingAdmissionOpen,engine.state.generation==generation,!engine.hasPendingSourceOrdinaryStackFace,sourceFaceDeferredPostchecks.removeValue(forKey:post.id) != nil else{return}
            commitExpiredOrdinaryPostcheck(id:post.id,generation:generation)
        }
    }
    private func commitExpiredOrdinaryPostcheck(id:String,generation:UInt64) {
        guard !disposed,!sourceDisposalInProgress,engine.state.generation==generation,engine.pendingOrdinaryPostchecks.contains(where:{$0.id==id && $0.generation==generation}) else{return}
            let previous=engine.state
            let result=engine.commitOrdinaryPostcheck(receiptID:id,generation:generation)
            if result.accepted,sourceNoMovesPresentationEnabled,engine.stagedSourceNoMoves,
                let bridge=sourceNoMovesBridge,let bindings=sourceNoMovesBindings,
                engine.state.tutorial==nil,bindings.ordinaryCallerReady(id,generation),
                !disposed,sourceNoMovesBridge === bridge,engine.state.generation==generation {
                _=bridge.ordinaryPostcheck(receiptID:id,generation:generation)
            }
            if result.accepted {startSourceNoMovesDepletedCaller(ownerID:id,kind:.ordinaryMovesDepleted,generation:generation)}
            consume(result,previous:previous)
    }
    private func startOrdinaryPostcheck(id:String) {
        if sourcePreDebitDeferredMain.contains(id) {return}
        guard !disposed,!ordinaryPostchecks.contains(id),
              let pending=engine.pendingOrdinaryPostchecks.first(where:{$0.id==id && $0.generation==engine.state.generation}) else {return}
        if sourceOrdinaryPreDebitPresentationEnabled {
            guard sourcePreDebitMain[id] != nil,let flow=sourceOrdinaryPreDebitFlow,
                let receipt=engine.claimSourceOrdinaryPreDebit(ownerID:id,generation:pending.generation) else {
                onPresentationFailure?("source_predebit_main_not_admitted");return
            }
            sourcePreDebitRequests[id]=receipt
            if !flow.start(receipt) {_=engine.refuseSourceOrdinaryPreDebit(receipt)}
            return
        }
        ordinaryPostchecks.insert(id)
        let elapsed:()->Void = { [weak self] in
            guard let self,!self.disposed,self.engine.state.generation==pending.generation,
                  self.ordinaryPostchecks.remove(id) != nil,
                  self.engine.pendingOrdinaryPostchecks.contains(where:{$0.id==id && $0.generation==pending.generation}) else{return}
            if self.sourceStackCoreFaceReceiptsEnabled,self.engine.hasPendingSourceOrdinaryStackFace {
                self.sourceFaceDeferredPostcheckSequence &+= 1
                self.sourceFaceDeferredPostchecks[id]=SourceFaceDeferredPostcheck(id:id,generation:pending.generation,order:self.sourceFaceDeferredPostcheckSequence)
                return // actual original wall wait elapsed; do NOT add another100ms
            }
            self.commitExpiredOrdinaryPostcheck(id:id,generation:pending.generation)
        }
        if pending.delayMilliseconds==0 {elapsed()}
        else {sourceAppTimeouts.schedule(sourceID:"ordinary-postcheck:"+id,generation:pending.generation,
            delayMilliseconds:pending.delayMilliseconds,elapsed:elapsed,cancelled:{ [weak self] in
                guard let self else{return};self.ordinaryPostchecks.remove(id)
                // Literal waitTrackedResult cancellation returns before moves--.
                if self.engine.state.generation==pending.generation {
                    _=self.engine.cancelOrdinaryPostcheck(receiptID:id,generation:pending.generation)
                }
            })}
    }

    private func playRegularSixHero(_ plan:NativeOrdinaryMovePlan) {
        let node=nodesByID[plan.destination.id],start=CGPoint(x:node?.visual.xScale ?? 1,y:node?.visual.yScale ?? 1)
        // The source hidden final carrier still consumes the authored peak draw.
        let motion=NativeRegularSixHeroMotion(random:{Double.random(in:0..<1)})
        guard let node else {return}
        node.visual.removeAllActions()
        node.visual.run(.customAction(withDuration:0.275) { [weak node] _,time in
            node?.visual.xScale=motion.sample(seconds:Double(time),startingScale:Double(start.x))
            node?.visual.yScale=motion.sample(seconds:Double(time),startingScale:Double(start.y))
        },withKey:"source-ordinary-six-hero")
    }

    private func playRegularSixMain(_ plan:NativeOrdinaryMovePlan) {
        guard let geometry,regularSixPresentations[plan.id]==nil else {return}
        let cadence=NativeRegularSixFxCadence.shared
        let reduced=reducedBoardEffects
        let captured=boardShake
        let owner:NativeRegularSixSpritePresentation
        do {
            owner=try NativeRegularSixSpritePresentation(origin:geometry.center(row:plan.destination.cell.row,column:plan.destination.cell.column),tileSize:geometry.tileSize,
                destinationDepth:CGFloat(plan.destination.cell.row*engine.state.columns+plan.destination.cell.column),combinedDepth:plan.source.stackDepth+plan.destination.stackDepth,
                generation:plan.generation,reduced:reduced,hotFactor:cadence.hotFactor(nowMilliseconds:CACurrentMediaTime()*1000,reducedBoardFx:reduced),patternIndex:cadence.nextPattern(),initialShake:captured,
                isCurrent:{ [weak self] generation in self?.disposed == false && self?.engine.state.generation == generation },random:{Double.random(in:0..<1)})
        } catch {
            // The same process-stable source font was checked before capture.
            // Report an unexpected native renderer failure without substituting
            // an unrelated effect for the authored source receipt.
            onPresentationFailure?("ordinary_six_source_font_missing")
            return
        }
        if let previous=regularSixShakeID {regularSixPresentations[previous]?.detachShake()}
        regularSixShakeID=plan.id;regularSixPresentations[plan.id]=owner
        let receipt=beginVisual()
        owner.onShake={ [weak self] pose,generation in
            guard let self,self.regularSixShakeID==plan.id,self.engine.state.generation==generation else {return}
            self.applyBoardShake(pose)
        }
        owner.onFinished={ [weak self] _ in
            guard let self else {return}
            self.regularSixPresentations.removeValue(forKey:plan.id)
            if self.regularSixShakeID==plan.id {self.regularSixShakeID=nil;self.applyBoardShake(.init(canvas:.zero,indicator:.zero,bottomDecor:.zero))}
            self.finishVisual(receipt)
        }
        owner.mount(in:canvasRoot)
    }

    private func applyBoardShake(_ pose:NativeRegularSixSpritePresentation.ShakeReceipt) {
        onJourneyBottomDecorShake?(pose.bottomDecor,engine.state.generation)
        boardShake=pose;canvasRoot.position=CGPoint(x:pose.canvas.x,y:-pose.canvas.y)
        sourceTutorialMeterHUD?.setCanvasShakeOffset(canvasRoot.position)
        let base=NativeGameplayChromePlan.make(viewport:size,safeTop:safeInsets.top).roundCenter
        roundIndicator.position=CGPoint(x:base.x+pose.indicator.x,y:base.y-pose.indicator.y)
    }

    private func retireRegularSixPresentations() {
        for owner in Array(regularSixPresentations.values) {owner.dispose()}
        regularSixPresentations.removeAll();regularSixShakeID=nil;applyBoardShake(.init(canvas:.zero,indicator:.zero,bottomDecor:.zero))
    }

    private func scheduleOrdinaryCommand(key:String,generation:UInt64,delay:Double,command:@escaping ()->Void) {
        guard !disposed,ordinaryDeferred.insert(key).inserted else{return}
        let elapsed:()->Void = { [weak self] in
            guard let self,!self.disposed,self.engine.state.generation==generation,
                  self.ordinaryDeferred.remove(key) != nil else{return}
            command()
        }
        let milliseconds=Int((max(0,delay)*1000).rounded())
        if milliseconds==0 {elapsed()}
        else {sourceAppTimeouts.schedule(sourceID:"ordinary-command:"+key,generation:generation,
            delayMilliseconds:milliseconds,elapsed:elapsed,cancelled:{ [weak self] in self?.ordinaryDeferred.remove(key) })}
    }

    struct SourceSpawnVisualRepairOwners {
        let node:NativeDiceNode
        let generation:UInt64
        let outerTransformOwned:Bool
        let innerImpactOwned:Bool
        let wildDropping:Bool
        let retireUnownedInnerTransform:()->Bool
        let current:()->Bool // actual capture/owner epoch, including same-generation replacement
    }
    enum SourceSpawnVisualRepairPass {case board,opacity}
    private(set) var sourceSpawnSafetyDiagnostic="not-captured"
    /// Capture complete real APP owners for each exact physical object before
    /// painting. Absent coverage rejects the sweep, never implies false flags.
    @discardableResult func repairSourceSpawnVisuals(scope:NativeGameplaySourceContext.Scope,
        pass:SourceSpawnVisualRepairPass,
        captureTransformOwners:(NativeDiceNode)->SourceSpawnVisualRepairOwners?,
        repairSpecialVisuals:(NativeDiceNode,SourceSpawnVisualRepairOwners,SourceSpawnVisualRepairPass)->Bool)->Bool {
        let generation=engine.state.generation
        func rejected(_ reason:String)->Bool {
            sourceSpawnSafetyDiagnostic=reason
            NSLog("[NativeRapidStack] safety rejected %@ generation=%llu",reason,generation)
            return false
        }
        func current()->Bool {sourceAnimationBindingAdmissionOpen && scope.current &&
            sourceOuterTimelineDriver === scope.timeline && engine.state.generation==generation}
        guard current() else{return false}
        var captured:[SourceSpawnVisualRepairOwners]=[]
        for model in engine.state.tiles {
            guard let node=nodesByID[model.id] else{return rejected("missing-node:\(model.id)")}
            if !node.sourceContactNodeAlive {continue} // literal destroyed skip
            guard node.parent === canvasRoot,node.sourceGeneration==generation,
                  node.sourcePhysicalMarkersCovered else{return rejected("physical:\(model.id):parent=\(node.parent === canvasRoot):generation=\(node.sourceGeneration):markers=\(node.sourcePhysicalMarkersCovered)")}
            let owners=captureTransformOwners(node)
            guard current(),let owners,owners.node === node,owners.generation==generation else{return rejected("transform-owner:\(model.id)")}
            let ownerCurrent=owners.current()
            guard current(),ownerCurrent,nodesByID[model.id] === node,node.parent === canvasRoot,node.sourceContactNodeAlive else{return false}
            captured.append(owners)
        }
        for owners in captured {
            guard current() else{return false}
            let node=owners.node
            if !node.sourceContactNodeAlive {continue}
            let ownerCurrent=owners.current()
            guard current(),ownerCurrent,nodesByID[node.tileID] === node,node.parent === canvasRoot,
                  node.sourceGeneration==generation else{return false}
            if owners.wildDropping {continue}
            // Direct main retires the face RAF/contact owner before the hidden
            // destination's separate cleanup callback. Borrow that exact live
            // cleanup claim, never the revoked Bee/Special skin. Residual flags
            // or hidden state alone cannot admit an ownerless object.
            if sourceRetainedDirectCleanupPresentationCurrent(node,scope:scope,generation:generation) {
                guard current(),owners.current() else{return false}
                continue
            }
            // A current cleared Wild-six face has its own retained physical
            // owner, including after its independent RAFs have delivered.
            // Older spawn sweeps borrow that pose; they cannot reactivate the
            // revoked Special skin or normalize the active transaction.
            if let model=engine.state.tiles.first(where:{$0.id==node.tileID}),
               node.sourceClearedWildSixPresentationCurrent(model:model) {
                guard node.repairSourceClearedWildSixOpacity(model:model),current(),owners.current() else{return false}
                continue
            }
            let regular=node.kind=="regular" && node.variant==nil && !node.sourceResidualWildPresence
            let accepted:Bool
            switch pass {
            case .board:
                if node.isHidden {continue}
                if regular {
                    accepted=node.repairSourceRegularBoardVisuals(outerTransformOwned:owners.outerTransformOwned,
                        activeDrag:draggedID==node.tileID,innerImpactOwned:owners.innerImpactOwned,
                        wildDropping:owners.wildDropping,retireUnownedInnerTransform:owners.retireUnownedInnerTransform,
                        current:{guard current() else{return false};let owned=owners.current();return owned && current()})
                } else {accepted=repairSpecialVisuals(node,owners,pass)}
            case .opacity:
                // The actual broker distinguishes Wild-like faces from other
                // variants; a hidden non-Wild variant still needs local repair.
                accepted = regular ? node.repairSourceRegularSpawnOpacity(wildDropping:owners.wildDropping):repairSpecialVisuals(node,owners,pass)
            }
            let stillOwned=owners.current()
            guard current(),accepted,stillOwned else{return false}
        }
        guard current() else{return false}
        sourceSpawnSafetyDiagnostic="captured"
        return true
    }
    func configureSourceOrdinaryMinimumPhase(scope:NativeGameplaySourceContext.Scope,
        captureTransformOwners:@escaping(NativeDiceNode)->SourceSpawnVisualRepairOwners?,
        repairSpecialVisuals:@escaping(NativeDiceNode,SourceSpawnVisualRepairOwners,SourceSpawnVisualRepairPass)->Bool)->Bool {
        configureSourceOrdinaryMinimumPhase(scope:scope,
            repairBoardTileVisuals:{[weak self,weak scope] in
                guard let self,let scope else{return false}
                return self.repairSourceSpawnVisuals(scope:scope,pass:.board,captureTransformOwners:captureTransformOwners,repairSpecialVisuals:repairSpecialVisuals)
            },repairSpawnOpacity:{[weak self,weak scope] in
                guard let self,let scope else{return false}
                return self.repairSourceSpawnVisuals(scope:scope,pass:.opacity,captureTransformOwners:captureTransformOwners,repairSpecialVisuals:repairSpecialVisuals)
            })
    }
    private var sourceSpawnVisualSafety:NativeSourceSpawnVisualSafetyOwner?
    @discardableResult func scheduleSourceSpawnVisualSafetySweep()->Bool {
        sourceSpawnVisualSafety?.schedule()==true
    }
    /// Bind both actual repair owners. The scheduler alone is not admission
    /// for missing transform markers, face geometry or Wild asset brokers.
    func configureSourceOrdinaryMinimumPhase(scope:NativeGameplaySourceContext.Scope,
        repairBoardTileVisuals:@escaping()->Bool,repairSpawnOpacity:@escaping()->Bool)->Bool {
        guard sourceSpawnVisualSafety==nil,sourceAnimationBindingAdmissionOpen,scope.current,
              sourceSixScope === scope else{return false}
        let generation=engine.state.generation
        let owner=NativeSourceSpawnVisualSafetyOwner(timeouts:sourceAppTimeouts,generation:generation,
            current:{[weak self,weak scope] in
                guard let self,let scope else{return false}
                return self.sourceAnimationBindingAdmissionOpen && scope.current &&
                    self.sourceSixScope === scope && self.engine.state.generation==generation
            },repairBoard:repairBoardTileVisuals,repairOpacity:repairSpawnOpacity,
            failure:{[weak self] in self?.onSourcePresentationFailure?("source_spawn_visual_safety_rejected",generation)})
        guard configureSourceOrdinaryMinimumPhase(scope:scope,scheduleOpacitySafetySweep:{[weak self,weak owner] in
            guard let self,let owner,self.sourceSpawnVisualSafety === owner else{return false}
            return self.scheduleSourceSpawnVisualSafetySweep()
        }) else {
            owner.dispose();return false
        }
        sourceSpawnVisualSafety=owner
        return true
    }
    private func retireSourceSpawnVisualSafety() {
        let captured=sourceSpawnVisualSafety;sourceSpawnVisualSafety=nil;captured?.dispose()
    }
    /// Actual normal ordinary-six assembly. Endgame/Arcade no-locked callers
    /// remain outside this admission until their separate coroutine is mapped.
    func configureSourceNormalOrdinarySpawnCoroutine(scope:NativeGameplaySourceContext.Scope,includeEndgame:Bool=false)->Bool {
        guard sourceAnimationBindingAdmissionOpen,scope.current,sourceSixScope === scope,
              sourceOrdinaryMinimumCaptureBound,sourceEndgameMutationLedgerAdmissionOpen,
              ensureSourceSpecialTransactions(scope:scope),let special=sourceSpecialTransactions else{return false}
        guard configureSourceOrdinaryFreshConstructor(scope:scope) else{return false}
        let generation=engine.state.generation
        sourceOrdinarySixSpawnOwnerEnabled=true;engine.sourceOrdinarySixSpawnNormalOnly = !includeEndgame
        engine.sourceOrdinaryEndgameCoroutineEnabled=includeEndgame
        guard configureSourceOrdinarySixSpawnOwner(scope:scope,resets:{[weak self,weak scope,weak special] id,generation in
            guard let self,let scope,let special,self.sourceAnimationBindingAdmissionOpen,scope.current,
                  self.sourceSixScope === scope,self.sourceSpecialTransactions === special,
                  self.engine.state.generation==generation else{return nil}
            return .init(releaseSpecialTransaction:{[weak self,weak special] in
                guard let self,let special,self.sourceAnimationBindingAdmissionOpen,scope.current,
                      self.engine.state.generation==generation else{return}
                // Ordinary original options carry no Special token. The real
                // captured registry endpoint cannot release a different plan.
                special.directGameplaySettled(id:id,generation:generation)
            },queueWildAfterGuardRelease:{[weak self] in
                self?.requestSourceMeterQueueAfterGuardRelease(scope:scope,generation:generation)
            })
        }) else {sourceOrdinarySixSpawnOwnerEnabled=false;engine.sourceOrdinarySixSpawnNormalOnly=false;return false}
        let configured=configureSourceOrdinaryMinimumPhase(scope:scope,captureTransformOwners:{[weak self,weak scope] node in
            guard let self,let scope,self.sourceAnimationBindingAdmissionOpen,scope.current,
                  self.sourceSixScope === scope,self.engine.state.generation==generation,
                  self.nodesByID[node.tileID] === node,node.parent === self.canvasRoot,
                  node.sourceGeneration==generation,node.sourcePhysicalMarkersCovered,
                  let markers=self.captureSourceGameplayTileMarkers(node.tileID) else{return nil}
            let current:()->Bool = {[weak self,weak scope,weak node] in
                guard let self,let scope,let node else{return false}
                return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceSixScope === scope &&
                    self.engine.state.generation==generation && self.nodesByID[node.tileID] === node &&
                    node.parent === self.canvasRoot && node.sourceGeneration==generation && node.sourcePhysicalMarkersCovered
            }
            return .init(node:node,generation:generation,
                outerTransformOwned:node.sourceOuterReceipt != nil,
                innerImpactOwned:(self.sourceStackFeedback[node.tileID]?.activeRootCount ?? 0)>0,
                wildDropping:markers.wildDropping,retireUnownedInnerTransform:{[weak node] in
                    guard let node,current() else{return false};node.sourceKillInnerContactTweens();return current()
                },current:current)
        },repairSpecialVisuals:{[weak self,weak scope] node,owners,pass in
            guard let self,let scope,owners.current(),self.engine.state.generation==generation,
                  self.nodesByID[node.tileID] === node else{return false}
            if owners.wildDropping {return true}
            // v9's local second pass skips Wild-like faces. The preceding
            // full board pass repairs their existing skin without entering
            // the constructor's separate idle activation protocol.
            if pass == .opacity,NativeWildArchetype(rawValue:node.kind) != nil {return owners.current()}
            guard node.repairSourceWildSkinPaint(generation:generation,current:{
                owners.current() && self.sourceAnimationBindingAdmissionOpen && scope.current &&
                    self.sourceSixScope === scope && self.engine.state.generation==generation &&
                    self.nodesByID[node.tileID] === node &&
                    self.engine.state.tiles.contains{$0.id==node.tileID &&
                        $0.gameplayArchetype?.rawValue==node.kind && $0.variant==node.variant}
            }),owners.current() else{
                NSLog("[NativeSourceSpawnVisualSafety] special rejected tile=%@ kind=%@ variant=%@ deferred=%d cleared=%d residual=%d pass=%@",node.tileID,node.kind,node.variant ?? "none",node.sourceIdleDeferred,node.sourceWildStateCleared,node.sourceResidualWildPresence,pass == .board ? "board":"opacity")
                return false
            }
            return owners.current()
        })
        if !configured {retireSourceOrdinarySixSpawnOwner();sourceOrdinarySixSpawnOwnerEnabled=false}
        if configured {engine.sourceOrdinaryPhysicalFinalSnapshotEnabled=true}
        if configured,includeEndgame {
            engine.sourceOrdinaryHardPrimaryPublish = {[weak self,weak scope] result,previous,slot in
                guard let self,let scope,self.sourceAnimationBindingAdmissionOpen,scope.current,
                      self.sourceSixScope === scope,self.engine.state==result.state,
                      self.prepareSourceOrdinaryLockedOpenFace(result,previous:previous,slot:slot,generation:slot.generation) else{return false}
                self.consume(result,previous:previous)
                return scope.current && self.sourceSixScope === scope && self.engine.state==result.state
            }
        }
        return configured
    }
    private var sourceOrdinaryPreconstructedIDs:Set<String>=[]
    private var sourceOrdinaryConstructorFrames:[String:NativeSourceAnimationClockService.SourceFrameLease]=[:]
    private(set) var sourceMinimumCaptureDiagnostic="not-captured"
    private var sourceOwnedOrdinaryMinimumTileAuthority:NativeSourceOrdinaryMinimumTileAuthority?
    /// The minimum-active predicate has its own physical capture. This never
    /// mounts the whole NO MOVES, global/save or queue permission authority.
    func configureSourceOrdinaryMinimumTileAuthority(scope:NativeGameplaySourceContext.Scope)->Bool {
        guard sourceAnimationBindingAdmissionOpen,scope.current,sourceSixScope === scope,
              sourceOwnedOrdinaryMinimumTileAuthority==nil,engine.sourceOrdinaryMinimumTileAuthority==nil else{return false}
        let generation=engine.state.generation
        let current:()->Bool = {[weak self,weak scope] in
            guard let self,let scope else{return false}
            return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceSixScope === scope &&
                self.engine.state.generation==generation
        }
        let authority=NativeSourceOrdinaryMinimumTileAuthority(isCurrent:current,capture:{[weak self] in
            guard let self,current() else{return nil}
            self.sourceMinimumCaptureDiagnostic="physical-board"
            guard let board=self.captureSourcePhysicalBoard(),board.isStillCurrent() else{return nil}
            guard let paint=NativeSourceNoMovesRuntimeSnapshot.PaintedStateReceipt(
                    canonicalState:board.canonicalState,paintedState:board.observedState,
                    allowSourceDetachedGridReferences:true) else{
                let mismatches=zip(board.canonicalState.tiles,board.observedState.tiles).compactMap{model,painted -> String? in
                    var normalized=painted;normalized.alpha=model.alpha;normalized.visible=model.visible
                    return normalized==model ? nil:"\(model.id):cleared=\(model.sourceWildStateCleared)/\(painted.sourceWildStateCleared),kind=\(String(describing:model.archetype))/\(String(describing:painted.archetype)),value=\(model.value)/\(painted.value)"
                }
                self.sourceMinimumCaptureDiagnostic="paint-receipt:tiles=\(mismatches);canonical=\(board.canonicalState.validationIssues(allowSourceDetachedGridReferences:true));painted=\(board.observedState.validationIssues(allowSourceDetachedGridReferences:true))"
                return nil
            }
            var tiles:[String:NativeNoMovesTileRuntime]=[:]
            for (id,physical) in board.tiles {
                guard current(),let marker=self.captureSourceGameplayTileMarkers(id),current() else{
                    self.sourceMinimumCaptureDiagnostic="tile-markers:\(id):kind=\(self.nodesByID[id]?.kind ?? "absent"):residual=\(self.nodesByID[id]?.sourceResidualWildPresence == true)"
                    return nil
                }
                tiles[id]=marker.noMovesRuntime(eventMode:physical.eventMode)
            }
            self.sourceMinimumCaptureDiagnostic="revalidate"
            guard current(),board.isStillCurrent() else{return nil}
            self.sourceMinimumCaptureDiagnostic="captured"
            return .init(paint:paint,tiles:tiles)
        })
        guard current(),engine.sourceOrdinaryMinimumTileAuthority==nil else{return false}
        sourceOwnedOrdinaryMinimumTileAuthority=authority;engine.sourceOrdinaryMinimumTileAuthority=authority
        return true
    }
    private var sourceOrdinaryMinimumCaptureBound:Bool {
        if let own=sourceOwnedOrdinaryMinimumTileAuthority {return engine.sourceOrdinaryMinimumTileAuthority === own && own.isCurrent()}
        if let own=sourceNoMovesOwnedRuntimeAuthority {return engine.sourceNoMovesRuntimeAuthority === own && own.isCurrent()}
        return false
    }
    private var sourceOrdinaryMinimumScope:NativeGameplaySourceContext.Scope?
    private var sourceOrdinaryMinimumOpacitySweep:(()->Bool)?
    func configureSourceOrdinaryMinimumPhase(scope:NativeGameplaySourceContext.Scope,scheduleOpacitySafetySweep:@escaping()->Bool)->Bool {
        guard sourceAnimationBindingAdmissionOpen,scope.current,sourceSixScope === scope,
              sourceOrdinarySixSpawnScope === scope,sourceOrdinarySixSpawnOwnerEnabled,
              sourceOrdinarySixSpawnResets != nil,engine.sourceOrdinaryLockedSettlementsEnabled,
              !engine.sourceOrdinaryMinimumPhaseEnabled,engine.pendingOrdinarySix==nil,
              let installation=sourceMicrotaskInstallation,installation.isCurrent,
              sourceOrdinaryMinimumCaptureBound else{return false}
        for model in engine.state.tiles {
            guard let node=nodesByID[model.id],node.sourceGeneration==engine.state.generation,
                  node.parent === canvasRoot,node.sourcePhysicalMarkersCovered else{return false}
        }
        sourceOrdinaryMinimumScope=scope;sourceOrdinaryMinimumOpacitySweep=scheduleOpacitySafetySweep;engine.sourceOrdinaryMinimumPhaseEnabled=true
        return true
    }
    private func enqueueSourceOrdinaryMinimumFinally(ownerID:String,generation:UInt64) {
        guard engine.state.generation==generation,let scope=sourceOrdinaryMinimumScope,scope.current,sourceOrdinarySixSpawnScope === scope,
              let installation=sourceMicrotaskInstallation,installation.isCurrent,
              let sweep=sourceOrdinaryMinimumOpacitySweep else{return}
        let accepted=sweep() // literal coroutine schedules opacity safety before finally
        guard accepted,engine.state.generation==generation,sourceAnimationBindingAdmissionOpen,scope.current,sourceOrdinaryMinimumScope === scope,
              sourceMicrotaskInstallation === installation,installation.isCurrent else {
            if engine.state.generation==generation,sourceAnimationBindingAdmissionOpen,scope.current,sourceOrdinaryMinimumScope === scope {
                onSourcePresentationFailure?("source_ordinary_minimum_opacity_sweep_rejected",generation)
            }
            return
        }
        guard installation.enqueue({[weak self,weak scope,weak installation] in
            guard let self,let scope,let installation,self.sourceAnimationBindingAdmissionOpen,
                  scope.current,self.sourceOrdinaryMinimumScope === scope,
                  self.sourceMicrotaskInstallation === installation,installation.isCurrent,
                  self.engine.state.generation==generation else{return}
            if !self.sourceOrdinarySixSpawnCoroutineFinally(ownerID:ownerID,generation:generation) {
                self.onSourcePresentationFailure?("source_ordinary_minimum_finally_rejected",generation)
            }
        }) else {onSourcePresentationFailure?("source_ordinary_minimum_finally_fifo_rejected",generation);return}
    }
    func configureSourceOrdinaryLockedSettlements(scope:NativeGameplaySourceContext.Scope)->Bool {
        guard sourceAnimationBindingAdmissionOpen,sourceSixScope === scope,scope.current,
              let installation=sourceMicrotaskInstallation,installation.isCurrent,
              engine.pendingOrdinarySix==nil,!engine.sourceOrdinaryLockedSettlementsEnabled else{return false}
        engine.sourceOrdinaryLockedSettlementsEnabled=true
        return true
    }
    private func configureSourceOrdinaryFreshConstructor(scope:NativeGameplaySourceContext.Scope)->Bool {
        guard sourceAnimationBindingAdmissionOpen,scope.current,sourceSixScope === scope,
              engine.sourceMathRandom === scope.mathRandom,engine.sourceOrdinaryLockedSettlementsEnabled,
              !engine.sourceOrdinaryFreshConstructorEnabled else{return false}
        engine.sourceOrdinaryFreshConstructorEnabled=true
        engine.sourceOrdinaryFreshConstructorCurrent = {[weak self,weak scope] receipt in
            guard let self,let scope,self.sourceAnimationBindingAdmissionOpen,scope.current,
                  self.sourceSixScope === scope,self.engine.sourceMathRandom === scope.mathRandom,
                  self.engine.sourceOrdinaryFreshConstructorIsCurrent(receipt),
                  let node=self.nodesByID[receipt.tileID],node.parent === self.canvasRoot,
                  node.sourceContactNodeAlive,node.sourceGeneration==receipt.generation else{return false}
            return true
        }
        engine.sourceOrdinaryFreshConstructor = {[weak self,weak scope] receipt in
            guard let self,let scope,self.sourceAnimationBindingAdmissionOpen,scope.current,
                  self.sourceSixScope === scope,self.engine.sourceMathRandom === scope.mathRandom,
                  self.engine.sourceOrdinaryFreshConstructorIsCurrent(receipt),
                  let tile=self.engine.state.tiles.first(where:{$0.id==receipt.tileID}) else{return false}
            for id in receipt.retiredTileIDs {
                guard self.engine.sourceOrdinaryFreshConstructorIsCurrent(receipt),scope.current else{return false}
                guard let old=self.nodesByID[id] else{continue}
                guard old.sourceGeneration==receipt.generation,old.parent === self.canvasRoot,
                      !self.engine.state.tiles.contains(where:{$0.id==id}) else{return false}
                if let entry=self.sourceSixContacts[receipt.ownerID],entry.destination === old {
                    self.retireSourceSixContact(entry)
                }
                self.retireSourceSpawns(tileID:id);self.sourceStackFeedback.removeValue(forKey:id)?.dispose()
                self.sourcePopulation.remove(id);self.nodesByID.removeValue(forKey:id);old.dispose()
            }
            guard let node=self.constructSourceOrdinaryZeroHolder(tile:tile,generation:receipt.generation),
                  self.engine.sourceOrdinaryFreshConstructorIsCurrent(receipt),scope.current else{return false}
            if receipt.kind == .endgameHardPrimary,!node.prepareSourceHardPrimaryBeforeValue(){return false}
            self.sourceOrdinaryPreconstructedIDs.insert(receipt.tileID)
            return true
        }
        return true
    }
    /// Borrow only this Scene's admitted physical authority for minimum rescue.
    /// Missing ownership/markers is not a zero count and must not create dice.
    func captureSourceOrdinaryMinimumActiveCount(ownerID:String,generation:UInt64)->Int? {
        guard sourceAnimationBindingAdmissionOpen,engine.state.generation==generation,
              let scope=sourceSixScope,scope.current,
              let installation=sourceMicrotaskInstallation,installation.isCurrent,
              sourceOrdinaryMinimumCaptureBound else{return nil}
        let captured=engine.state
        for model in captured.tiles {
            guard let node=nodesByID[model.id],node.parent === canvasRoot,
                  node.sourceContactNodeAlive,node.sourceGeneration==generation,
                  node.sourcePhysicalMarkersCovered else{return nil}
        }
        let count=engine.captureSourceOrdinaryMinimumActiveCount(ownerID:ownerID,generation:generation)
        guard sourceAnimationBindingAdmissionOpen,engine.state==captured,scope.current,
              sourceSixScope === scope,sourceMicrotaskInstallation === installation,installation.isCurrent,
              sourceOrdinaryMinimumCaptureBound else{return nil}
        return count
    }
    /// Genuine locked assignment producer; no Direct-guard repair or extra
    /// value draw. The already committed Core result owns the assigned value.
    private func prepareSourceOrdinaryLockedOpenFace(_ result:NativeMoveResult,previous:NativeBoardState,
        slot:NativeOrdinaryAssignment,generation:UInt64)->Bool {
        guard sourceStackCoreFaceReceiptsEnabled,engine.sourceOrdinaryLockedSettlementsEnabled else{return true}
        guard let event=result.events.first(where:{$0.kind == .spawned && $0.reason==slot.id}),let id=event.tileIDs.first else{return true}
        if slot.tileID==nil {
            let accepted=prepareSourceOrdinaryFreshOpenFace(result,id:id,generation:generation)
            if !accepted {onSourcePresentationFailure?("source_ordinary_fresh_constructor_not_admitted",generation)}
            return accepted
        }
        guard let before=previous.tiles.first(where:{$0.id==id}),before.locked,before.value==0 else{return true}
        guard sourceAnimationBindingAdmissionOpen,engine.state==result.state,
            let scope=sourceSixScope,scope.current,let tile=result.state.tiles.first(where:{$0.id==id}),
            let node=nodesByID[id] else {
            onSourcePresentationFailure?("source_ordinary_open_face_dependencies_unavailable",generation);return false
        }
        let current:()->Bool = {[weak self,weak node,weak scope] in
            guard let self,let node,let scope else{return false}
            return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceSixScope === scope &&
                self.engine.state.generation==generation && self.nodesByID[id] === node &&
                node.parent === self.canvasRoot && node.sourceContactNodeAlive && node.sourceGeneration==generation
        }
        // app-spawn setValue owns immediate value and the independent raw face
        // RAF before publication/bounce. Retained node/scope lifetime guards
        // later merge-six/Direct frames after the assignment Promise retires.
        guard node.openSourceAppSpawnHolder(tile.value,service:scope.service,random:{scope.mathRandom.next()},
            current:current,frameCurrent:current,beforeSetValue:{current() && self.engine.state==result.state},
            onCancelled:{[weak self] in if current(){self?.onSourcePresentationFailure?("source_ordinary_open_face_cancelled",generation)}}) else {
            onSourcePresentationFailure?("source_ordinary_open_face_not_admitted",generation);return false
        }
        return true
    }
    private func constructSourceOrdinaryZeroHolder(tile:NativeTile,generation:UInt64)->NativeDiceNode? {
        let captured=engine.state
        guard sourceAnimationBindingAdmissionOpen,let scope=sourceSixScope,scope.current,
              nodesByID[tile.id]==nil,let geometry,let driver=sourceOuterTimelineDriver,
              textures.sourceRetainedRegularOpenTexturesReady else{return nil}
        let id=tile.id
        let roll=scope.mathRandom.next()
        guard roll.isFinite,roll>=0,roll<1,scope.current,engine.state==captured,nodesByID[id]==nil else{return nil}
        let node=NativeDiceNode(id:id,value:0,kind:"regular",variant:nil,depth:1,locked:true,
            textures:textures,sourceSpecialIdle:scope.specialIdle)
        node.position=geometry.center(row:tile.cell.row,column:tile.cell.column)
        node.zPosition=CGFloat(tile.cell.row*captured.columns+tile.cell.column)
        canvasRoot.addChild(node);nodesByID[id]=node;captureSourceTutorialObject(node)
        var admitted=false
        defer {
            if !admitted,self.nodesByID[id] === node {
                self.nodesByID.removeValue(forKey:id)
                self.sourceOrdinaryConstructorFrames.removeValue(forKey:id)?.cancel()
                node.dispose()
            }
        }
        let current:()->Bool = {[weak self,weak scope,weak node] in
            guard let self,let scope,let node else{return false}
            return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceSixScope === scope &&
                self.engine.state.generation==generation && self.nodesByID[id] === node && node.parent === self.canvasRoot &&
                node.sourceContactNodeAlive && node.sourceGeneration==generation
        }
        guard node.prepareSourceInitialHolder(rotation:roll*0.12-0.06,generation:generation,cell:tile.cell),current() else{
            nodesByID.removeValue(forKey:id);node.dispose();return nil
        }
        node.installSourceOuterDriver(driver,generation:generation,geometryScale:geometry.scale)
        if let tween=sourceDragTweenDriver {node.installSourceDragTweenDriver(tween)}
        guard let frame=scope.service.requestSourceAnimationFrame(ownerID:"ordinary-open-constructor:"+id,generation:generation,
            callback:{[weak self,weak node] in
                self?.sourceOrdinaryConstructorFrames.removeValue(forKey:id)
                if current(){node?.flushSourceInitialHolderVisuals()}
            },onCancelled:{[weak self] in self?.sourceOrdinaryConstructorFrames.removeValue(forKey:id)}),current() else{return nil}
        sourceOrdinaryConstructorFrames[id]=frame
        admitted=true;return node
    }
    private func prepareSourceOrdinaryFreshOpenFace(_ result:NativeMoveResult,id:String,generation:UInt64)->Bool {
        guard sourceAnimationBindingAdmissionOpen,engine.state==result.state,
              let scope=sourceSixScope,scope.current,let tile=result.state.tiles.first(where:{$0.id==id}),
              tile.value>0,tile.value<6,!tile.isWild else{return false}
        let node:NativeDiceNode
        if sourceOrdinaryPreconstructedIDs.remove(id) != nil {
            guard let existing=nodesByID[id],existing.parent === canvasRoot,
                  existing.sourceContactNodeAlive,existing.sourceGeneration==generation else{return false}
            node=existing
        } else {
            guard let created=constructSourceOrdinaryZeroHolder(tile:tile,generation:generation) else{return false}
            node=created
        }
        let current:()->Bool = {[weak self,weak scope,weak node] in
            guard let self,let scope,let node else{return false}
            return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceSixScope === scope &&
                self.engine.state.generation==generation && self.nodesByID[id] === node && node.parent === self.canvasRoot &&
                node.sourceContactNodeAlive && node.sourceGeneration==generation
        }
        guard node.openSourceAppSpawnHolder(tile.value,service:scope.service,random:{scope.mathRandom.next()},
            current:current,frameCurrent:current,beforeSetValue:{current() && self.engine.state==result.state},
            onCancelled:{[weak self] in if current(){self?.onSourcePresentationFailure?("source_ordinary_fresh_face_cancelled",generation)}}),current() else{return false}
        node.paintSourceOuterScale(.init(x:0.30,y:0.30))
        return true
    }
    private func startOrdinaryAssignments(ids:[String]) {
        guard let plan=engine.pendingOrdinarySix else{return}
        let slots=engine.pendingOrdinaryAssignments.filter{ids.contains($0.id)}
        guard !slots.isEmpty else{releaseOrdinarySixIfReady();return}
        let deadline=DispatchTime.now()
        for slot in slots {
            let key="assignment:"+slot.id
            guard ordinaryDeferred.insert(key).inserted else{continue}
            if slot.kind == .locked || slot.kind == .emergencyLocked {sourceLockedBounceActionIDs.insert(slot.id)}
            if slot.kind == .locked || slot.kind == .emergencyLocked,let id=slot.tileID,let node=nodesByID[id],
               node.sourcePhysicalMarkersCovered,node.sourceGeneration==slot.generation,
               node.parent === canvasRoot,node.beginSourceLockedSpawnMarker(id:slot.id) {
                sourceLockedSlotMarkerNodes[slot.id]=node
            }
            let elapsed:()->Void = { [weak self] in
                guard let self else{return}
                defer {self.sourceLockedSlotMarkerNodes.removeValue(forKey:slot.id)?.clearSourceLockedSpawnMarker(id:slot.id)}
                guard !self.disposed,self.engine.state.generation==plan.generation,
                      self.ordinaryDeferred.remove(key) != nil,
                      self.engine.pendingOrdinarySix?.id==plan.id,
                      self.engine.pendingOrdinaryAssignments.contains(where:{$0.id==slot.id}) else{return}
                let previous=self.engine.state
                let result=self.engine.commitOrdinaryAssignment(receiptID:plan.id,generation:plan.generation,assignmentID:slot.id)
                guard self.prepareSourceOrdinaryLockedOpenFace(result,previous:previous,slot:slot,generation:plan.generation) else{return}
                self.consume(result,previous:previous)
                // Literal safeResolve clears AFTER actual assignment/unlock,
                // before the Promise continuation, never at bounce completion.
                self.sourceLockedSlotMarkerNodes.removeValue(forKey:slot.id)?.clearSourceLockedSpawnMarker(id:slot.id)
                self.releaseOrdinarySixIfReady()
            }
            if slot.delayMilliseconds==0 {elapsed()}
            else {sourceAppTimeouts.schedule(sourceID:key,generation:plan.generation,
                delayMilliseconds:slot.delayMilliseconds,from:deadline,elapsed:elapsed,cancelled:{ [weak self] in
                    guard let self else{return};self.ordinaryDeferred.remove(key)
                    self.sourceLockedSlotMarkerNodes.removeValue(forKey:slot.id)?.clearSourceLockedSpawnMarker(id:slot.id)
                    if slot.kind == .forcedLocked,self.engine.state.generation==plan.generation,
                       self.engine.pendingOrdinaryAssignments.first?.id==slot.id {
                        let previous=self.engine.state
                        let result=self.engine.cancelOrdinarySpawnWait(receiptID:plan.id,generation:plan.generation,assignmentID:slot.id)
                        // Actual destruction suppresses newly queued presentation;
                        // the source cancellation cannot fabricate a bounce arrival.
                        if !self.retiringSourceTransports,!self.disposed,result.accepted {self.consume(result,previous:previous);self.releaseOrdinarySixIfReady()}
                    }
                })}
        }
    }

    private func releaseOrdinarySixIfReady() {
        guard !disposed,let owner=ordinarySixVisual,owner.committed,!owner.consuming,
              engine.state.generation==owner.generation,engine.pendingOrdinarySpawns.isEmpty,
              engine.pendingOrdinarySix?.id==owner.id else {return}
        let previous=engine.state,result=engine.releaseOrdinarySixHandoff(receiptID:owner.id,generation:owner.generation)
        guard result.accepted else {return}
        // Native pending-six handoff is not the original Promise finally.
        // A genuine Source token keeps its captured frame+idle companions until
        // the actual explicit coroutine/reset endpoint or captured teardown.
        if sourceOrdinarySixSpawnClaims[owner.id]==nil {
            finishSourceGameplay(.mergeSixResolution,id:owner.id,generation:owner.generation)
        }
        ordinarySixVisual=nil
        consume(result,previous:previous);finishVisual(owner.receipt)
    }
    private func retireOrdinarySixVisual() {
        if let owner=ordinarySixVisual {ordinarySixVisual=nil;finishSourceGameplay(.mergeSixResolution,id:owner.id,generation:owner.generation);finishVisual(owner.receipt)}
    }
    private func finishOrdinarySpawnVisual(_ id:String,interrupted:Bool=true) {
        if let receipt=ordinarySpawnVisuals.removeValue(forKey:id) {finishVisual(receipt)}
        if let primary=ordinaryPrimaryVisuals.removeValue(forKey:id),engine.state.generation==primary.2,
           engine.pendingOrdinaryPrimaryArrival?.id==primary.1 {
            let previous=engine.state
            consume(engine.finishOrdinaryPrimarySpawn(receiptID:primary.0,generation:primary.2,assignmentID:primary.1,interrupted:interrupted),previous:previous)
            releaseOrdinarySixIfReady()
        }
    }

    private func handleResolution(_ resolution: NativeResolution) {
        guard !sourceDisposalInProgress else {return }
        guard !disposed else { return }
        if resolution.kind == .wait,resolution.reason == "wild_continuation_pending" {
            cancelCandidate()
            if engine.state.tutorial?.specialBarDefersReward == true {return}
            if let queue=sourceMeterQueue {queue.queueIfNeeded();return}
            let previous = engine.state,result = engine.claimMeterReward()
            if result.accepted { consume(result,previous:previous) }
            return
        }
        if resolution.kind == .wait,resolution.reason == "tutorial_final_chance_pending" {
            cancelCandidate()
            // Source repair must construct/bind the actual holder and face.
            // The raw claim only appends a logical die; synchronize cannot
            // invent that constructor's physical ownership/marker receipt.
            if let caller=sourceLevelEndCaller,sourceLevelEndCallerGeneration==engine.state.generation {
                caller.check();return
            }
            let previous = engine.state,result = engine.claimTutorialFinalChance()
            if result.accepted { consume(result,previous: previous) }
            return
        }
        switch resolution.kind {
        case .fail:
            if engine.state.terminal?.kind == .fail { presentTerminal(resolution) }
            else if !engine.stagedSourceNoMoves { scheduleCandidate() }
        case .complete: presentTerminal(resolution)
        default: if candidateSignature != nil { cancelCandidate() }
        }
    }

    private func scheduleCandidate() {
        let state = engine.state
        if candidateSignature == state.signature { return }
        cancelCandidate()
        guard engine.beginNoMovesConfirmation() == state.signature else { cancelCandidate(); return }
        candidateSignature = state.signature; navigationLocked = true
        noMoves.isHidden = false; noMoves.text = "NO MOVES"
        requestRendering(true)
        let signature = state.signature, generation = state.generation
        nativeNoMovesReceipt &+= 1;let receipt=nativeNoMovesReceipt
        let shown=onNativeNoMovesShow?(generation,receipt)==true
        guard !disposed,engine.state.generation==generation,candidateSignature==signature else{return}
        if shown {noMoves.isHidden=true}
        else {nativeNoMovesVisibleShow(generation:generation,receipt:receipt)}
        run(.sequence([.wait(forDuration: 1.5), .run { [weak self] in
            guard let self, !self.disposed, self.candidateSignature == signature,self.engine.state.generation==generation else { return }
            let result = self.engine.confirmNoMoves(signature: signature, generation: generation)
            if shown,result.accepted,let exit=self.onNativeNoMovesExit {
                let visual=self.beginVisual()
                self.nativeNoMovesExitCapture=(generation,receipt)
                self.cancelCandidate(clearNativeText:false)
                exit(generation){[weak self] in
                    guard let self,!self.disposed,self.engine.state.generation==generation,
                        self.nativeNoMovesExitCapture?.generation==generation,self.nativeNoMovesExitCapture?.receipt==receipt else{return}
                    self.nativeNoMovesExitCapture=nil
                    self.finishVisual(visual)
                }
            } else {self.cancelCandidate()}
            guard !self.disposed,self.engine.state.generation==generation else{return}
            self.consume(result, previous: state)
        }]), withKey: "no-moves-confirm")
    }

    private func cancelCandidate(clearNativeText:Bool=true) {
        guard !sourceNoMovesCandidateActive else{return}
        if clearNativeText {nativeNoMovesExitCapture=nil;onNativeNoMovesClear?()}
        removeAction(forKey: "no-moves-confirm"); candidateSignature = nil
        if sourceDisposalGeneration == nil || sourceDisposalGeneration == engine.state.generation {engine.cancelNoMovesConfirmation()}
        noMoves.isHidden = true; navigationLocked = engine.state.terminal != nil || pendingTerminal != nil || exitInProgress
    }

    private func presentTerminal(_ resolution: NativeResolution) {
        let generation = engine.state.generation
        guard terminalPresentedGeneration != generation, pendingTerminalGeneration != generation else { return }
        inputAdmitted = false; navigationLocked = true
        cancelDrag(); removeAction(forKey: "no-moves-confirm"); candidateSignature = nil
        onStateChange?(engine.state)
        pendingTerminal = resolution
        pendingTerminalGeneration = generation
        publishPendingTerminal()
    }

    private func beginVisual() -> UInt64 { visualOwners += 1; return visualLifetime }
    private func finishVisual(_ receipt: UInt64) {
        guard !disposed, receipt == visualLifetime else { return }
        visualOwners = max(0,visualOwners-1)
        releaseFinalDirectIfReady()
        publishPendingTerminal()
    }
    private func releaseFinalDirectIfReady() {
        guard !sourceDisposalInProgress else {return}
        guard !disposed,!suspended,visualOwners == 1,engine.pendingHUDStars.isEmpty,engine.pendingMeterRewards.isEmpty,
              let (id,generation,receipt)=directFinalReceipt,engine.pendingDirectWild?.id == id,
              (engine.pendingDirectWild?.isFinal == true || engine.hasConfirmedSourceLateFinalMerge(ownerID:id,generation:generation)),engine.directWildGameplayCommitted else {return}
        directFinalReceipt=nil;directPresentationID=nil;directPresentationVariant=nil;directFinalReceipt=nil
        let previous=engine.state,result=engine.releaseDirectWildPresentation(transactionID:id,generation:generation)
        if result.accepted,let captured=wildSourceResolution,captured.id==id,captured.generation==generation {
            wildSourceResolution=nil
            sourceSpecialTransactions?.directGameplaySettled(id:id,generation:generation)
            finishSourceGameplay(.mergeSixResolution,id:id,generation:generation)
        }
        consume(result,previous:previous);finishVisual(receipt)
    }
    private func publishPendingTerminal() {
        guard !sourceDisposalInProgress else {return}
        guard !disposed, !suspended, visualOwners == 0, engine.pendingHUDStars.isEmpty, engine.pendingMeterRewards.isEmpty, let pendingTerminal, pendingTerminalGeneration == engine.state.generation,
              terminalPresentedGeneration != engine.state.generation else { return }
        self.pendingTerminal = nil; pendingTerminalGeneration = nil; terminalPresentedGeneration = engine.state.generation
        onTerminal?(pendingTerminal)
    }

    private func smoke(at point: CGPoint, special: Bool,completion:(() -> Void)?=nil) {
        guard let geometry else { return }
        requestRendering(true)
        let receipt = beginVisual()
        for index in 0..<6 {
            let puff = SKSpriteNode(texture: textures.texture("assets/smoke/smoke\(index % 5 + 1).png"))
            puff.position = point
            let size = geometry.tileSize * (special ? 1.7 : 1.35)
            puff.size = CGSize(width: size, height: size); puff.alpha = 0.8
            puff.zRotation = CGFloat(index) * .pi / 3
            effects.addChild(puff)
            let angle = CGFloat(index) * .pi / 3
            let move = SKAction.moveBy(x: cos(angle)*geometry.tileSize*0.6, y: sin(angle)*geometry.tileSize*0.6, duration: 0.65)
            move.timingMode = .easeOut
            var actions: [SKAction] = [.group([move, .scale(to: 1.45, duration: 0.65), .fadeOut(withDuration: 0.65)])]
            if index == 5 { actions.append(.run { [weak self] in self?.finishVisual(receipt);completion?() }) }
            actions.append(.removeFromParent())
            puff.run(.sequence(actions))
        }
    }

    private func authoredFinale(_ variant: String,at point: CGPoint) -> Bool {
        guard let onAuthoredFinale else { return false }
        let receipt = beginVisual()
        let accepted = onAuthoredFinale(variant,CGPoint(x: point.x,y: size.height-point.y),engine.state.generation) { [weak self] in
            self?.finishVisual(receipt)
        }
        if !accepted { finishVisual(receipt) }
        return accepted
    }

    private func playDirectWild(_ plan:NativeDirectWildMovePlan) {
        guard !disposed,directPresentationID != plan.id else {return}
        directPresentationID=plan.id;directPresentationVariant=plan.variant
        specialPresentationIDs.formUnion([plan.source.id,plan.destination.id])
        nodesByID[plan.source.id]?.alpha=0
        let owner=SKNode(),receipt=beginVisual()
        effects.addChild(owner);navigationLocked=true;onRenderingDemand?(true)
        directAbsorb=(plan,owner,receipt)
        // Actual source ghost's80ms move completion invokes finishDirectWildAbsorb.
    }
    private func finishDirectWildAbsorb(_ plan:NativeDirectWildMovePlan) {
        guard !disposed,!suspended,engine.state.generation==plan.generation,
              engine.pendingDirectWild?.id==plan.id,let captured=directAbsorb,captured.0.id==plan.id else{return}
        directAbsorb=nil
        let owner=captured.1,receipt=captured.2,previous=engine.state
        let result=engine.commitDirectWildGameplay(transactionID:plan.id)
        specialPresentationIDs.remove(plan.source.id);specialPresentationIDs.remove(plan.destination.id)
        consume(result,previous:previous)
        finishWildSourceResolutionIfReady()
        guard result.accepted,engine.pendingDirectWild?.id==plan.id else {
            directPresentationID=nil;directPresentationVariant=nil;finishVisual(receipt);owner.removeFromParent();return
        }
        navigationLocked=engine.state.terminal != nil || pendingTerminal != nil
        if plan.isFinal {
            directFinalReceipt=(plan.id,plan.generation,receipt);owner.removeFromParent();releaseFinalDirectIfReady();return
        }
        owner.run(.sequence([.wait(forDuration:plan.archetype == .juice ? 1.86:0.9),.run { [weak self,weak owner] in
            guard let self else{return}
            guard !self.disposed,!self.suspended,self.engine.state.generation==plan.generation,
                  self.engine.pendingDirectWild?.id==plan.id else {self.finishVisual(receipt);owner?.removeFromParent();return}
            let previous=self.engine.state,result=self.engine.releaseDirectWildPresentation(transactionID:plan.id,generation:plan.generation)
            self.directPresentationID=nil;self.directPresentationVariant=nil
            if result.accepted {self.consume(result,previous:previous)}
            self.finishVisual(receipt);owner?.removeFromParent()
        }]),withKey:"native-direct-wild-release")
    }

    private func startWildSpawnActions(ids:[String]) {
        let actions=engine.pendingWildSpawnActions.filter{ids.contains($0.id) && $0.generation==engine.state.generation && wildScheduledActionIDs.insert($0.id).inserted}
        guard !actions.isEmpty else{return}
        // Explicit Core262 captured original command provenance. Do not derive
        // this from kind .locked alone, delay, presentation or a pending bounce.
        for action in actions where action.sourceLevelFlow {
            if let id=action.tileID,let node=nodesByID[id],node.parent === canvasRoot,
               node.sourceGeneration==action.generation,node.sourcePhysicalMarkersCovered,
               node.beginSourceLockedSpawnMarker(id:action.id) {sourceLockedSlotMarkerNodes[action.id]=node}
        }
        let commit:(NativeWildSpawnAction)->Void = { [weak self] action in
            // Source setTimeout callbacks continue under modal timeline pause.
            guard let self else{return}
            defer {self.sourceLockedSlotMarkerNodes.removeValue(forKey:action.id)?.clearSourceLockedSpawnMarker(id:action.id)}
            guard !self.disposed,self.engine.state.generation==action.generation,
                  self.engine.pendingWildSpawnActions.contains(where:{$0.id==action.id && $0.generation==action.generation}) else{return}
            let previous=self.engine.state,result=self.engine.commitWildSpawnAction(transactionID:action.transactionID,generation:action.generation,actionID:action.id)
            if result.accepted {self.consume(result,previous:previous);self.finishWildSourceResolutionIfReady()}
        }
        let deadline=DispatchTime.now()
        for action in actions {
            // Primary retry/forced first assignment are original synchronous
            // continuations, not an invented next-frame/timeout delivery.
            if action.delayMilliseconds==0 {commit(action)}
            else {
                // app-core endgame trackAppTimeout50; level-flow locked picks
                //50+100*i; app-core waitTrackedResult remainder/forced waits.
                // These are separate from paused GSAP bounce/absorb/FX owners.
                sourceAppTimeouts.schedule(sourceID:action.id,generation:action.generation,
                    delayMilliseconds:action.delayMilliseconds,from:deadline,elapsed:{commit(action)},cancelled:{[weak self] in
                        self?.sourceLockedSlotMarkerNodes.removeValue(forKey:action.id)?.clearSourceLockedSpawnMarker(id:action.id)
                    })
            }
        }
    }
    private func startWildRecoveryCheck(id:String) {
        guard let pending=engine.pendingWildRecoveryChecks.first(where:{$0.id==id && $0.generation==engine.state.generation}),wildCommandOwners[id]==nil else{return}
        let owner=SKNode(),receipt=beginVisual();wildCommandOwners[id]=(owner,receipt);effects.addChild(owner)
        owner.run(.sequence([.wait(forDuration:Double(pending.delayMilliseconds)/1000),.run { [weak self,weak owner] in
            guard let self else{return}
            guard !self.disposed,!self.suspended,self.engine.state.generation==pending.generation,
                  self.engine.pendingWildRecoveryChecks.contains(where:{$0.id==id}) else {
                if self.wildCommandOwners.removeValue(forKey:id) != nil {self.finishVisual(receipt)};owner?.removeFromParent();return
            }
            self.wildCommandOwners.removeValue(forKey:id)
            let previous=self.engine.state,result=self.engine.commitWildRecoveryCheck(receiptID:id,generation:pending.generation)
            if result.accepted {self.consume(result,previous:previous)}
            self.finishVisual(receipt);owner?.removeFromParent()
        }]),withKey:"native-wild-recovery-check")
    }
    private func startWildSpawnVisual(_ presentation:StackToSixGameplay.NativeWildSpawnPresentation,node:NativeDiceNode,actionID:String) {
        if sourceWildPublishedBounceActionIDs.contains(actionID){return}
        finishWildSpawnVisual(presentation.tileID,interrupted:true)
        let sourcePrimary=sourceWildPrimaryFaceActionIDs.remove(actionID) != nil
        let sourceHard=sourceWildHardPrimaryFaceActionIDs.remove(actionID) != nil
        if engine.sourceWildLockedFaceCommit != nil,sourceStackCoreFaceReceiptsEnabled,
           sourcePrimary || sourceHard || sourceWildLockedFaceActionIDs.remove(actionID) != nil,!node.isSpecial {
            if !startSourceWildLockedBounce(presentation,node:node,actionID:actionID,primary:sourcePrimary) {
                onSourcePresentationFailure?("source_wild_locked_bounce_not_admitted",presentation.generation)
            }
            return
        }
        let arrival=engine.pendingWildSpawnArrivals.first{$0.tileID==presentation.tileID && $0.generation==presentation.generation}
        let receipt=beginVisual(),releaseFrames=beginSourceMotion(.spawnBounce,id:"wild-spawn:"+actionID,generation:presentation.generation)
        wildSpawnVisuals[presentation.tileID]=(receipt,presentation.generation,arrival,releaseFrames)
        node.visual.setScale(0.30)
        node.visual.run(.sequence([NativeBoardMotion.spawnBounce(direction:CGFloat(presentation.direction)),.run { [weak self,weak node] in
            guard let self,let node,!self.disposed,!self.suspended,self.engine.state.generation==presentation.generation else{return}
            self.finishWildSpawnVisual(presentation.tileID,interrupted:false,beforeLogicalArrival:{
                if presentation.sourceLevelFlowReinforcement {self.completeSourceLevelFlowBounce(node,generation:presentation.generation)}
            })
        }]),withKey:"native-wild-spawn")
    }
    private func startSourceWildLockedBounce(_ presentation:StackToSixGameplay.NativeWildSpawnPresentation,
        node:NativeDiceNode,actionID:String,primary:Bool=false)->Bool {
        guard let scope=sourceDirectScope,scope.current,sourceSixScope === scope,
              sourceAnimationBindingAdmissionOpen,node.sourceOuterDriven,node.sourceContactNodeAlive,
              node.sourceGeneration==presentation.generation,nodesByID[node.tileID] === node,
              node.parent === canvasRoot,node.sourceRegularFramePending || node.sourceMergeSixFaceReady(service:scope.service) else{return false}
        let id="wild-locked:"+actionID,generation=presentation.generation,tileID=node.tileID
        let current:()->Bool = {[weak self,weak node,weak scope] in
            guard let self,let node,let scope else{return false}
            return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceDirectScope === scope &&
                self.engine.state.generation==generation && self.nodesByID[tileID] === node &&
                node.parent === self.canvasRoot && node.sourceContactNodeAlive && node.sourceGeneration==generation &&
                self.sourceWildOpenBounces[tileID]?.id==id
        }
        let owner=NativeSourceAppSpawnBounceOwner(service:scope.service,hooks:.init(current:current,
            readRotation:{[weak node] in node.map{Double($0.dragInnerTilt)}},
            paintScale:{[weak node] scale in node?.paintSourceOuterScale(.init(x:scale,y:scale))},
            paintRotation:{[weak node] angle in node?.dragInnerTilt=CGFloat(angle)},
            ensureFullOpacity:{[weak node] in node?.ensureSourceAppSpawnFullOpacity()},random:{scope.mathRandom.next()},
            acquireFrames:{[weak self] in guard current() else{return nil};return self?.beginSourceMotion(.spawnBounce,id:id,generation:generation)},
            finished:{[weak self,weak node] outcome in
                guard let self,let node,self.sourceWildOpenBounces[tileID]?.id==id else{return}
                let accepted=current();self.sourceWildOpenBounces.removeValue(forKey:tileID)
                node.unbindSourceAppSpawnInterruption(id:id)
                self.finishWildSpawnVisual(tileID,interrupted:outcome != .completed,beforeLogicalArrival:{
                    if accepted,outcome == .completed,presentation.sourceLevelFlowReinforcement {
                        self.completeSourceLevelFlowBounce(node,generation:generation)
                    }
                })
                if accepted,outcome == .unavailable {self.onSourcePresentationFailure?("source_wild_locked_bounce_unavailable",generation)}
            }),timeScale:primary || presentation.sourceLevelFlowReinforcement ? 2:1,capturedDirection:presentation.direction)
        sourceWildOpenBounces[tileID] = .init(id:id,node:node,owner:owner)
        let arrival=primary ? engine.pendingWildSpawnArrivals.first{$0.tileID==tileID && $0.generation==generation}:nil
        wildSpawnVisuals[tileID]=(beginVisual(),generation,arrival,nil)
        guard node.bindSourceAppSpawnInterruption(id:id,pickup:{[weak owner] in owner?.removeChildrenForPickup()},
            interrupted:{[weak owner] in owner?.interrupt()}),current(),owner.start(),current() else {
            finishWildSpawnVisual(tileID,interrupted:true);return false
        }
        return true
    }
    private func completeSourceLevelFlowBounce(_ node:NativeDiceNode,generation:UInt64) {
        let id=node.tileID
        guard !disposed,engine.state.generation==generation,nodesByID[id] === node else{return}
        node.repairSourceLevelFlowVisual()
        sourceAppTimeouts.schedule(sourceID:"level-flow-reinforce:"+UUID().uuidString,generation:generation,
            delayMilliseconds:160,elapsed:{ [weak self,weak node] in
                guard let self,let node,!self.disposed,self.engine.state.generation==generation,
                      self.nodesByID[id] === node else{return}
                node.repairSourceLevelFlowVisual()
            })
        onLevelFlowBounceCompletion?(id,generation)
    }
    private func finishWildSpawnVisual(_ id:String,interrupted:Bool,beforeLogicalArrival:(()->Void)?=nil) {
        if let source=sourceWildOpenBounces.removeValue(forKey:id) {
            source.node.unbindSourceAppSpawnInterruption(id:source.id);source.owner.interrupt()
        }
        nodesByID[id]?.visual.removeAction(forKey:"native-wild-spawn")
        nodesByID[id]?.visual.removeAction(forKey:"native-wild-locked-bonus")
        sourceWildBonusPops.removeValue(forKey:id)?.dispose()
        if let bonus=wildBonusVisuals.removeValue(forKey:id) {finishVisual(bonus.0)}
        guard let captured=wildSpawnVisuals.removeValue(forKey:id) else{return}
        // Original wrapped bounce releases its single100ms frame lease before
        // openCell's done/interrupted logical promise callback.
        captured.3?()
        beforeLogicalArrival?()
        // Retire once before model callback because consume may recursively synchronize.
        if let arrival=captured.2,!disposed,!suspended,engine.state.generation==captured.1,
           engine.pendingWildSpawnArrivals.contains(where:{$0.id==arrival.id}) {
            if engine.sourceWildSpawnBouncePublish != nil {
                // openAtCell resolves/rejects a Promise after the APP root has
                // released its motion. Its coroutine resumes on the same app
                // FIFO checkpoint, never synchronously inside this child root.
                finishVisual(captured.0)
                guard let scope=sourceDirectScope,scope.current,
                      let installation=sourceMicrotaskInstallation,installation.isCurrent else{
                    onSourcePresentationFailure?("source_wild_arrival_fifo_missing",arrival.generation);return
                }
                sourceWildPromiseArrivalEnqueuedCount+=1
                guard installation.enqueue({[weak self,weak scope,weak installation] in
                    guard let self,let scope,let installation,self.sourceAnimationBindingAdmissionOpen,
                          scope.current,self.sourceDirectScope === scope,self.sourceMicrotaskInstallation === installation,
                          installation.isCurrent,self.engine.state.generation==arrival.generation,
                          self.engine.pendingWildSpawnArrivals.contains(where:{$0.id==arrival.id && $0.generation==arrival.generation}) else{return}
                    let previous=self.engine.state
                    let result=self.engine.finishWildSpawnArrival(transactionID:arrival.transactionID,generation:arrival.generation,arrivalID:arrival.id,interrupted:interrupted)
                    guard result.accepted else{
                        self.onSourcePresentationFailure?("source_wild_arrival_fifo_refused",arrival.generation);return
                    }
                    self.sourceWildPromiseArrivalDeliveredCount+=1
                    self.consume(result,previous:previous);self.finishWildSourceResolutionIfReady()
                }) else{onSourcePresentationFailure?("source_wild_arrival_fifo_enqueue_refused",arrival.generation);return}
                return
            }
            let previous=engine.state,result=engine.finishWildSpawnArrival(transactionID:arrival.transactionID,generation:arrival.generation,arrivalID:arrival.id,interrupted:interrupted)
            if result.accepted {consume(result,previous:previous);finishWildSourceResolutionIfReady()}
        }
        finishVisual(captured.0)
    }
    private func startWildLockedBonus(ids:[String]) {
        for bonus in engine.pendingWildLockedBonusPresentations where ids.contains(bonus.tileID) && bonus.generation==engine.state.generation && wildBonusVisuals[bonus.tileID]==nil {
            guard let node=nodesByID[bonus.tileID] else{continue}
            let receipt=beginVisual();wildBonusVisuals[bonus.tileID]=(receipt,bonus.generation)
            if engine.sourceWildLockedBonusConstruct != nil {
                guard let scope=sourceDirectScope,scope.current,node.sourceGeneration==bonus.generation,
                      node.sourceOuterDriven,node.sourcePhysicalMarkersCovered else{
                    onSourcePresentationFailure?("source_wild_bonus_pop_not_admitted",bonus.generation);continue
                }
                let current:()->Bool = {[weak self,weak node,weak scope] in
                    guard let self,let node,let scope else{return false}
                    return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceDirectScope === scope &&
                        self.engine.state.generation==bonus.generation && self.nodesByID[bonus.tileID] === node &&
                        node.parent === self.canvasRoot && node.sourceContactNodeAlive && self.sourceWildBonusPops[bonus.tileID] != nil
                }
                let owner=NativeSourceLockedBonusPopOwner(service:scope.service,timeouts:sourceAppTimeouts,
                    generation:bonus.generation,delayMilliseconds:bonus.delayMilliseconds,direction:bonus.direction,
                    hooks:.init(current:current,locked:{[weak node] in node?.locked==true},
                        readRotation:{[weak node] in Double(node?.dragInnerTilt ?? 0)},
                        scale:{[weak node] value in node?.paintSourceOuterScale(.init(x:value,y:value))},
                        rotation:{[weak node] value in node?.dragInnerTilt=CGFloat(value)},
                        repair:{[weak node] in node?.repairSourceLockedBonus(alpha:bonus.alpha)},
                        acquire:{[weak self] in self?.beginSourceMotion(.spawnBounce,id:"wild-bonus:"+bonus.tileID,generation:bonus.generation)},
                        finished:{[weak self] in
                            guard let self else{return};self.sourceWildBonusPops.removeValue(forKey:bonus.tileID)
                            if let pending=self.wildBonusVisuals.removeValue(forKey:bonus.tileID){self.finishVisual(pending.0)}
                        }))
                sourceWildBonusPops[bonus.tileID]=owner
                if !owner.start(){owner.dispose();onSourcePresentationFailure?("source_wild_bonus_pop_refused",bonus.generation)}
                continue
            }
            node.visual.setScale(0.30)
            let scale=SKAction.sequence([
                NativeBoardMotion.scale(from:.init(x:0.30,y:0.30),to:.init(x:1.08,y:1.08),duration:0.16,ease:.backOut(2.1)),
                NativeBoardMotion.scale(from:.init(x:1.08,y:1.08),to:.init(x:0.96,y:0.96),duration:0.10,ease:.power2InOut),
                NativeBoardMotion.scale(from:.init(x:0.96,y:0.96),to:.init(x:1.02,y:1.02),duration:0.10,ease:.power2Out),
                NativeBoardMotion.scale(from:.init(x:1.02,y:1.02),to:.init(x:1,y:1),duration:0.12,ease:.backOut(2))])
            let direction=CGFloat(bonus.direction)
            let rotation=SKAction.sequence([
                NativeBoardMotion.rotate(from:0,to:-0.035*direction,duration:0.10,ease:.power2Out),
                NativeBoardMotion.rotate(from:-0.035*direction,to:0.021*direction,duration:0.12,ease:.power2Out),
                NativeBoardMotion.rotate(from:0.021*direction,to:0,duration:0.14,ease:.power2Out)])
            node.visual.run(.sequence([.wait(forDuration:Double(bonus.delayMilliseconds)/1000),.group([scale,rotation]),.run { [weak self] in
                guard let self,self.engine.state.generation==bonus.generation else{return}
                if let pending=self.wildBonusVisuals.removeValue(forKey:bonus.tileID) {self.finishVisual(pending.0)}
            }]),withKey:"native-wild-locked-bonus")
        }
    }
    private func finishWildSourceResolutionIfReady() {
        guard let captured=wildSourceResolution,
              engine.hasReachedWildSourceResolutionBoundary(transactionID:captured.id,generation:captured.generation) else{return}
        if engine.sourceWildCoroutineFinally != nil,
           engine.hasSourceWildSpawnCoroutine(transactionID:captured.id,generation:captured.generation) {return}
        wildSourceResolution=nil
        sourceSpecialTransactions?.directGameplaySettled(id:captured.id,generation:captured.generation)
        finishSourceGameplay(.mergeSixResolution,id:captured.id,generation:captured.generation)
    }
    private func invalidateWildTransports() {
        let bonusPops=sourceWildBonusPops;sourceWildBonusPops.removeAll()
        for owner in bonusPops.values{owner.dispose()}
        sourceWildLockedFaceActionIDs.removeAll()
        sourceWildPrimaryFaceActionIDs.removeAll()
        sourceWildHardPrimaryFaceActionIDs.removeAll()
        sourceWildPublishedBounceActionIDs.removeAll()
        sourceWildCoroutineResumes.removeAll()
        sourceWildCoroutineFinallys.removeAll()
        sourceWildSpawnClaims.removeAll()
        sourceWildConstructorEpoch &+= 1
        let constructorBatch=sourceWildConstructorBatch;sourceWildConstructorBatch=nil;sourceWildConstructorNodes=[:]
        constructorBatch?.cancel()
        let sourceBounces=sourceWildOpenBounces;sourceWildOpenBounces.removeAll()
        for bounce in sourceBounces.values {bounce.node.unbindSourceAppSpawnInterruption(id:bounce.id);bounce.owner.interrupt()}
        retireSourceWildSkinAssets()
        retireSourceSpawnVisualSafety()
        retiringSourceTransports=true
        if let previous=lastGeneration {sourceAppTimeouts.cancelGeneration(previous)}
        sourceAppTimeouts.cancelAll()
        let selectedMarkers=sourceLockedSlotMarkerNodes;sourceLockedSlotMarkerNodes=[:]
        selectedMarkers.forEach{key,node in node.clearSourceLockedSpawnMarker(id:key)}
        sourceLockedBounceActionIDs.removeAll()
        retiringSourceTransports=false
        if let captured=wildSourceResolution {
            wildSourceResolution=nil;finishSourceGameplay(.mergeSixResolution,id:captured.id,generation:captured.generation)
        }
        // This is generation replacement/disposal, never Source timeline pause.
        // Explicit destruction retires native delivery without inventing arrival.
        for captured in wildSpawnVisuals.values {captured.3?()}
        wildCommandOwners.values.forEach{$0.0.removeAllActions();$0.0.removeFromParent()}
        wildCommandOwners.removeAll();wildScheduledActionIDs.removeAll();wildSpawnVisuals.removeAll();wildBonusVisuals.removeAll();directAbsorb=nil
        for node in nodesByID.values {node.visual.removeAction(forKey:"native-wild-spawn");node.visual.removeAction(forKey:"native-wild-locked-bonus")}
    }

    private func configureTntGlyphClock(_ owner: NativeTntFinale,id preparedID:String?=nil) {
        guard onTntGlyphClock != nil else { return }
        let id = preparedID ?? UUID().uuidString,generation = engine.state.generation
        owner.onGlyphClock = { [weak self] time,finished in
            guard let self,finished || !self.disposed && self.engine.state.generation == generation else { return }
            self.onTntGlyphClock?(id,time,finished)
        }
    }

    private func registerSourceCoreTntShakeTarget(_ owner:NativeTntFinale,ownerID:String,generation:UInt64) {
        sourceCoreTntShakeTargets=sourceCoreTntShakeTargets.filter{$0.value.isCurrent}
        sourceCoreTntShakeTargets[ownerID]=NativeSourceScreenShakeOverlayTarget(read:{[weak owner] in
            guard let owner else{return .zero};return CGPoint(x:owner.position.x,y:-owner.position.y)
        },paint:{[weak owner] offset in owner?.position=CGPoint(x:offset.x,y:-offset.y)},current:{[weak self,weak owner] in
            guard let self,let owner else{return false}
            return !self.disposed && self.engine.state.generation==generation && owner.parent === self.effects
        })
    }
    private func coreTntFinale() {
        if sourceStackCoreFaceReceiptsEnabled {
            let late=engine.pendingSourceLateFinalMerge
            let direct=engine.pendingDirectWild
            guard let ownerID=late?.ownerID ?? direct?.id,
                  let generation=late?.generation ?? direct?.generation,
                  (late != nil || direct?.isFinal==true),
                  (late?.archetype ?? direct?.archetype) == .tnt,
                  (late?.variant ?? direct?.variant)==nil,
                  let scope=sourceSixScope,scope.current,sourceAnimationBindingAdmissionOpen,
                  engine.sourceMathRandom === scope.mathRandom else {
                onSourcePresentationFailure?("source_tnt_direct_final_context_unavailable",engine.state.generation);return
            }
            var boomExitDelivered=false
            let current:()->Bool = {[weak self,weak scope] in
                guard let self,let scope else{return false}
                return !self.disposed && self.sourceAnimationBindingAdmissionOpen && scope.current &&
                    self.sourceSixScope === scope && self.engine.state.generation==generation &&
                    (boomExitDelivered || self.engine.pendingDirectWild?.id==ownerID ||
                     self.engine.pendingSourceLateFinalMerge?.ownerID==ownerID ||
                     late != nil && self.engine.state.terminal?.reason=="final_single_merge6_guard") && self.engine.sourceMathRandom === scope.mathRandom
            }
            let clockID=UUID().uuidString
            guard let prepare=onPrepareSourceTntGlyphs,
                  let captured=NativeTntFinale.captureSourceConstruction(textures:textures,current:current,
                    random:{scope.mathRandom.next()},prepareGlyphs:{prepare(clockID,scope,generation)}),current() else {
                onTntGlyphClock?(clockID,NativeTntFinale.duration,true)
                onSourcePresentationFailure?("source_tnt_direct_final_constructor_unavailable",generation);return
            }
            let owner=NativeTntFinale(textures:textures,fontName:finaleFontName,viewport:size,showsTitle:false,
                sourceConstruction:captured,sourceRandom:{[weak scope] in scope?.mathRandom.next() ?? .nan})
            sourceTntFinaleSourceConstructionCount+=1
            configureTntGlyphClock(owner,id:clockID);owner.zPosition=999998;effects.addChild(owner)
            registerSourceCoreTntShakeTarget(owner,ownerID:ownerID,generation:generation)
            let receipt=beginVisual();onRenderingDemand?(true)
            let release=beginSourceMotion(.tntFinale,id:ownerID,generation:generation)
            var visualFinished=false,parentFinished=false
            let finishVisualOnce:()->Void = {[weak self] in
                guard !visualFinished else{return};visualFinished=true;self?.finishVisual(receipt)
            }
            sourceTntDirectBoomExitCallbacks[clockID]=(generation,{[weak self] in
                guard current() else{return};boomExitDelivered=true
                self?.sourceTntDirectBoomExitCallbacks.removeValue(forKey:clockID)
                finishVisualOnce()
            })
            let finish:()->Void = {[weak self] in
                guard !parentFinished else{return};parentFinished=true
                self?.sourceTntDirectBoomExitCallbacks.removeValue(forKey:clockID)
                release?();finishVisualOnce()
            }
            if !owner.playSource(service:scope.service,current:{[weak owner] in current() && owner?.parent != nil},
                frameSix:{},cancelled:finish,completion:finish) {
                owner.dispose();finish()
                onSourcePresentationFailure?("source_tnt_direct_final_clock_unavailable",generation)
            }
            return
        }
        let owner = NativeTntFinale(textures: textures,fontName: finaleFontName,viewport: size,showsTitle: onTntGlyphClock == nil)
        configureTntGlyphClock(owner)
        owner.zPosition = 999998; effects.addChild(owner)
        let receipt = beginVisual(); onRenderingDemand?(true)
        let releaseSource=beginSourceMotion(.tntFinale,id:UUID().uuidString,generation:engine.state.generation)
        owner.play { [weak self] in releaseSource?();self?.finishVisual(receipt) }
    }

    private var shortWildBoardBlast:NativeShortWildBoardBlastOwner?
    var sourceShortWildBoardBlastActiveCount:Int{shortWildBoardBlast?.activeSourceCount ?? 0}
    private func captureShortWildBoardBlastTargets(sourceID:String,destinationID:String)->[NativeDiceNode]? {
        guard !disposed,geometry != nil else{return nil}
        let scope=sourceBoardEntryScope ?? sourceSixScope ?? sourceRuntimeObservationScope
        let sourceOwned=sourceOuterTimelineDriver != nil
        if sourceOwned {guard let scope,scope.current,engine.sourceMathRandom === scope.mathRandom else{return nil}}
        var targets:[NativeDiceNode]=[]
        for tile in engine.state.tiles where tile.id != sourceID && tile.id != destinationID && !tile.locked && (tile.value>0 || tile.isWild) {
            guard let node=nodesByID[tile.id],node.parent === canvasRoot,shortWildBoardBlast?.owns(node) != true else{continue}
            if sourceOwned {
                guard let marker=sourceWildDropTileMarkers(node) else{onPresentationFailure?("source_short_wild_blast_drop_owner_missing");return nil}
                if marker.dropping || sourceMeterCaller?.owns(node)==true {continue}
            } else if tile.transientSpawn {continue}
            targets.append(node)
        }
        return targets
    }
    @discardableResult private func playShortWildBoardBlast(sourceID:String,destinationID:String,center:CGPoint,
        capturedTargets:[NativeDiceNode]?=nil)->Bool {
        guard !disposed,let geometry else{return false}
        let generation=engine.state.generation,scope=sourceBoardEntryScope ?? sourceSixScope ?? sourceRuntimeObservationScope
        let sourceOwned=sourceOuterTimelineDriver != nil
        if sourceOwned {guard let scope,scope.current,engine.sourceMathRandom === scope.mathRandom else{return false}}
        guard let captured=capturedTargets ?? captureShortWildBoardBlastTargets(sourceID:sourceID,destinationID:destinationID) else{return false}
        // Destroyed/replaced captured objects are no longer Source participants;
        // never substitute a newly constructed holder into their old wave.
        let targets=captured.filter{nodesByID[$0.tileID] === $0 && $0.parent === canvasRoot && sourceMeterCaller?.owns($0) != true && (!sourceOwned || $0.sourceGeneration==generation)}
        if targets.isEmpty {return true}
        let owner=shortWildBoardBlast ?? NativeShortWildBoardBlastOwner();shortWildBoardBlast=owner
        let previousPhase=sourceWildFXDrawingPhase;sourceWildFXDrawingPhase="board-blast"
        defer {sourceWildFXDrawingPhase=previousPhase}
        let current:()->Bool = { [weak self,weak owner] in
            guard let self,let owner else{return false}
            return !self.disposed && self.engine.state.generation==generation && self.shortWildBoardBlast === owner &&
                (!sourceOwned || (scope?.current==true && self.sourceOuterTimelineDriver === scope?.timeline))
        }
        let admitted=owner.start(nodes:targets,center:center,tileSize:geometry.tileSize,service:sourceOwned ? scope?.service:nil,
            random:{sourceOwned ? (scope?.mathRandom.next() ?? .nan):Double.random(in:0..<1)},current:current,
            nodeCurrent:{[weak self] node in
                guard let self else{return false}
                return self.nodesByID[node.tileID] === node && node.parent === self.canvasRoot &&
                    (!sourceOwned || node.sourceGeneration==generation)
            },acquire:{[weak self] in
                guard let self else{return {}};let receipt=self.beginVisual()
                return {[weak self] in self?.finishVisual(receipt)}
            })
        if !admitted,sourceOwned {onPresentationFailure?("source_short_wild_blast_not_admitted")}
        return admitted
    }

    @discardableResult private func coreMagnetFinale()->Bool {
        let owner=NativeMagnetFinalePresentation(textures:textures,viewport:size)
        guard owner.assetReady else{owner.dispose();return false}
        for previous in effects.children.compactMap({$0 as? NativeMagnetFinalePresentation}){previous.dispose()}
        let id=UUID().uuidString,generation=engine.state.generation
        owner.onGlyphClock={[weak self] time,finished in
            guard let self,finished || !self.disposed && self.engine.state.generation==generation else{return}
            self.onSplashGlyphClock?("magnet",id,time,finished)
        }
        owner.zPosition=999998;effects.addChild(owner)
        let receipt=beginVisual();requestRendering(true)
        let release=beginSourceMotion(.magnetFinale,id:id,generation:generation)
        owner.play{[weak self] in release?();self?.finishVisual(receipt)}
        return true
    }
    private func coreStarFinale() {
        let owner = NativeStarFinale(textures: textures,viewport: size)
        let id = UUID().uuidString,generation = engine.state.generation
        var haptics = Set<Int>()
        let earlyBeats: [TimeInterval] = (0..<7).map { Double($0)*0.095 }
        let lateBeats: [TimeInterval] = (0..<6).map { 1.0+Double($0)*0.11 }
        let beats = earlyBeats+lateBeats
        owner.onGlyphClock = { [weak self] time,finished in
            guard let self,finished || !self.disposed && self.engine.state.generation == generation else { return }
            self.onSplashGlyphClock?("star",id,time,finished)
            if !finished { for (index,at) in beats.enumerated() where time >= at && !haptics.contains(index) {
                haptics.insert(index); self.onHaptic?("light")
            } }
        }
        owner.zPosition = 999998; effects.addChild(owner)
        let receipt = beginVisual(); requestRendering(true)
        let releaseSource=beginSourceMotion(.starFinale,id:id,generation:generation)
        owner.play { [weak self] in releaseSource?();self?.finishVisual(receipt) }
    }

    @discardableResult
    private func coreJuiceFinale(onGameplayReady: (() -> Void)? = nil) -> Bool {
        let owner = NativeJuiceFinale(textures: textures,viewport: size)
        guard owner.assetReady else { owner.dispose(); return false }
        for previous in effects.children.compactMap({ $0 as? NativeJuiceFinale }) { previous.dispose() }
        let token = UUID().uuidString,generation = engine.state.generation
        let beats: [TimeInterval] = [0.2,0.27,0.34,0.52,0.78,1.04,1.325,1.425,1.525,1.625,2.225,2.405,2.585,2.725]
        var haptics = Set<Int>()
        owner.onGlyphClock = { [weak self] time,finished in
            guard let self,finished || !self.disposed && self.engine.state.generation == generation else { return }
            self.onSplashGlyphClock?("juice",token,time,finished)
            if !finished { for (index,at) in beats.enumerated() where time >= at && !haptics.contains(index) {
                haptics.insert(index); self.onHaptic?("light")
            } }
        }
        owner.onCue = { [weak self] moment,index in
            guard let self,!self.disposed,self.engine.state.generation == generation else { return }
            self.onSpecialMoment?("juice",moment,index)
        }
        owner.onGameplayReady = onGameplayReady
        owner.zPosition = 999998; effects.addChild(owner)
        let receipt = beginVisual(); onRenderingDemand?(true)
        let releaseSource=beginSourceMotion(.juiceFinale,id:token,generation:generation)
        owner.play { [weak self] in releaseSource?();self?.finishVisual(receipt) }
        return true
    }

    private func retireEffects() {
        dragTrail.clear()
        let blast=shortWildBoardBlast;shortWildBoardBlast=nil;blast?.dispose()
        for child in effects.children {
            if let tnt = child as? NativeTntFinale { tnt.dispose() }
            else if let star = child as? NativeStarFinale { star.dispose() }
            else if let juice = child as? NativeJuiceFinale { juice.dispose() }
            else if let magnet = child as? NativeMagnetFinalePresentation {magnet.dispose()}
            else { child.removeAllActions(); child.removeAllChildren(); child.removeFromParent() }
        }
    }

    private func startMeterRewards(ids:[String]) {
        for receipt in engine.pendingMeterRewards where ids.contains(receipt.id) && meterTimeoutIDs.insert(receipt.id).inserted {
            // Original TNT impact credits 3/4 use trackAppTimeout400/500;
            // model charge continues under GSAP pause, without renderer leases.
            sourceAppTimeouts.schedule(sourceID:"tnt-meter:"+receipt.id,generation:receipt.generation,
                delayMilliseconds:Int((receipt.delay*1000).rounded()),elapsed:{ [weak self] in
                    guard let self,!self.disposed,self.engine.state.generation==receipt.generation,
                          self.meterTimeoutIDs.remove(receipt.id) != nil,
                          self.engine.pendingMeterRewards.contains(where:{$0.id==receipt.id && $0.generation==receipt.generation}) else{return}
                    let previous=self.engine.state
                    self.consume(self.engine.commitMeterReward(receiptID:receipt.id,generation:receipt.generation),previous:previous)
                },cancelled:{ [weak self] in self?.meterTimeoutIDs.remove(receipt.id) })
        }
    }

    /// Borrow the existing actual Source app-wall transport. Global GSAP pause
    /// does not stop this finite wait; destruction cancels the captured receipt.
    func scheduleSourceConfirmedFailWait(generation:UInt64,milliseconds:Int,elapsed:@escaping()->Void,cancelled:@escaping()->Void)->()->Void {
        let receipt=sourceAppTimeouts.schedule(sourceID:"confirmed-fail-handoff:"+UUID().uuidString,
            generation:generation,delayMilliseconds:milliseconds,elapsed:elapsed,cancelled:cancelled)
        return {[weak self] in _=self?.sourceAppTimeouts.cancel(receipt)}
    }
    /// Score-free protected-star cleanup AFTER Source wall40/60 and BEFORE the
    /// real board exit. Refuse unbound pending stars; never manufacture arrival.
    @discardableResult func cleanupSourceConfirmedFailHUDStars(plan:NativeNoMovesCandidateOwner.Plan,generation:UInt64)->Bool {
        guard sourceAnimationBindingAdmissionOpen,sourceNoMovesPresentationEnabled,
            engine.state.generation==generation,sourceNoMovesGeneration==generation,
            engine.pendingSourceNoMoves==plan else{return false}
        let ids=Set(engine.pendingHUDStars.map(\.id))
        if sourceHUDStarJobsPresentationEnabled {
            guard let owner=sourceHUDStarOwner,
                owner.capturedJobs.count==engine.sourceHUDStarJobs.count,
                owner.capturedJobs.allSatisfy({engine.sourceHUDStarJobs.contains($0)}),
                ids.isSubset(of:Set(owner.capturedJobs.flatMap(\.receiptIDs))),
                engine.cancelSourceConfirmedFailHUDStars(plan:plan,generation:generation,receiptIDs:Array(ids)) else{return false}
            retireSourceHUDStarJobs()
            return sourceAnimationBindingAdmissionOpen && engine.state.generation==generation
        }
        guard ids==hudStarIDs,ids==Set(hudStarNodes.keys),ids==Set(hudStarVisualReceipts.keys),
            hudStarNodes.values.allSatisfy({$0.parent === hudStarFlights}) else{return false}
        let nodes=hudStarNodes,visuals=hudStarVisualReceipts
        guard engine.cancelSourceConfirmedFailHUDStars(plan:plan,generation:generation,receiptIDs:Array(ids)) else{return false}
        // Remove exact owned fields BEFORE action/resource/lease callbacks.
        hudStarNodes.removeAll();hudStarIDs.removeAll();hudStarVisualReceipts.removeAll()
        for node in nodes.values {node.removeAllActions();node.removeFromParent()}
        finishSourceStars()
        for receipt in visuals.values {finishVisual(receipt)}
        return sourceAnimationBindingAdmissionOpen && engine.state.generation==generation
    }
    // PRIVATE Source caller capability, defaultOFF. A family capture must come
    // from its genuine animateStarsToHudIcon call, not a Core grid reconstruction.
    var sourceHUDStarTargetScreen:CGPoint? {
        guard sourceAnimationBindingAdmissionOpen,let host=gameplayRenderHost,scoreArt.parent != nil else{return nil}
        return host.scenePointToView(scoreArt.convert(CGPoint.zero,to:self),scene:self)
    }
    struct SourceHUDStarCallCapture {let screenOrigin:CGPoint,hudTarget:CGPoint}
    var sourceHUDStarJobsPresentationEnabled=false
    private var sourceHUDStarOwner:NativeSourceHUDStarPresentation?
    private var sourceHUDStarFeedback:NativeSourceHUDStarFeedback?
    private var sourceHUDStarScaleFeedback:NativeSourceHUDStarScaleFeedback?
    private var sourceHUDStarScaleClock:NativeSourceHUDStarScaleClockAdapter?
    var sourceHUDStarJobsAdmissionOpen:Bool{sourceHUDStarJobsPresentationEnabled && sourceHUDStarOwner?.admissionOpen==true}
    private var sourceHUDStarCapture:(([NativeHUDStarReceipt])->SourceHUDStarCallCapture?)?
    private var sourceHUDStarEpoch:UInt64=0
    private var sourceCapturedHUDOrigins:[String:(UInt64,CGPoint)]=[:]
    /// Actual retained main/impact callers publish screen origins before their
    /// nodes retire. No family's origin is reconstructed from a Core cell.
    private func captureSourceHUDOrigins(_ result:NativeMoveResult,screenOrigin:CGPoint)->[String]? {
        guard sourceHUDStarJobsPresentationEnabled else{return []}
        let ids=result.events.filter{$0.kind == .hudStarsPrepared}.flatMap(\.tileIDs)
        guard sourceAnimationBindingAdmissionOpen,result.accepted,engine.state==result.state,
              sourceHUDStarJobsAdmissionOpen,screenOrigin.x.isFinite,screenOrigin.y.isFinite,
              ids.allSatisfy({id in engine.pendingHUDStars.contains{$0.id==id && $0.generation==result.state.generation}}) else{return nil}
        for id in ids {sourceCapturedHUDOrigins[id]=(result.state.generation,screenOrigin)}
        return ids
    }
    /// Capture at the actual authored main/bonus callback before its retained
    /// object is removed or replaced. Core cell projection is not an origin.
    private func sourceSpecialHUDScreenOrigin(node:NativeDiceNode,generation:UInt64)->CGPoint? {
        guard sourceAnimationBindingAdmissionOpen,engine.state.generation==generation,
              nodesByID[node.tileID] === node,node.parent === canvasRoot,
              node.sourceGeneration==generation,node.sourceContactNodeAlive,let host=gameplayRenderHost else{return nil}
        let origin=host.scenePointToView(node.convert(CGPoint.zero,to:self),scene:self)
        return origin.x.isFinite && origin.y.isFinite ? origin:nil
    }
    private func consumeSourceSpecialHUDCall(_ result:NativeMoveResult,previous:NativeBoardState,origin:CGPoint?)->Bool {
        if result.accepted,sourceTntMainScope?.current==true {
            let previousIDs=Set(previous.tiles.map(\.id))
            let impactedIDs=Set(result.events.filter{$0.kind == .specialImpact && $0.archetype == .tnt}.flatMap(\.tileIDs))
            for tile in result.state.tiles where impactedIDs.contains(tile.id) && !previousIDs.contains(tile.id) {
                // Authored bonus replacements use the same original createTile
                // zero-holder/setValue constructor as the standard TNT route.
                // A Raw visual node has no Source cell or lifecycle writers.
                guard prepareSourceOrdinaryFreshOpenFace(result,id:tile.id,generation:result.state.generation) else {
                    onSourcePresentationFailure?("source_authored_tnt_bonus_constructor_not_admitted",result.state.generation);return false
                }
            }
        }
        guard sourceHUDStarJobsPresentationEnabled,result.accepted else{consume(result,previous:previous);return result.accepted}
        guard let origin,let ids=captureSourceHUDOrigins(result,screenOrigin:origin) else {
            onSourcePresentationFailure?("source_authored_special_hud_origin_not_admitted",result.state.generation);return false
        }
        consume(result,previous:previous)
        for id in ids {sourceCapturedHUDOrigins.removeValue(forKey:id)}
        return sourceAnimationBindingAdmissionOpen && engine.state.generation==result.state.generation
    }
    @discardableResult func configureSourceDirectHUDCaller(scope:NativeGameplaySourceContext.Scope,
        prepared:NativeSourceHUDStarTexturePreparation.Prepared)->Bool {
        configureSourceHUDStarJobs(scope:scope,prepared:prepared,capture:{[weak self] receipts in
            guard let self,self.sourceAnimationBindingAdmissionOpen,!receipts.isEmpty,
                  receipts.allSatisfy({$0.generation==self.engine.state.generation}),
                  let target=self.sourceHUDStarTargetScreen else{return nil}
            let origins=receipts.compactMap{self.sourceCapturedHUDOrigins[$0.id]}
            guard origins.count==receipts.count,let first=origins.first,
                  origins.allSatisfy({$0.0==self.engine.state.generation && $0.1==first.1}) else{return nil}
            return .init(screenOrigin:first.1,hudTarget:target)
        })
    }
    @discardableResult func configureSourceHUDStarJobs(scope:NativeGameplaySourceContext.Scope,
        prepared:NativeSourceHUDStarTexturePreparation.Prepared,
        capture:@escaping([NativeHUDStarReceipt])->SourceHUDStarCallCapture?,
        hudFeedback:((Int)->Void)?=nil)->Bool {
        guard sourceHUDStarJobsPresentationEnabled,sourceAnimationBindingAdmissionOpen,scope.current,
              sourceHUDStarOwner==nil,hudStarIDs.isEmpty,engine.sourceHUDStarJobs.isEmpty,
              scope.hudStarTextures.accepts(prepared),scope.service.sourceFrameTransportAdmissionOpen else{return false}
        sourceHUDStarEpoch &+= 1
        let epoch=sourceHUDStarEpoch,generation=engine.state.generation
        let current:()->Bool = {[weak self,scope] in
            guard let self,self.sourceAnimationBindingAdmissionOpen,self.sourceHUDStarEpoch==epoch,
                self.engine.state.generation==generation,self.sourceHUDStarJobsPresentationEnabled,
                scope.hudStarTextures.accepts(prepared) else{return false}
            let admitted=scope.current
            return admitted && self.sourceAnimationBindingAdmissionOpen && self.sourceHUDStarEpoch==epoch &&
                self.engine.state.generation==generation && self.sourceHUDStarJobsPresentationEnabled && scope.hudStarTextures.accepts(prepared)
        }
        let scaleClock=NativeSourceHUDStarScaleClockAdapter(service:scope.service)
        let scales=NativeSourceHUDStarScaleFeedback(hooks:.init(current:current,
            text:{[weak self] in self?.score.text ?? ""},
            setText:{[weak self] value in self?.score.text=value},
            readScale:{[weak self] target in
                guard let self else{return .init(x:1,y:1)}
                let node:SKNode=target == .number ? self.score:self.scoreArt
                return .init(x:Double(node.xScale),y:Double(node.yScale))
            },writeScale:{[weak self] target,value in
                guard let self,current() else{return}
                let node:SKNode=target == .number ? self.score:self.scoreArt
                node.xScale=CGFloat(value.x);node.yScale=CGFloat(value.y)
            },killOtherScaleTweens:{[weak self] target in
                guard let self,current() else{return}
                // This captured Scene has no other score/icon scale-tween
                // owner. The feedback helper cancels its exact roots above;
                // HUD drop/rise owns the parent and is never killed here.
                _ = target
            },timeline:{label,duration,paint,finished in
                guard current() else{return nil}
                return scaleClock.timeline(label:label,duration:duration,paint:paint,finished:finished)
            },wall:{[weak self] ms,callback in
                guard let self,current() else{return nil}
                let receipt=self.sourceAppTimeouts.schedule(sourceID:"source-hud-star-number-deflate",generation:generation,delayMilliseconds:ms,elapsed:callback)
                return{[weak self] in _=self?.sourceAppTimeouts.cancel(receipt)}
            }))
        guard let owner=NativeSourceHUDStarPresentation(stage:canvasRoot,viewportHeight:size.height,texture:prepared.texture,pixelSize:prepared.pixelSize,
            selectedAssetsReady:prepared.current,service:scope.service,timeouts:sourceAppTimeouts,engine:engine,
            bindings:.init(current:current,random:{scope.smokeSession.nextVisualRandom()},acquireCadence:{[weak self] in
                guard let self,current() else{return{}}
                return self.beginSourceMotion(.hudStarFlight,id:UUID().uuidString,generation:generation) ?? {}
            },onArrival:{[weak self] result in
                guard let self,current() else{return}
                // Original CC mutation already happened in Core. Do NOT route
                // through Raw consume/redraw/save/resolver per arriving star.
                guard self.sourceHUDStarFeedback?.scoreChanged()==true else{self.onPresentationFailure?("source_hud_star_feedback_frame_unbound");return}
            },onRetired:{ _ in
                guard current() else{return} // no Source save/redraw is scheduled by job cleanup itself.
            })),current(),sourceHUDStarOwner==nil else{scales.dispose();scaleClock.dispose();return false}
        let feedback=NativeSourceHUDStarFeedback(current:current,schedule:{callback in
            guard current(),let frame=scope.service.requestSourceAnimationFrame(ownerID:"source-hud-star-feedback",generation:generation,callback:callback) else{return nil}
            return{frame.cancel()}
        },paint:{[weak self] in
            guard let self,current() else{return}
            guard scales.paint(score:self.engine.state.score),current() else{self.onPresentationFailure?("source_hud_star_authored_feedback_unavailable");return}
            hudFeedback?(self.engine.state.score) // optional observer, authored painting is installed above.
        })
        guard current(),sourceHUDStarOwner==nil else{feedback.dispose();scales.dispose();scaleClock.dispose();owner.dispose();return false}
        sourceHUDStarOwner=owner;sourceHUDStarFeedback=feedback;sourceHUDStarScaleFeedback=scales;sourceHUDStarScaleClock=scaleClock;sourceHUDStarCapture=capture;engine.sourceHUDStarJobsEnabled=true;sourceDisposalSealingEnabled=true
        return true
    }
    func startSourceHUDStarJobs(ids:[String])->Bool {
        guard let owner=sourceHUDStarOwner,let capture=sourceHUDStarCapture,sourceAnimationBindingAdmissionOpen else{return false}
        let epoch=sourceHUDStarEpoch,generation=engine.state.generation
        let receipts=ids.compactMap{id in engine.pendingHUDStars.first{$0.id==id && $0.generation==generation}}
        guard receipts.count==ids.count else{return false}
        var groups:[[NativeHUDStarReceipt]]=[]
        for receipt in receipts {
            if let index=groups.firstIndex(where:{$0.first?.id.dropLast(2)==receipt.id.dropLast(2)}){groups[index].append(receipt)}else{groups.append([receipt])}
        }
        for group in groups {
            guard sourceAnimationBindingAdmissionOpen,sourceHUDStarEpoch==epoch,sourceHUDStarOwner === owner,
                  engine.state.generation==generation,let call=capture(group),sourceAnimationBindingAdmissionOpen,
                  sourceHUDStarEpoch==epoch,sourceHUDStarOwner === owner,engine.state.generation==generation else{return false}
            let sourceOrigins=group.compactMap{sourceCapturedHUDOrigins[$0.id]}.filter{$0.0==generation}
            guard sourceOrigins.isEmpty || (sourceOrigins.count==group.count && sourceOrigins.allSatisfy{$0.1==sourceOrigins[0].1}) else{return false}
            let origin=sourceOrigins.first?.1 ?? call.screenOrigin // unchanged genuine supplier for other family calls.
            guard owner.start(receiptIDs:group.map(\.id),screenOrigin:origin,hudTarget:call.hudTarget) else{return false}
        }
        return true
    }
    func retireSourceHUDStarJobs() {
        sourceHUDStarEpoch &+= 1
        sourceCapturedHUDOrigins=[:]
        let owner=sourceHUDStarOwner;sourceHUDStarOwner=nil;sourceHUDStarCapture=nil
        let feedback=sourceHUDStarFeedback;sourceHUDStarFeedback=nil
        let scales=sourceHUDStarScaleFeedback;sourceHUDStarScaleFeedback=nil
        let scaleClock=sourceHUDStarScaleClock;sourceHUDStarScaleClock=nil
        engine.sourceHUDStarJobsEnabled=false
        feedback?.dispose();scales?.dispose();scaleClock?.dispose();owner?.dispose() // remove caller fields before external Core/job cleanup
    }

    private func startHUDStarFlights(ids: [String],lead: TimeInterval = 0) {
        if sourceHUDStarJobsPresentationEnabled {
            guard startSourceHUDStarJobs(ids:ids) else{
                onSourcePresentationFailure?("source_hud_star_actual_call_capture_not_bound",engine.state.generation)
                onPresentationFailure?("source_hud_star_actual_call_capture_not_bound");return
            }
            return // Source root has its actual caller timing, no Raw Magnet lead.
        }
        guard let geometry else { return }
        let receipts = ids.compactMap { id in engine.pendingHUDStars.first { $0.id == id } }.filter { !hudStarIDs.contains($0.id) }
        guard !receipts.isEmpty else { return }
        if sourceStars==nil {sourceCallbackTime();sourceStars=sourceFrames.begin(.init(kind:.hudStarFlight,generation:engine.state.generation,id:UUID().uuidString))}
        let origins = receipts.map { receipt -> CGPoint in
            let point = geometry.center(row: receipt.origin.row,column: receipt.origin.column)
            return CGPoint(x: point.x,y: size.height-point.y)
        }
        let target = CGPoint(x: scoreArt.position.x,y: size.height-scoreArt.position.y)
        let plans = NativeHUDStarMotion.batch(origins: origins,target: target)
        for (receipt,plan) in zip(receipts,plans) {
            hudStarIDs.insert(receipt.id)
            let star = SKSpriteNode(texture: textures.texture("assets/small-star.png"))
            star.size = CGSize(width: plan.size,height: plan.size)
            let origin = plan.points[0]; star.position = CGPoint(x: origin.x,y: size.height-origin.y)
            hudStarFlights.addChild(star);hudStarNodes[receipt.id]=star
            let visualReceipt = beginVisual(); hudStarVisualReceipts[receipt.id] = visualReceipt; var arrived = false
            requestRendering(true)
            star.run(.sequence([.wait(forDuration: lead),.customAction(withDuration: plan.end) { [weak self,weak star] _,elapsed in
                guard let self,!self.disposed,self.engine.state.generation == receipt.generation,!arrived,let star,self.hudStarNodes[receipt.id] === star,self.hudStarIDs.contains(receipt.id),star.parent === self.hudStarFlights else { return }
                let pose = plan.sample(seconds: Double(elapsed))
                star.position = CGPoint(x: pose.point.x,y: self.size.height-pose.point.y)
                star.size = CGSize(width: pose.size,height: pose.size); star.zRotation = -pose.rotation
                if pose.arrived {
                    arrived = true; star.alpha = 0; star.removeFromParent(); self.hudStarIDs.remove(receipt.id);self.hudStarNodes.removeValue(forKey:receipt.id)
                    self.finishSourceStars()
                    let previous = self.engine.state
                    let result = self.engine.commitHUDStarArrival(receiptID: receipt.id,generation: receipt.generation)
                    self.consume(result,previous: previous)
                    self.onSpecialMoment?(receipt.variant,"hud-star-arrived",receipt.ordinal)
                    self.hudStarVisualReceipts.removeValue(forKey: receipt.id)
                    self.finishVisual(visualReceipt)
                }
            },.removeFromParent()]),withKey: "native-protected-hud-star")
        }
    }

    private func specialIsCurrent(_ plan: NativeSpecialMovePlan) -> Bool {
        !disposed && engine.state.generation == plan.generation && engine.pendingSpecial?.id == plan.id
            && specialPresentationID == plan.id
    }

    private func playReservedSpecial(_ plan: NativeSpecialMovePlan) {
        guard specialPresentationID != plan.id,let geometry else { return }
        specialPresentationID = plan.id;specialPresentationVariant = plan.variant
        specialPresentationIDs = Set(plan.targets.map(\.id))
        let receipt = beginVisual(); navigationLocked = true; requestRendering(true)
        if plan.archetype == .magnet {
            for target in plan.targets {if let node=nodesByID[target.id] {shortWildBoardBlast?.interrupt(node)}}
            if sourceMagnetPullScope != nil {
                if !startSourceMagnetPull(plan,receipt:receipt) {onPresentationFailure?("source_magnet_actual_pull_not_bound")}
                return
            }
            let target = geometry.center(row: plan.destination.cell.row,column: plan.destination.cell.column)
            let pairs = plan.targets.enumerated().compactMap { index,tile -> (NativeDiceNode,NativeMagnetPullMotion)? in
                guard let node = nodesByID[tile.id] else { return nil }
                node.removeAllActions(); node.visual.removeAllActions()
                return (node,NativeMagnetPullMotion(start: node.position,destination: target,tileSize: geometry.tileSize,
                                                   baseScale: geometry.scale,index: index,count: plan.targets.count))
            }
            var arrived = Set<String>()
            let owner = SKNode(); effects.addChild(owner)
            if sourceMagnetBindings != nil {sourceMagnetPullCarriers[plan.id]=owner;sourceMagnetPullFlagOwner=(plan.id,plan.generation)}
            let duration = pairs.map { $0.1.end }.max() ?? 0
            owner.run(.sequence([.customAction(withDuration: max(0.001,duration)) { [weak self,weak owner] _,elapsed in
                guard let self,self.specialIsCurrent(plan) else { owner?.removeAllActions(); owner?.removeFromParent(); return }
                for (node,motion) in pairs where !arrived.contains(node.tileID) {
                    let pose = motion.sample(time: Double(elapsed))
                    node.position = pose.point; node.setScale(pose.scale); node.visual.zRotation = pose.rotation
                    if pose.converged { arrived.insert(node.tileID) }
                }
                if arrived.count == pairs.count {
                    owner?.removeAllActions()
                    self.onSpecialMoment?(plan.variant ?? "magnet","pull",plan.targets.count)
                    self.smoke(at: target,special: true)
                    self.specialPresentationIDs.removeAll()
                    guard self.beginSourceMagnetHelper(plan) else {self.onPresentationFailure?("source_magnet_helper_producer_missing");return}
                    let previous = self.engine.state
                    let prepared:NativeMoveResult
                    if let scope=self.sourceMagnetLazyScope {
                        prepared=self.engine.prepareSourceMagnetLazyRespawn(transactionID:plan.id,generation:plan.generation,sourceCurrent:{[weak self,scope] in
                            guard let self,self.sourceAnimationBindingAdmissionOpen,self.sourceMagnetLazyScope === scope else{return false}
                            return scope.current && self.specialIsCurrent(plan) && self.engine.sourceSpecialAbsorbMainEntered
                        })
                    } else {prepared=self.engine.prepareMagnetRespawn(transactionID:plan.id)}
                    if prepared.accepted,self.sourceMagnetLazyScope != nil,!self.hideSourceMagnetConsumedSix(plan) {self.onPresentationFailure?("source_magnet_consumed_six_hide_not_bound");return}
                    self.consume(prepared,previous: previous)
                    if !prepared.accepted {self.sourceMagnetHelpers[plan.id]?.retire();return}
                    self.startMagnetRespawn(plan,receipt: receipt,owner: owner)

                }
            },.removeFromParent()]))
        } else if plan.archetype == .tnt {
            if sourceTntMainEntries[plan.id] != nil {sourceTntNativeVisualReceipts[plan.id]=receipt;return}
            let blastIDs=Set(engine.state.tiles.filter {$0.id != plan.destination.id && ($0.value>0 || $0.isWild) && !$0.locked}.map(\.id))
            // The already-painted source absorb owns the same 80ms boundary.
            run(.sequence([.wait(forDuration:0.08),.run { [weak self] in
                guard let self,self.specialIsCurrent(plan) else {return}
                let previous=self.engine.state
                let activated=self.engine.commitSpecialActivation(transactionID:plan.id)
                self.consume(activated,previous:previous)
                guard activated.accepted else {return}
                if plan.variant == "laser-gun" {self.startLaserImpacts(plan,receipt:receipt)}
                else {self.playCoreTntTransaction(plan,receipt:receipt,geometry:geometry,blastIDs:blastIDs)}
            }]),withKey:"native-special-activation")
        }
    }

    private func startMagnetRespawn(_ plan: NativeSpecialMovePlan,receipt: UInt64,owner: SKNode?) {
        guard specialIsCurrent(plan) else { return }
        // Component fallback has no retained Source conversion boundary.
        if sourceMagnetLazyScope==nil {sourceMagnetImpacts.removeValue(forKey:plan.id)?.dispose()}
        if sourceMagnetBindings != nil {
            if !startSourceMagnetRespawn(plan,receipt:receipt,carrier:owner) {onPresentationFailure?("source_magnet_replacement_producer_not_bound")}
            return
        }
        let count = engine.pendingMagnetRespawn?.replacements.count ?? 0
        var actions: [SKAction] = [.wait(forDuration: 0.05)]
        for index in 0..<count {
            if index > 0 { actions.append(.wait(forDuration: 0.15)) }
            actions.append(.run { [weak self] in
                guard let self,self.specialIsCurrent(plan) else { return }
                let previous = self.engine.state
                let result = self.engine.commitMagnetReplacement(transactionID: plan.id,index: index)
                self.consume(result,previous: previous)
            })
        }
        // Exact openAtCell scale timeline .56 plus source per-spawn validation
        // wait .05; only the survivor bounce is a post-commit decorative tail.
        actions += [.wait(forDuration: 0.56+0.05),.run { [weak self,weak owner] in
            guard let self,self.specialIsCurrent(plan) else { owner?.removeFromParent(); return }
            let previous = self.engine.state
            let result = self.engine.commitSpecialBoard(transactionID: plan.id)
            if result.accepted {
                if let helper=self.sourceMagnetHelpers[plan.id] {
                    helper.boardCommitted(spawnCount:count,shouldRunPostCheck:true,publish:{[weak self] in self?.sourceSpecialTransactions?.boardCommitted(id:plan.id,generation:plan.generation)})
                }else {self.sourceSpecialTransactions?.boardCommitted(id:plan.id,generation:plan.generation)}
            }
            self.specialPresentationID = nil
            self.consume(result,previous: previous)
            self.navigationLocked = self.engine.state.terminal != nil || self.pendingTerminal != nil
            self.finishVisual(receipt); owner?.removeFromParent()
        }]
        owner?.run(.sequence(actions),withKey: "captured-magnet-respawn")
    }

    private func playCoreTntTransaction(_ plan: NativeSpecialMovePlan,receipt: UInt64,geometry: NativeBoardGeometry,blastIDs:Set<String>) {
        let center = geometry.center(row: plan.destination.cell.row,column: plan.destination.cell.column)
        // Carrier ownership includes awaited assets and the painted landing
        // handoff, not just the visible flight. No blast may borrow that die.
        let blastNodes = engine.state.tiles.compactMap { tile -> NativeDiceNode? in
            guard blastIDs.contains(tile.id),tile.id != plan.source.id,tile.id != plan.destination.id,tile.value > 0 || tile.isWild,
                  !tile.locked else { return nil }
            guard let node=nodesByID[tile.id],shortWildBoardBlast?.owns(node) != true,
                  sourceMeterCaller?.owns(node) != true else{return nil}
            return node
        }
        specialPresentationIDs.formUnion(blastNodes.map(\.tileID))
        let scope=sourceBoardEntryScope ?? sourceSixScope ?? sourceRuntimeObservationScope
        let usesSourceMath=sourceOuterTimelineDriver != nil
        if usesSourceMath {guard let scope,scope.current,engine.sourceMathRandom === scope.mathRandom,sourceOuterTimelineDriver === scope.timeline else{return}}
        let draw:()->Double = {
            if usesSourceMath,let scope {return scope.mathRandom.next()}
            return Double.random(in:0..<1)
        }
        let date:()->Double? = {
            if usesSourceMath {return scope?.captureSourceDateMilliseconds()}
            return floor(Date().timeIntervalSince1970*1000)
        }
        let sourceBlast:NativeSourceTntBoardBlastOwner?
        if plan.variant == nil,let scope=sourceTntMainScope,scope.current {
            guard sourceTntBoardBlast==nil else{return}
            let captured=NativeSourceTntBoardBlastOwner(service:scope.service)
            sourceTntBoardBlast=captured;sourceBlast=captured
        } else {sourceBlast=nil}
        let beachCurrent:()->Bool = { [weak self] in
            guard let self,self.specialIsCurrent(plan),(!usesSourceMath || scope?.current==true) else{return false}
            return blastNodes.allSatisfy{self.nodesByID[$0.tileID] === $0 && $0.parent === self.canvasRoot}
        }
        let beachPlans:[NativeShortWildBoardBlastPlan]?
        if plan.variant == "beach-ball" {
            beachPlans=NativeShortWildBoardBlastPlan.make(rests:blastNodes.map(\.position),center:center,tileSize:geometry.tileSize,
                random:draw,dateMilliseconds:date,current:beachCurrent)
            guard beachPlans != nil,beachCurrent() else{return}
        } else {beachPlans=nil}
        let returnPlans = blastNodes.enumerated().compactMap { index,node -> (NativeDiceNode,CGPoint,Double,Double,Double,Double?,CGFloat)? in
            if let beachPlans {
                let motion=beachPlans[index],z=node.zPosition
                node.removeAllActions();node.zPosition=320
                node.run(.sequence([.wait(forDuration:motion.waveDelay),NativeBoardMotion.move(from:motion.rest,to:motion.blast,
                    duration:motion.blastDuration,ease:.backOut(2.9))]),withKey:"tnt-blast")
                return (node,motion.rest,motion.returnDuration,motion.returnElastic,motion.returnAmplitude,motion.returnNotBeforeMilliseconds,z)
            }
            let current:()->Bool = { [weak self,weak node] in
                guard let self,let node else{return false}
                return self.specialIsCurrent(plan) && self.nodesByID[node.tileID] === node && node.parent === self.canvasRoot &&
                    (!usesSourceMath || (scope?.current==true && self.engine.sourceMathRandom === scope?.mathRandom))
            }
            guard let motion=NativeTntBoardBlastPlan.make(rest:node.position,center:center,tileSize:geometry.tileSize,
                random:draw,current:current),current() else{return nil}
            if let sourceBlast {
                guard sourceBlast.start(node:node,plan:motion,current:current) else{return nil}
                return (node,motion.rest,motion.returnDuration,motion.returnElastic,0.6,nil,node.zPosition)
            }
            node.removeAllActions()
            let wobble=SKAction.repeatForever(.sequence([
                NativeBoardMotion.move(from:motion.blast,to:motion.wobble,duration:motion.wobbleDuration,ease:.elasticInOut(1,motion.wobbleElastic)),
                NativeBoardMotion.move(from:motion.wobble,to:motion.blast,duration:motion.wobbleDuration,ease:.elasticInOut(1,motion.wobbleElastic))]))
            node.run(.sequence([NativeBoardMotion.move(from:motion.rest,to:motion.blast,duration:motion.blastDuration,
                ease:.elasticOut(1,motion.returnElastic)),wobble]),withKey:"tnt-blast")
            return (node,motion.rest,motion.returnDuration,motion.returnElastic,0.6,nil,node.zPosition)
        }
        guard specialIsCurrent(plan) else{sourceBlast?.dispose();return}
        if let sourceBlast,returnPlans.count != blastNodes.count {
            sourceTntBoardBlast=nil;sourceBlast.dispose();return
        }
        var returned = false
        let beginReturn: () -> Void = { [weak self] in
            guard let self,self.specialIsCurrent(plan),!returned else { return }; returned = true
            if let sourceBlast {
                guard let scope=self.sourceTntMainScope,scope.current,scope.extendTntBonusGuard(milliseconds:3200),
                      self.specialIsCurrent(plan) else{return}
                _=sourceBlast.beginReturn { [weak self,weak sourceBlast] in
                    guard let self,let sourceBlast,self.sourceTntBoardBlast === sourceBlast,self.specialIsCurrent(plan) else{return}
                    self.sourceTntBoardBlast=nil;sourceBlast.dispose()
                    self.specialPresentationIDs.removeAll()
                    var delivery:NativeSourceAppTimeoutOwner.Receipt?
                    let timer=self.sourceAppTimeouts.schedule(sourceID:"source-tnt-return-bonus0:"+plan.id,generation:plan.generation,
                        delayMilliseconds:0,elapsed:{[weak self,weak scope] in
                            guard let self else{return};if let delivery {self.sourceTntBonusTimers.remove(delivery)}
                            guard let scope,scope.current,self.sourceTntMainScope === scope,self.specialIsCurrent(plan) else{return}
                            self.startCoreTntImpacts(plan,receipt:receipt)
                        })
                    delivery=timer;self.sourceTntBonusTimers.insert(timer)
                }
                return
            }
            var pending = returnPlans.count
            let returnFinished: () -> Void = { [weak self] in
                guard let self,self.specialIsCurrent(plan) else { return }
                pending -= 1
                if pending <= 0 { self.specialPresentationIDs.removeAll(); self.startCoreTntImpacts(plan,receipt: receipt) }
            }
            if returnPlans.isEmpty { self.specialPresentationIDs.removeAll(); self.startCoreTntImpacts(plan,receipt: receipt) }
            for (node,rest,duration,elastic,amplitude,notBefore,z) in returnPlans {
                guard self.specialIsCurrent(plan),self.nodesByID[node.tileID] === node,node.parent === self.canvasRoot else{return}
                let delay:Double
                if let notBefore {
                    guard let now=date(),beachCurrent() else{return}
                    delay=max(0,(notBefore-now)/1000)
                } else {delay=0}
                // The early Beach Ball handoff must let its outward wave reach
                // the spread before replacement of that exact keyed action.
                let startReturn:()->Void = { [weak self,weak node] in
                    guard let self,let node,self.specialIsCurrent(plan),self.nodesByID[node.tileID] === node else{return}
                    node.removeAction(forKey:"tnt-blast")
                    node.run(.sequence([NativeBoardMotion.move(from:node.position,to:rest,duration:duration,ease:.elasticOut(amplitude,elastic)),
                        .run { [weak self,weak node] in
                            guard let self,let node,self.specialIsCurrent(plan),self.nodesByID[node.tileID] === node else{return}
                            node.position=rest;node.zPosition=z;returnFinished()
                        }]),withKey:"tnt-return")
                }
                if delay>0 {node.run(.sequence([.wait(forDuration:delay),.run(startReturn)]),withKey:"tnt-return-wait")}
                else {startReturn()}
            }
        }
        if let variant = plan.variant,let onAuthoredTntPresentation {
            let finaleReceipt = beginVisual()
            let accepted = onAuthoredTntPresentation(variant,CGPoint(x:center.x,y:size.height-center.y),plan.generation,beginReturn) { [weak self] in
                self?.sourceSpecialTransactions?.tntVisualComplete(id:plan.id,generation:plan.generation)
                self?.finishVisual(finaleReceipt)
            }
            if !accepted { finishVisual(finaleReceipt) }
            // An unavailable renderer cannot fabricate a zero-duration phase.
            // Admission rejects this path before reservation; defensive failure
            // remains observable until background settlement cancels its plan.
            if !accepted { NSLog("[NativeTNT] authored owner unavailable %@",variant) }
            if accepted { releaseSourceAuthoredTntInitialAwait(plan) }
        } else {
            let clockID=UUID().uuidString
            var sourceConstruction:NativeTntFinale.SourceConstruction?
            var sourceRandom:(()->Double)?
            if let scope=sourceTntMainScope,plan.variant==nil {
                let current:()->Bool = {[weak self,weak scope] in
                    guard let self,let scope else{return false}
                    return self.sourceAnimationBindingAdmissionOpen && scope.current && self.sourceTntMainScope === scope &&
                        self.engine.state.generation==plan.generation && self.specialIsCurrent(plan) && self.engine.sourceMathRandom === scope.mathRandom
                }
                guard let prepare=onPrepareSourceTntGlyphs,
                      let captured=NativeTntFinale.captureSourceConstruction(textures:textures,current:current,
                        random:{scope.mathRandom.next()},prepareGlyphs:{prepare(clockID,scope,plan.generation)}),current() else {
                    onTntGlyphClock?(clockID,NativeTntFinale.duration,true)
                    onSourcePresentationFailure?("source_tnt_finale_constructor_not_admitted",plan.generation);return
                }
                sourceConstruction=captured
                sourceRandom = {[weak scope] in scope?.mathRandom.next() ?? .nan}
                sourceTntFinaleSourceConstructionCount+=1
            }
            let owner = NativeTntFinale(textures: textures,fontName: finaleFontName,viewport: size,showsTitle: onTntGlyphClock == nil,
                sourceConstruction:sourceConstruction,sourceRandom:sourceRandom,random:draw)
            configureTntGlyphClock(owner,id:clockID); owner.zPosition = 999998; effects.addChild(owner)
            if sourceTntMainScope != nil {registerSourceCoreTntShakeTarget(owner,ownerID:plan.id,generation:plan.generation)}
            let finaleReceipt = beginVisual()
            let completed: () -> Void = { [weak self] in
                if sourceBlast != nil {beginReturn()}
                self?.sourceSpecialTransactions?.tntVisualComplete(id:plan.id,generation:plan.generation)
                self?.finishVisual(finaleReceipt)
            }
            if let scope=sourceTntMainScope,scope.current,plan.variant == nil {
                let installed=owner.playSource(service:scope.service,current:{ [weak self,weak owner] in
                    guard let self,let owner else{return false}
                    return !self.disposed && scope.current && self.sourceTntMainScope === scope &&
                        self.engine.state.generation == plan.generation && owner.parent === self.effects
                },frameSix:beginReturn,sequenceComplete:{[weak self,weak scope] in
                    guard let self,let scope,scope.current,self.sourceTntMainScope === scope,
                          self.engine.state.generation==plan.generation else{return}
                    // Authored last-frame fade settles the genuine visual claim;
                    // independent debris/glyph parent keeps its own finite tail.
                    self.sourceSpecialTransactions?.tntVisualComplete(id:plan.id,generation:plan.generation)
                },cancelled:{[weak self] in self?.finishVisual(finaleReceipt)},completion:completed)
                if !installed {owner.dispose();finishVisual(finaleReceipt);return}
                guard scope.current,sourceTntMainScope === scope,owner.parent === effects,
                      let spawnReceipt=engine.sourceTntSpawnBeginReceipt,
                      engine.releaseSourceTntInitialAwait(spawnReceipt) else {
                    onSourcePresentationFailure?("source_tnt_initial_await_not_admitted",plan.generation);return
                }
                return
            }
            owner.play(completion:completed)
            // Source frame 6 completes at .07 + 5*.04 + .24 = .51.
            run(.sequence([.wait(forDuration:0.51),.run(beginReturn)]),withKey:"special-tnt-frame6")
        }
    }

    private func startLaserImpacts(_ initial:NativeSpecialMovePlan,receipt:UInt64) {
        guard specialIsCurrent(initial),let geometry,let onAuthoredLaserImpact else {return}
        let previous=engine.state,reserved=engine.reserveTntTargets(transactionID:initial.id)
        consume(reserved,previous:previous)
        guard reserved.accepted,let plan=engine.pendingSpecial else {return}
        let targets=engine.pendingLaserShots.compactMap {shot->NativeLaserVisualTarget? in
            guard let tile=plan.targets.first(where:{$0.id == shot.tileID}) else {return nil}
            let point=geometry.center(row:tile.cell.row,column:tile.cell.column)
            return NativeLaserVisualTarget(tileID:tile.id,point:CGPoint(x:point.x,y:size.height-point.y),shooter:shot.shooter)
        }
        guard targets.count == plan.targets.count else {return}
        if targets.isEmpty {
            guard let onAuthoredFinale else{return}
            let point=geometry.center(row:plan.destination.cell.row,column:plan.destination.cell.column)
            let visual=beginVisual()
            let mounted=onAuthoredFinale("laser-gun",CGPoint(x:point.x,y:size.height-point.y),plan.generation) {[weak self] in
                self?.sourceSpecialTransactions?.tntVisualComplete(id:plan.id,generation:plan.generation)
                self?.finishVisual(visual)
            }
            guard mounted else{finishVisual(visual);return}
            releaseSourceAuthoredTntInitialAwait(plan)
            let before=engine.state,released=engine.releaseTntReservation(transactionID:plan.id)
            guard released.accepted else{return}
            sourceSpecialTransactions?.boardCommitted(id:plan.id,generation:plan.generation)
            consume(released,previous:before)
            if let scope=sourceTntMainScope,scope.current {
                startSourceTntBonusImpacts(plan,receipt:receipt,scope:scope)
            } else {
                let previous=engine.state,result=engine.commitSpecialBoard(transactionID:plan.id)
                if result.accepted {sourceSpecialTransactions?.tntGameplayComplete(id:plan.id,generation:plan.generation)}
                specialPresentationID=nil;specialPresentationIDs.removeAll()
                consume(result,previous:previous)
                navigationLocked=engine.state.terminal != nil || pendingTerminal != nil
                finishVisual(receipt)
            }
            return
        }
        specialPresentationIDs=Set(plan.targets.map(\.id))
        var pendingSpawns=Set<String>(),allContacts=false,committed=false
        let completeGameplay:() -> Void = { [weak self] in
            guard let self,self.specialIsCurrent(plan),allContacts,pendingSpawns.isEmpty,!committed else {return}
            committed=true
            let previous=self.engine.state,result=self.engine.commitSpecialBoard(transactionID:plan.id)
            if result.accepted {self.sourceSpecialTransactions?.tntGameplayComplete(id:plan.id,generation:plan.generation)}
            self.specialPresentationID=nil;self.specialPresentationIDs.removeAll();self.laserSpawnCallbacks.removeAll()
            self.consume(result,previous:previous)
            self.navigationLocked=self.engine.state.terminal != nil || self.pendingTerminal != nil
            self.finishVisual(receipt)
            // Original bonus markBreakComplete invokes checkLevelEnd after
            // its actual replacement completion/onComplete boundary.
            if result.accepted,self.engine.state.generation==plan.generation {self.evaluate()}
        }
        let impact:(Int,String) -> Bool = { [weak self] index,id in
            guard let self,self.specialIsCurrent(plan),targets.indices.contains(index),targets[index].tileID == id else {return false}
            pendingSpawns.insert(id)
            self.laserSpawnCallbacks[id] = { [weak self] in
                guard let self,self.specialIsCurrent(plan) else {return}
                pendingSpawns.remove(id);completeGameplay()
            }
            let origin=self.nodesByID[id].flatMap{self.sourceSpecialHUDScreenOrigin(node:$0,generation:plan.generation)}
            let impactNode=self.nodesByID[id]
            if self.sourceHUDStarJobsPresentationEnabled,origin==nil {self.onSourcePresentationFailure?("source_laser_bonus_hud_origin_holder_missing",plan.generation);return false}
            let previous=self.engine.state,result=self.engine.commitSpecialImpact(transactionID:plan.id,tileID:id)
            guard self.consumeSourceSpecialHUDCall(result,previous:previous,origin:origin) else {self.laserSpawnCallbacks.removeValue(forKey:id);pendingSpawns.remove(id);return false}
            if self.sourceStackCoreFaceReceiptsEnabled,
               let configuration=NativeSixSourceShakeGraph.Configuration.laserImpact(index:index),
               !self.playSourceWildScreenShake(configuration,ownerID:plan.id,variant:plan.variant,generation:plan.generation) {
                self.onSourcePresentationFailure?("source_laser_impact_screen_shake_rejected",plan.generation);return false
            }
            self.onSpecialMoment?("laser-gun","impact",index)
            self.onHaptic?("protected-heavy")
            if self.sourceStackCoreFaceReceiptsEnabled {
                guard let impactNode,self.playSourceSpecialImpactParticles(variant:"laser-gun",target:impactNode,generation:plan.generation) else {
                    self.onSourcePresentationFailure?("source_laser_impact_particles_rejected",plan.generation);return false
                }
            } else if let tile=plan.targets.first(where:{$0.id==id}) {self.smoke(at:geometry.center(row:tile.cell.row,column:tile.cell.column),special:false)}
            return true
        }
        let visualReceipt=beginVisual()
        let mounted=onAuthoredLaserImpact(targets,plan.generation,impact,{allContacts=true;completeGameplay()}) { [weak self] in
            self?.sourceSpecialTransactions?.tntVisualComplete(id:plan.id,generation:plan.generation)
            self?.finishVisual(visualReceipt)
        }
        guard mounted else {finishVisual(visualReceipt);return}
        releaseSourceAuthoredTntInitialAwait(plan)
        let beforeRelease=engine.state,released=engine.releaseTntReservation(transactionID:plan.id)
        if released.accepted {sourceSpecialTransactions?.boardCommitted(id:plan.id,generation:plan.generation)}
        consume(released,previous:beforeRelease)
    }

    /// Authored variants release the same captured coroutine only after their
    /// actual presentation owner has accepted the transaction.
    private func releaseSourceAuthoredTntInitialAwait(_ plan:NativeSpecialMovePlan) {
        guard engine.sourceTntInitialAwaitEnabled else{return}
        guard let scope=sourceTntMainScope,scope.current,sourceAnimationBindingAdmissionOpen,
              specialIsCurrent(plan),let receipt=engine.sourceTntSpawnBeginReceipt,
              receipt.ownerID==plan.id,receipt.generation==plan.generation,
              engine.releaseSourceTntInitialAwait(receipt) else {
            onSourcePresentationFailure?("source_authored_tnt_initial_await_not_admitted",plan.generation);return
        }
    }

    private func startCoreTntImpacts(_ initial: NativeSpecialMovePlan,receipt: UInt64) {
        guard specialIsCurrent(initial) else { return }
        if let scope=sourceTntMainScope,initial.variant==nil {
            guard scope.current,scope.extendTntBonusGuard(milliseconds:2500),specialIsCurrent(initial) else{return}
        }
        let beforeReserve=engine.state
        let reserved=engine.reserveTntTargets(transactionID:initial.id)
        consume(reserved,previous:beforeReserve)
        guard reserved.accepted,let plan=engine.pendingSpecial else {return}
        specialPresentationIDs=Set(plan.targets.map(\.id))
        let beforeRelease = engine.state
        let released = engine.releaseTntReservation(transactionID:plan.id)
        if released.accepted {sourceSpecialTransactions?.boardCommitted(id:plan.id,generation:plan.generation)}
        consume(released,previous:beforeRelease)
        if let scope=sourceTntMainScope,scope.current,plan.variant==nil {
            startSourceTntBonusImpacts(plan,receipt:receipt,scope:scope);return
        }
        let owner = SKNode(); effects.addChild(owner)
        let delays = plan.variant == "beach-ball" ? [0.0,0.26,0.56,0.9] : [0.0,0.2,0.4,0.6]
        let initialDelay = plan.variant == "flower" ? 0.7 : plan.variant == "barell" ? 0.2 : 0
        let capturedMicrotasks=sourceMicrotaskInstallation
        let renderAction: (@escaping ()->Void)->()->Void = {[weak self,capturedMicrotasks] body in
            return {[weak self,capturedMicrotasks] in
                guard let self,self.specialIsCurrent(plan) else{return}
                if let capturedMicrotasks {
                    guard self.sourceMicrotaskInstallation === capturedMicrotasks,capturedMicrotasks.isCurrent else{return}
                    _=capturedMicrotasks.renderActionTask(body)
                } else if self.sourceMicrotaskInstallation==nil {body()}
            }
        }
        var actions: [SKAction] = initialDelay > 0 ? [.wait(forDuration:initialDelay)] : []
        for (index,tile) in plan.targets.enumerated() {
            if index > 0 { actions.append(.wait(forDuration:delays[index]-delays[index-1])) }
            actions.append(.run(renderAction { [weak self] in
                guard let self,self.specialIsCurrent(plan) else { return }
                let origin=self.nodesByID[tile.id].flatMap{self.sourceSpecialHUDScreenOrigin(node:$0,generation:plan.generation)}
                let impactNode=self.nodesByID[tile.id]
                if self.sourceHUDStarJobsPresentationEnabled,origin==nil {self.onSourcePresentationFailure?("source_authored_tnt_bonus_hud_origin_holder_missing",plan.generation);return}
                let previous = self.engine.state
                let result = self.engine.commitSpecialImpact(transactionID: plan.id,tileID: tile.id)
                guard self.consumeSourceSpecialHUDCall(result,previous:previous,origin:origin) else{return}
                if result.accepted,let geometry = self.geometry {
                    self.onSpecialMoment?(plan.variant ?? "tnt","impact",index)
                    if index == 0 || index == plan.targets.count-1 { self.onHaptic?("heavy") }
                    if self.sourceStackCoreFaceReceiptsEnabled {
                        guard let impactNode,self.playSourceSpecialImpactParticles(variant:plan.variant,target:impactNode,generation:plan.generation) else {
                            self.onSourcePresentationFailure?("source_authored_tnt_impact_particles_rejected",plan.generation);return
                        }
                    } else {self.smoke(at: geometry.center(row: tile.cell.row,column: tile.cell.column),special: false)}
                }
            }))
        }
        actions += [.wait(forDuration: 0.56+0.08),.run(renderAction { [weak self,weak owner] in
            guard let self,self.specialIsCurrent(plan) else { owner?.removeFromParent(); return }
            let previous = self.engine.state
            let result = self.engine.commitSpecialBoard(transactionID: plan.id)
            if result.accepted {self.sourceSpecialTransactions?.tntGameplayComplete(id:plan.id,generation:plan.generation)}
            self.specialPresentationID = nil; self.specialPresentationIDs.removeAll()
            self.consume(result,previous: previous)
            self.navigationLocked = self.engine.state.terminal != nil || self.pendingTerminal != nil
            self.finishVisual(receipt); owner?.removeFromParent()
            // Source app-core markBreakComplete: onComplete, then checkLevelEnd.
            // Keep its existing authored completion clock; no extra timer.
            if result.accepted,self.engine.state.generation==plan.generation {self.evaluate()}
        })]
        owner.run(.sequence(actions),withKey: "tnt-captured-impacts")
    }

    private func startSourceTntBonusImpacts(_ plan:NativeSpecialMovePlan,receipt:UInt64,scope:NativeGameplaySourceContext.Scope) {
        guard scope.current,sourceTntMainScope === scope,sourceAppTimeouts.sourceMicrotaskTasks === scope.sourceMicrotaskTasks else{return}
        let current:()->Bool = {[weak self,weak scope] in
            guard let self,let scope else{return false}
            return scope.current && self.sourceTntMainScope === scope && self.specialIsCurrent(plan)
        }
        let completeGameplay:()->Void = {[weak self] in
            guard let self,current() else{return}
            let previous=self.engine.state,result=self.engine.commitSpecialBoard(transactionID:plan.id)
            guard result.accepted,scope.current,self.sourceTntMainScope === scope,self.engine.state.generation==plan.generation else{return}
            if plan.targets.isEmpty {self.sourceTntNoTargetCompletionCount+=1}
            self.sourceSpecialTransactions?.tntGameplayComplete(id:plan.id,generation:plan.generation)
            self.specialPresentationID=nil;self.specialPresentationIDs.removeAll()
            self.consume(result,previous:previous)
            self.navigationLocked=self.engine.state.terminal != nil || self.pendingTerminal != nil
            self.finishVisual(receipt)
            if !plan.targets.isEmpty,self.engine.state.generation==plan.generation {self.evaluate()}
        }
        // Original helper returns synchronously after actual empty reservation;
        // no settlement Date450 or complete80 task exists for this branch.
        if plan.targets.isEmpty {completeGameplay();return}
        var remaining=plan.targets.count,committed=false
        var safety:NativeSourceAppTimeoutOwner.Receipt?
        let settled:()->Void = {[weak self] in
            guard let self,current(),!committed else{return}
            remaining-=1;guard remaining<=0 else{return};committed=true
            if let safety {self.sourceTntBonusTimers.remove(safety);_=self.sourceAppTimeouts.cancel(safety)}
            guard scope.extendTntBonusGuard(milliseconds:450),current() else{return}
            var delivery:NativeSourceAppTimeoutOwner.Receipt?
            self.sourceTntCompletion80ScheduledCount+=1
            let timer=self.sourceAppTimeouts.schedule(sourceID:"source-tnt-bonus-complete80:"+plan.id,generation:plan.generation,delayMilliseconds:80,elapsed:{[weak self] in
                guard let self else{return};if let delivery {self.sourceTntBonusTimers.remove(delivery)}
                completeGameplay()
            })
            delivery=timer;self.sourceTntBonusTimers.insert(timer)
        }
        let force=sourceAppTimeouts.schedule(sourceID:"source-tnt-bonus-force:"+plan.id,generation:plan.generation,
            delayMilliseconds:max(1600,(plan.targets.count-1)*200+1600),elapsed:{[weak self] in
                guard let self,current(),!committed else{return}
                if let safety {self.sourceTntBonusTimers.remove(safety)}
                remaining=1;settled()
            })
        safety=force;sourceTntBonusTimers.insert(force)
        let deadline=DispatchTime.now()
        for (index,tile) in plan.targets.enumerated() {
            let impact:()->Void = {[weak self] in
                guard let self,current(),!committed else{return}
                guard let target=self.nodesByID[tile.id],target.parent === self.canvasRoot,let host=self.gameplayRenderHost else {
                    self.onSourcePresentationFailure?("source_tnt_bonus_origin_holder_missing",plan.generation);return
                }
                let origin=host.scenePointToView(target.convert(CGPoint.zero,to:self),scene:self)
                guard self.geometry != nil,self.sourceSixShared?.canAdmit==true else {
                    self.onSourcePresentationFailure?("source_tnt_bonus_shared_fx_not_bound",plan.generation);return
                }
                self.onSpecialMoment?("tnt","impact",index)
                if index==0 || index==plan.targets.count-1 {self.onHaptic?("heavy")}
                guard current() else{return}
                guard self.playSourceSpecialImpactParticles(variant:nil,target:target,generation:plan.generation) else {
                    self.onSourcePresentationFailure?("source_tnt_bonus_shared_fx_rejected",plan.generation);return
                }
                guard current() else{return};self.sourceTntBonusSharedFxCount+=1
                guard let particle=scope.hudStarTextures.selectStandardTntBonusParticle(random:{scope.mathRandom.next()},current:current),
                      self.sourceHUDStarOwner?.acceptsParticle(particle)==true,current() else {
                    self.onSourcePresentationFailure?("source_tnt_bonus_particle_selection_not_admitted",plan.generation);return
                }
                let previous=self.engine.state,result=self.engine.commitSpecialImpact(transactionID:plan.id,tileID:tile.id)
                guard result.accepted,current(),let replacement=result.state.tiles.first(where:{$0.cell==tile.cell && $0.id != tile.id}),
                    self.prepareSourceOrdinaryFreshOpenFace(result,id:replacement.id,generation:plan.generation),current() else {
                    self.onSourcePresentationFailure?("source_tnt_bonus_constructor_not_admitted",plan.generation);return
                }
                self.sourceTntBonusConstructorCount+=1
                self.sourceTntBonusBounces[replacement.id] = {[weak self] in
                    guard let self,scope.current,self.sourceTntMainScope === scope,self.engine.state.generation==plan.generation,
                          let fifo=self.sourceMicrotaskInstallation,fifo.isCurrent else{return}
                    _=fifo.enqueue{[weak self,weak fifo] in
                        guard let self,let fifo,fifo.isCurrent,self.sourceMicrotaskInstallation === fifo,scope.current,
                              self.sourceTntMainScope === scope,self.engine.state.generation==plan.generation,
                              scope.recordTntBonusReplacement(),scope.current else{return}
                        _=fifo.enqueue{if current(){settled()}}
                    }
                }
                guard let hud=self.captureSourceHUDOrigins(result,screenOrigin:origin),current() else {
                    self.onSourcePresentationFailure?("source_tnt_bonus_hud_origin_not_admitted",plan.generation);return
                }
                self.consume(result,previous:previous)
                for id in hud {self.sourceCapturedHUDOrigins.removeValue(forKey:id)}
            }
            if index==0 {impact()}
            else {
                var timer:NativeSourceAppTimeoutOwner.Receipt?
                let installed=sourceAppTimeouts.schedule(sourceID:"source-tnt-bonus:"+plan.id+":\(index)",generation:plan.generation,
                    delayMilliseconds:index*200,from:deadline,elapsed:{[weak self] in
                        if let timer {self?.sourceTntBonusTimers.remove(timer)};impact()
                    })
                timer=installed;sourceTntBonusTimers.insert(installed)
            }
        }
    }

    private var sourceFizzCanvasPaintable:Bool {
        guard !disposed,!suspended,let host=gameplayRenderHost else{return false}
        var surface:UIView?=host.renderView
        while let current=surface {
            if current.isHidden || Float(current.alpha)<=Float(0.001){return false};surface=current.superview
        }
        return true
    }

    private var sourceShimmerCanvasPaintable:Bool {
        guard !disposed,!suspended,let host=gameplayRenderHost,!host.renderingPaused else{return false}
        var surface:UIView?=host.renderView
        while let current=surface {
            if current.isHidden || Float(current.alpha)<=Float(0.001) {return false}
            surface=current.superview
        }
        return true
    }
    /// Shared renderer sampling only, mirroring Source's250ms visibility owner.
    /// Special registry/drag pressure never silently owns this separate gloss.
    func reconcileSourceWildShimmerVisibility(){
        guard sourceWildShimmerEnabled else{return}
        let paintable=sourceShimmerCanvasPaintable
        for node in engine.state.tiles.compactMap({nodesByID[$0.id]}) {node.reconcileSourceWildShimmerVisibility(canvasPaintable:paintable)}
    }

    override func update(_ currentTime: TimeInterval) {
        guard !sourceDisposalInProgress else {return}
        guard !disposed, !suspended else { lastFrame = nil; return }
        defer {if onTutorialSpecialBarSettled != nil,tutorialSpecialBarSettled {onTutorialSpecialBarSettled?()}}
        if frameDiagnosticsEnabled {
            if let previous=diagnosticDragInput.sceneTime,draggedID != nil {
                let gap=max(0,(currentTime-previous)*1000)
                diagnosticDragInput.sceneGaps+=1;diagnosticDragInput.sceneGapWorst=max(diagnosticDragInput.sceneGapWorst,gap)
                if gap>20 {diagnosticDragInput.sceneOver20+=1};if gap>30 {diagnosticDragInput.sceneOver30+=1}
            }
            diagnosticDragInput.sceneTime=currentTime
            if draggedID != nil {
                let arrival=CACurrentMediaTime()*1000,phase=arrival-currentTime*1000
                if let previous=diagnosticDragInput.arrivalTime {
                    let gap=max(0,arrival-previous)
                    diagnosticDragInput.arrivalGaps+=1;diagnosticDragInput.arrivalGapWorst=max(diagnosticDragInput.arrivalGapWorst,gap)
                    if gap>20 {diagnosticDragInput.arrivalOver20+=1};if gap>30 {diagnosticDragInput.arrivalOver30+=1}
                }
                diagnosticDragInput.arrivalTime=arrival
                diagnosticDragInput.phaseMinimum=min(diagnosticDragInput.phaseMinimum ?? phase,phase)
                diagnosticDragInput.phaseMaximum=max(diagnosticDragInput.phaseMaximum ?? phase,phase)
            } else {diagnosticDragInput.arrivalTime=nil}
        }
        let diagnosticStart=frameDiagnosticsEnabled ? CACurrentMediaTime():nil
        defer {if let diagnosticStart {diagnosticUpdateWorstMs=max(diagnosticUpdateWorstMs,(CACurrentMediaTime()-diagnosticStart)*1000)}}
        renderPipelineProbe?.step(scene:self,atTime:currentTime)
        retainSourceRendererDragTransport()
        if let lease=sourceRendererDragTransport,let service=sourceStackFrameService {
            let generation=engine.state.generation
            let delivered=service.deliverRendererFrame(lease,rawFrameMilliseconds:currentTime*1000)
            // A canonical batch may dispose, replace or suspend this Scene.
            guard !sourceDisposalInProgress,!disposed,!suspended,!isPaused,
                  engine.state.generation==generation,sourceStackFrameService === service else{return}
            if delivered {
                guard let host=gameplayRenderHost,host.renderedScene === self,host.renderView.window != nil,!host.renderingPaused,!host.renderView.isHidden else{return}
                if let successor=sourceRendererDragTransport,successor !== lease {return}
            }
        }
        let rawMilliseconds=CACurrentMediaTime()*1000,configuredFPS=Double(gameplayRenderHost?.renderingFPS ?? 60)
        // Use the same monotonic seconds as finishDrag. Expire while waiting,
        // without a second timer or a full board/layout synchronization.
        if engine.state.terminal == nil && !exitInProgress && engine.state.combo > 0 {
            let previousCombo = engine.state.combo
            engine.expireCombo(now:rawMilliseconds/1000)
            if engine.state.combo != previousCombo {synchronizeComboHUD();layoutHUD()}
        }
        recordDiagnosticFrame(nowMs:rawMilliseconds,configuredFPS:configuredFPS)
        if !sourceFramesAttached {
            sourceFramesAttached=true;sourceFrames.attach(rendererID:1,nowMs:rawMilliseconds,configuredFPS:configuredFPS)
        } else {sourceFrames.frame(nowMs:rawMilliseconds,configuredFPS:configuredFPS)}
        if let diagnosticStart {diagnosticCadenceWorstMs=max(diagnosticCadenceWorstMs,(CACurrentMediaTime()-diagnosticStart)*1000)}
        if let receipt=hudEntryReceipt {
            if receipt.generation != engine.state.generation {cancelEntry()}
            else if hudEntryReveal.renderedCallback(receipt) {startHUDDrop(receipt)}
        }
        let elapsedDelta=lastFrame.map {max(0,currentTime-$0)} ?? 0
        dragTrail.advance(delta:elapsedDelta,timeMilliseconds:rawMilliseconds)
        let delta=min(0.05,elapsedDelta)
        if engine.state.combo>=5 {
            comboHUDMotion.advance(delta:delta,visible:!exitInProgress && engine.state.terminal == nil && !hud.isHidden && hud.alpha>0 && gameplayRenderHost?.renderView.window != nil && sourceShimmerCanvasPaintable,reducedMotion:UIAccessibility.isReduceMotionEnabled)
        }
        let comboVisible = !exitInProgress && engine.state.terminal == nil && !hud.isHidden && hud.alpha>0 && gameplayRenderHost?.renderView.window != nil && sourceShimmerCanvasPaintable
        if comboNumberMotion.advance(delta:elapsedDelta>0.5 ? 0.033:elapsedDelta,visible:comboVisible,reducedMotion:UIAccessibility.isReduceMotionEnabled) {
            layoutComboValue(top:comboArt.position.y)
        }
        // GSAP's source ticker uses full elapsed time for sub500ms hitches,
        // and its default lag smoothing substitutes33ms after larger stalls.
        let fizzDelta=elapsedDelta>0.5 ? 0.033:elapsedDelta
        lastFrame = currentTime
        let diagnosticIdleStart=frameDiagnosticsEnabled ? CACurrentMediaTime():nil
        defer {if let diagnosticIdleStart {diagnosticIdleWorstMs=max(diagnosticIdleWorstMs,(CACurrentMediaTime()-diagnosticIdleStart)*1000)}}
        sourceShimmerVisibilityElapsedMs+=min(100,max(0,elapsedDelta*1000))
        if sourceShimmerVisibilityElapsedMs>=250 {
            sourceShimmerVisibilityElapsedMs.formTruncatingRemainder(dividingBy:250)
            reconcileSourceWildShimmerVisibility()
            for node in nodesByID.values {node.reconcileSourceIdleBubbleVisibility()}
        }
        if !sourceFrames.isSpecialIdleSuspended {textures.advanceIdlePhases()}
        for node in nodesByID.values {
            node.tickSourcePlainStarSheet(deltaMilliseconds:elapsedDelta*1000,suspended:engine.state.terminal != nil || exitInProgress || specialPresentationIDs.contains(node.tileID))
            node.tickSourceIdleBubbles(fizzDelta,suspended:engine.state.terminal != nil || exitInProgress || specialPresentationIDs.contains(node.tileID))
        }
        for node in nodesByID.values where node.hasAnimatedArtwork {
            node.tick(delta, suspended: (sourceFrames.isSpecialIdleSuspended && !node.keepsDirectArtworkDuringRegistryPressure) || engine.state.terminal != nil || exitInProgress || specialPresentationIDs.contains(node.tileID), viewportCenter: size.width / 2,fizzDelta:fizzDelta)
        }
    }

    override func didFinishUpdate() {
        if let binding=sourceMicrotaskInstallation {
            _=binding.renderedHandoff{[self] in sourceDidFinishUpdate()}
        } else {sourceDidFinishUpdate()}
        // Apply after SKActions and rendered-handoff FIFO writers, before pixels.
        applyTutorialSpecialBarFocus();sourceTutorialFourthExitAlpha?.paint()
        if exitInProgress {
            for node in nodesByID.values {node.synchronizeSourcePlainStarHostPose()}
        }
        roundIndicator.isHidden=engine.state.mode != .arcade || engine.state.tutorial?.shouldLockHUD == true
        if engine.state.tutorial?.shouldLockHUD==true {
            for child in hud.children where child !== noMoves {
                let meterFocused = (!tutorialSpecialBarFocus.isEmpty || engine.state.tutorial?.specialBarAcknowledged == true) && (child.name=="wildLoader" || child === meter || child === meterBackground)
                let tutorialBubble = !tutorialSpecialBarFocus.isEmpty && child.name=="wild-meter-smoke"
                if !tutorialBubble {child.alpha = meterFocused ? 1:min(child.alpha,0.2)}
            }
            roundIndicator.alpha=min(roundIndicator.alpha,0.2)
        }
    }
    private func sourceDidFinishUpdate() {
        guard !disposed, !suspended else { return }
        onRenderSurfacePreparation?()
        guard !disposed,!suspended else{return}
        if frameDiagnosticsEnabled,let id=draggedID,let node=diagnosticExpectedDragNode,
           nodesByID[id] === node,diagnosticExpectedDragGeneration==engine.state.generation,
           let expected=diagnosticExpectedDragPosition {
            let now=CACurrentMediaTime()*1000
            if let stamp=diagnosticDragInput.paintedOSTimestampMs {diagnosticDragInput.renderAgeWorst=max(diagnosticDragInput.renderAgeWorst,max(0,now-stamp))}
            if let stamp=diagnosticDragInput.paintedCoalescedTimestampMs {diagnosticDragInput.coalescedRenderAgeWorst=max(diagnosticDragInput.coalescedRenderAgeWorst,max(0,now-stamp))}
            let position=node.position,error=hypot(position.x-expected.x,position.y-expected.y)
            diagnosticDragInput.positionChecks+=1;diagnosticDragInput.positionErrorWorst=max(diagnosticDragInput.positionErrorWorst,Double(error))
            if error>0.001 {diagnosticDragInput.positionMismatches+=1}
        }
        if frameDiagnosticsEnabled {diagnosticDragRender.rendered(at:CACurrentMediaTime()*1000,dragging:draggedID != nil)}
        let diagnosticStart=frameDiagnosticsEnabled ? CACurrentMediaTime():nil
        defer {if let diagnosticStart {diagnosticHandoffWorstMs=max(diagnosticHandoffWorstMs,(CACurrentMediaTime()-diagnosticStart)*1000)}}
        resumeSourceEntryDeferredVariantIdle()
        flushSourcePlainStarSheetStarts()
        if firstBoardFrameCount<2 {
            // Startup may precede attaching the SKScene to its visible SKView.
            // Resolve that real first-paint visibility handoff immediately.
            for node in nodesByID.values {node.reconcileSourceIdleBubbleVisibility()}
            firstBoardFrameCount+=1;if firstBoardFrameCount==2 {onFirstBoardFrame?()}
        }
        sourceMeterRenderEpoch &+= 1
        sourceMeterCaller?.painted(epoch:sourceMeterRenderEpoch,
            onscreen:gameplayRenderHost?.renderView.window != nil && gameplayRenderHost?.renderView.isHidden==false && gameplayRenderHost?.renderingPaused==false,
            contains:{[weak self] node in guard let self else{return false}
                return self.nodesByID[node.tileID] === node && node.parent === self.canvasRoot && !node.isHidden && node.alpha>0
            })
        publishFishIdleFrames()
        // The one visible ticker remains alive at source15/30/60. Individual
        // actions/resources do not create fabricated generic activity marks.
    }

    private var hudTapFeedbackBases:[ObjectIdentifier:CGPoint]=[:]
    private var hudTapFeedbackNodes:[SKNode] {
        hud.children.filter {$0 === closeButton || $0.name == "native-game-help" || $0 === scoreArt || $0 === comboArt}
    }
    var hasActiveHUDTapFeedback:Bool {hudTapFeedbackNodes.contains {$0.action(forKey:"hud-tap-bounce") != nil}}
    /// Foreground sheets freeze the board, while an already-visible HUD may
    /// finish its finite entrance and contact feedback on the existing Scene clock.
    var hasActiveHUDPresentationFeedback:Bool {hasActiveHUDTapFeedback || hud.action(forKey:"hud-enter") != nil}
    private func finishHUDTapFeedback() {
        guard suspended,!hasActiveHUDPresentationFeedback else{return}
        isPaused=true;canvasRoot.isPaused=true
        restoreHUDFeedbackPause();requestRendering(false)
    }
    private func playHUDTapFeedback(on node:SKNode) {
        let key=ObjectIdentifier(node),base=hudTapFeedbackBases[key] ?? CGPoint(x:node.xScale,y:node.yScale)
        requestRendering(true)
        hudTapFeedbackBases[key]=base;node.removeAction(forKey:"hud-tap-bounce")
        node.xScale=base.x;node.yScale=base.y
        node.run(.sequence([.customAction(withDuration:NativeHUDTapMotion.duration) { node,elapsed in
            let scale=CGFloat(NativeHUDTapMotion.scale(at:Double(elapsed)))
            node.xScale=base.x*scale;node.yScale=base.y*scale
        },.run {[weak self,weak node] in
            node?.xScale=base.x;node?.yScale=base.y
            self?.hudTapFeedbackBases.removeValue(forKey:key)
            // Completion runs inside the keyed action; the node is already at rest.
            node?.removeAction(forKey:"hud-tap-bounce")
            self?.finishHUDTapFeedback()
        }]),withKey:"hud-tap-bounce")
    }

    private func restoreHUDFeedbackPause() {
        for (node,paused) in hudFeedbackPausedNodes {node.isPaused=paused}
        for (action,speed) in hudFeedbackPausedActions {action.speed=speed}
        hudFeedbackPausedNodes.removeAll();hudFeedbackPausedActions.removeAll()
    }

    func setSuspended(_ value: Bool,allowHUDFeedback:Bool=false) {
        if value {renderPipelineProbe?.cancel(scene:self,reason:"suspended")}
        guard !sourceDisposalInProgress else {return }
        guard !disposed else {return}
        restoreHUDFeedbackPause()
        // VC publishes Source foreground before this existing lifecycle seam.
        // Cancel before iOS freezes APP timers; modal pauses stay foreground.
        if value,sourceBoardEntryScope?.service.sourceForegroundAdmissionOpen==false {sourceSmokePoolWarmup?.dispose()}
        if value && !allowHUDFeedback {
            closeButton?.cancelTapBounce()
            for node in hudTapFeedbackNodes where node !== closeButton {
                node.removeAction(forKey:"hud-tap-bounce")
                if let base=hudTapFeedbackBases.removeValue(forKey:ObjectIdentifier(node)) {node.xScale=base.x;node.yScale=base.y}
            }
        }
        suspended=value;lastFrame=nil
        if value {retireSourceRendererDragTransport();let transport=sourceDragTransport;sourceDragTransport=nil;transport?.cancel()}
        else {retainSourceDragTransport()}
        diagnosticWindowStart=nil;diagnosticLastFrame=nil;diagnosticPreviousTarget=nil;resetDiagnosticFrameInterval()
        diagnosticDragRender.retireDrag();diagnosticLatestTouchMilliseconds=nil
        if frameDiagnosticsEnabled {
            diagnosticDragInput.arrivalTime=nil
        diagnosticDragInput.sceneTime=nil;diagnosticDragInput.osTimestampMs=nil;diagnosticDragInput.coalescedTimestampMs=nil
            diagnosticDragInput.paintedOSTimestampMs=nil;diagnosticDragInput.paintedCoalescedTimestampMs=nil
            diagnosticExpectedDragNode=nil;diagnosticExpectedDragPosition=nil;diagnosticExpectedDragGeneration=nil
        }
        sourceCallbackTime();sourceFrames.visibilityChanged(hidden:value)
        for owner in regularSixPresentations.values {owner.setSuspended(value)}
        // Original pauseGame pauses the global animation timeline and stops
        // the Pixi renderer ticker; foreground GSAP transport keeps ticking.
        // It does not complete/drain accepted transactions or
        // remove HUD-star, spawn, meter, candidate or drag owners.
        let keepTap=value && allowHUDFeedback && hasActiveHUDPresentationFeedback
        isPaused=value && !keepTap
        canvasRoot.isPaused=value && !keepTap;effects.isPaused=value;ghosts.isPaused=value;hudStarFlights.isPaused=value;roundIndicator.isPaused=value
        for child in hud.children {child.isPaused=value && !(keepTap && child.action(forKey:"hud-tap-bounce") != nil)}
        if keepTap {
            // An unpaused Scene cannot advance an action beneath a paused
            // canvas ancestor. Keep only HUD entrance/contact feedback ticking;
            // retained dice and every other canvas subtree remain frozen.
            for node in canvasRoot.children where node !== hud {
                hudFeedbackPausedNodes.append((node,node.isPaused));node.isPaused=true
            }
            for key in ["hud-exit"] {
                if let action=hud.action(forKey:key) {hudFeedbackPausedActions.append((action,action.speed));action.speed=0}
            }
        }
        reconcileSourceWildShimmerVisibility();onRenderingDemand?(!value || keepTap)
        if !value && !exitInProgress {
            synchronize();releaseFinalDirectIfReady()
            if !sourceHUDStarJobsPresentationEnabled {startHUDStarFlights(ids:engine.pendingHUDStars.map(\.id))} // Source resume retains real jobs; it never recreates earned flights.
            evaluate();publishPendingTerminal()
        }
    }

    func handleMemoryWarning() {
        guard !sourceDisposalInProgress else {return}
        guard !disposed, activeTouch == nil, !hasActions(), effects.children.isEmpty,
              !nodesByID.values.contains(where: { $0.hasPresentationActions }) else { return }
        var paths: Set<String> = ["assets/ghost-placeholder.png", "assets/tile.png", "assets/shadow.png", "assets/paper-bg.png", "assets/close-icon.png", "assets/hud/help.png", "assets/hud/score-hud.png","assets/hud/combo-hud.png","assets/hud/extra-combo-hud.png","assets/hud/mega-combo-hud.png"]
        if gameplayHelpAllowed { paths.insert(engine.state.mode == .arcade ? "assets/hud/crate - hud.png":"assets/nav/stats-nav.png") }
        for node in nodesByID.values { paths.formUnion(node.resourcePaths) }
        if sourceMagnetFallbackScope?.current == true || sourceSixScope?.current == true {
            paths.formUnion(NativeRegularStackLayout.Skin.allCases.map{String($0.rawValue.dropFirst(2))})
        }
        textures.purgeUnused(retaining: paths)
    }

    func animateExit(keepsHUDVisible:Bool=false,afterResidualExit:(()->Void)?=nil,completion: @escaping (Bool) -> Void) {
        guard !sourceDisposalInProgress else {completion(false); return }
        guard !disposed, !exitInProgress,completedExitGeneration != engine.state.generation else { completion(false); return }
        let capturedGeneration=engine.state.generation
        stopSourceRegularIdle()
        guard !disposed,!exitInProgress,completedExitGeneration != capturedGeneration,engine.state.generation==capturedGeneration else{completion(false);return}
        cancelEntry(restoreHUD:false); cancelDrag(); cancelCandidate(); inputAdmitted = false; navigationLocked = true
        retireSourceSpawns()
        exitInProgress = true; exitCompletion = completion
        comboHUDMotion.stop();comboNumberMotion.stop()
        engine.setInputLock("native-board-exit",active: true)
        suspended = false; isPaused = false; requestRendering(true)
        let generation = engine.state.generation
        sourceCallbackTime();sourceExit=sourceFrames.begin(.init(kind:.boardExit,generation:generation,id:UUID().uuidString))
        let hudCapture=keepsHUDVisible ? nil:sourceFrames.begin(.init(kind:.hudExit,generation:generation,id:UUID().uuidString));sourceHUDExit=hudCapture
        let targets: [SKNode] = nodesByID.values.sorted { $0.tileID < $1.tileID } + ghosts.children
        let plans = NativeBoardExitPlan.make(count: targets.count)
        if let end=plans.map(\.end).max() {onBoardExit?(end+0.03)}
        guard !disposed,exitInProgress,engine.state.generation==generation else{return}
        exitOwners = targets.count + 1
        let startHUDExit:()->Void = { [weak self] in
            guard let self,!self.disposed,self.exitInProgress,self.engine.state.generation==generation else{return}
            afterResidualExit?()
            if let hudCapture {
                self.roundIndicator.exit()
                self.animateHUDExit(generation:generation,capture:hudCapture)
            } else {self.finishExitOwner(generation:generation)}
        }
        if afterResidualExit == nil || targets.isEmpty {startHUDExit()}
        for plan in plans {
            let node = targets[plan.tileIndex]
            node.removeAllActions()
            if let die = node as? NativeDiceNode { die.visual.removeAllActions(); die.visual.setScale(1) }
            let base = CGPoint(x: node.xScale,y: node.yScale)
            let small = CGPoint(x: base.x*0.88,y: base.y*0.88)
            let peak = CGPoint(x: base.x*plan.peak,y: base.y*plan.peak)
            node.run(.sequence([.wait(forDuration: plan.delay),
                NativeBoardMotion.scale(from: base,to: small,duration: plan.settle,ease: .backIn(1.5)),
                .group([
                    .sequence([NativeBoardMotion.scale(from: small,to: peak,duration: plan.compress,ease: .power2In),
                        NativeBoardMotion.scale(from: peak,to: .zero,duration: plan.collapse,ease: .backIn(2))]),
                    .fadeOut(withDuration: max(0.12,plan.collapse*0.68))
                ]),.run { [weak self] in
                    guard let self,!self.disposed,self.exitInProgress,self.engine.state.generation==generation else{return}
                    self.finishExitOwner(generation:generation)
                    if afterResidualExit != nil,self.exitOwners==1 {startHUDExit()}
                }]),withKey: "board-exit")
        }
    }

    private func animateHUDExit(generation:UInt64,capture hudCapture:NativeSourceFrameRuntime.Capture) {
        let start=NativeHUDTransitionMotion.Pose(offset:Double(hud.position.y),alpha:Double(hud.alpha))
        let top=Double(NativeGameplayChromePlan.make(viewport:size,safeTop:safeInsets.top).hudTop)
        hud.run(.sequence([.customAction(withDuration:NativeHUDTransitionMotion.riseDuration) { node,time in
            let pose=NativeHUDTransitionMotion.rise(at:Double(time),top:top,from:start)
            node.position.y=CGFloat(pose.offset);node.alpha=CGFloat(pose.alpha)
        },.run { [weak self] in
            guard let self else{return};self.sourceCallbackTime();self.sourceFrames.end(hudCapture)
            if self.sourceHUDExit === hudCapture {self.sourceHUDExit=nil}
            self.finishExitOwner(generation:generation)
        }]),withKey:"hud-exit")
    }

    private func finishExitOwner(generation: UInt64) {
        guard !disposed, exitInProgress, engine.state.generation == generation else { return }
        exitOwners = max(0,exitOwners-1)
        if exitOwners == 0 { finishExit(completed: true) }
    }

    private func finishExit(completed: Bool) {
        sourceCallbackTime()
        if let capture=sourceExit {sourceExit=nil;sourceFrames.end(capture)}
        if let capture=sourceHUDExit {sourceHUDExit=nil;sourceFrames.end(capture)}
        guard exitInProgress else { return }
        if completed {completedExitGeneration=engine.state.generation}
        exitInProgress = false; exitOwners = 0
        if sourceDisposalGeneration == nil || sourceDisposalGeneration == engine.state.generation {engine.setInputLock("native-board-exit",active: false)}
        if !completed {
            roundIndicator.cancelExit()
            for node in nodesByID.values { node.removeAllActions(); node.visual.setScale(1) }
            for ghost in ghosts.children { ghost.removeAllActions(); ghost.setScale(1) }
            hud.removeAllActions(); hud.position = .zero; hud.alpha = 1
        }
        let completion = exitCompletion; exitCompletion = nil
        completion?(completed)
    }

    func retireSourceAnimationBindings() {
        let mandatory=sourceMandatoryCellOwner;sourceMandatoryCellOwner=nil
        if let id=sourceMandatoryCellWriterID,engine.sourceMandatoryMergeCellWriterID==id {engine.sourceMandatoryMergeCellMutation=nil;engine.sourceMandatoryMergeCellWriterID=nil}
        sourceMandatoryCellWriterID=nil;mandatory?.retire()
        let levelEnd=sourceLevelEndCaller;sourceLevelEndCaller=nil;sourceLevelEndCallerGeneration=nil;sourceStuckWildDeferral.reset();levelEnd?.dispose()
        let levelDelays=sourceLevelEndDelays;sourceLevelEndDelays=[:];for held in levelDelays.values {held.1.cancel()}
        retireSourceRegularIdle()
        retireSourceGameplayRuntimeObservation()
        retireSourceWildSkinAssets()
        retireSourceSpawnVisualSafety()
        retireSourcePlainStarHalos()
        retireSourceEndgameMutationLedger()
        retireSourceCanonicalSave()
        // Scope replacement retires ONLY source bindings. Authored raw board
        // exit/family owners remain alive on the current painted old surface.
        guard sourceAnimationBindingAdmissionOpen else{return}
        let previousSealing=sourceOuterTearingDown
        sourceOuterTearingDown=true // seal BEFORE every captured cancellation callback
        retireSourceOrdinaryOpenBounces()
        retireSourceBoardEntry()
        retireSourceHUDStarJobs()
        let initial=sourceInitialConstruction;sourceInitialConstruction=nil;sourceInitialEntryPending=false;initial?.dispose()
        retireSourceSpecialIdleBindings()
        retireSourceSixBindings()
        retireSourceSpecialTransactions()
        retireSourceMeterOpenBinding()
        defer {if !disposed {sourceOuterTearingDown=previousSealing}}
        sourceOuterTimelineDriver=nil;sourceDragTweenDriver=nil
        retireSourceStackHandoff()
        sourceContactVisualRandom=nil;sourceStackAbsorbAdmission=nil
        let companions=sourceRegularContactCompanions;sourceRegularContactCompanions=nil
        onSourceStackContactPrefix=nil;onSourceStackContactSuffix=nil
        if !sourceAcceptedStacks.isEmpty {retireSourceAcceptedStacks()}
        companions?.dispose()
        let captured=Array(nodesByID.values)
        for node in captured {node.retireSourceAnimationBindingsPreservingPaint()}
    }

    func dispose() {
        restoreHUDFeedbackPause()
        guard !disposed,!sourceDisposalInProgress else {return}
        comboHUDMotion.stop();comboNumberMotion.stop()
        onTutorialSpecialDropStarted=nil;onTutorialSpecialDropLanded=nil
        renderPipelineProbe?.cancel(scene:self,reason:"disposed")
        retireSourceWildSkinAssets()
        retireSourceSpawnVisualSafety()
        let sourceLifetime = sourceInitialConstruction != nil || sourceMicrotaskInstallation != nil || sourceDisposalSealingEnabled || sourceOuterTimelineDriver != nil || sourceDragTweenDriver != nil || sourceRegularContactCompanions != nil || sourceSameNodeStackAbsorbsEnabled || sourceOuterTearingDown
        // A destructive request during Source scope retirement must still run
        // its full cleanup; only a recursive destructive request is coalesced.
        if !sourceLifetime && sourceOuterTearingDown {return}
        if sourceLifetime {
            sourceDisposalGeneration=lastGeneration ?? engine.state.generation
            sourceDisposalInProgress=true;sourceOuterTearingDown=true
        }
        retireSourceOrdinaryOpenBounces()
        retireSourcePlainStarHalos()
        retireSourceBoardEntry()
        retireSourceEndgameMutationLedger()
        let initial=sourceInitialConstruction;sourceInitialConstruction=nil;sourceInitialEntryPending=false;initial?.dispose()
        retireSourceSpecialIdleBindings()
        retireSourceSixBindings()
        sourceNoMovesDestroyed=true
        retireSourceHUDStarJobs()
        retireSourceCanonicalSave()
        retireSourceNoMoves()
        sourceMeterTearingDown=true
        retireSourceSpecialTransactions()
        retireSourceMeterOpenBinding()
        if sourceSameNodeStackAbsorbsEnabled || !sourceAcceptedStacks.isEmpty {retireSourceAcceptedStacks()}
        retireSourceStackHandoff()
        sourceRegularContactCompanions?.dispose();sourceRegularContactCompanions=nil;sourceContactVisualRandom=nil;sourceStackAbsorbAdmission=nil
        sourceOuterTimelineDriver=nil;sourceDragTweenDriver=nil;onSourceStackContactPrefix=nil;onSourceStackContactSuffix=nil
        invalidateWildTransports()
        retireRegularSixPresentations()
        finishExit(completed: false)
        onTutorialSpecialBarSettled=nil;restoreTutorialSpecialBarFocus()
        cancelEntry(); cancelDrag(); cancelCandidate();dragTrail.dispose(); disposed = true
        retireSourceSpawns()
        onEndgameHintEvaluation=nil;onEndgameHintInteraction=nil
        sourceFrames.stop();sourceGameplay.removeAll();sourceRegularHandoffMutationReceipts.removeAll();sourcePopulation.removeAll();sourceStars=nil;onFrameTarget=nil;onSpecialIdleSuspended=nil
        if sourceDisposalGeneration == nil || sourceDisposalGeneration == engine.state.generation {engine.setInputLock("native-board-entry-handoff",active:false)};preparedEntryGeneration=nil
        specialPresentationIDs.removeAll(); specialPresentationID = nil;directPresentationID=nil;directPresentationVariant=nil;directFinalReceipt=nil
        ordinaryAbsorbs.removeAll();ordinaryPostchecks.removeAll();ordinarySpawnVisuals.removeAll();ordinaryDeferred.removeAll();ordinaryPrimaryVisuals.removeAll();ordinarySixVisual=nil
        pendingTerminal = nil; pendingTerminalGeneration = nil; visualLifetime += 1; visualOwners = 0
        removeAllActions(); retireEffects(); nodesByID.values.forEach { $0.dispose() }
        retireSourcePhysicalObservers();nodesByID.removeAll();meterTimeoutIDs.removeAll();ghostNodesByCell.removeAll();ghosts.removeAllChildren(); removeAllChildren(); textures.dispose()
        onFishIdleFrames?([:],engine.state.generation,true);onFishIdleFrames=nil
        onNativeNoMovesShow=nil;onNativeNoMovesExit=nil;onNativeNoMovesClear=nil;onJourneyBottomDecorShake=nil;captureSourceScreenOverlayShake=nil;sourceCoreTntShakeTargets.removeAll();sourceScreenShakeTargets.removeAll();onPresentationFailure=nil;onSourcePresentationFailure=nil;onStateChange = nil; onTerminal = nil; onGameplayEvent = nil; onGameplayReceipt = nil; onSpecialMoment = nil; onAuthoredFinale = nil;onAuthoredTntPresentation = nil;onAuthoredLaserImpact=nil;authoredTntPresentationReady = nil;authoredFinalePresentationReady=nil;onSpecialPresentationCancelled = nil; onTntGlyphClock = nil; onSplashGlyphClock = nil; onHaptic = nil
        onRenderSurfacePreparation=nil
        hudTapFeedbackBases.removeAll();onSourceGuidedSnapBack=nil;onSourceTutorialRetired=nil;onLevelFlowBounceCompletion=nil;onExitRequest = nil; onHelpRequest = nil; onScoreRequest = nil; onComboRequest = nil; onPointerState = nil; onRenderingDemand = nil; onBoardEntry = nil; onBoardExit = nil; onHUDDrop = nil
    }
}
