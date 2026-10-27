import UIKit
import SpriteKit
import MetalKit
import QuartzCore
import StackToSixGameplay

@MainActor
final class NativeGameplayViewController: UIViewController {
    let engine: NativeGameplayEngine
    var onExit: (() -> Void)?
    var unreadJourneyDice:()->Set<String> = {[]}
    var onJourneyDieLanded:((String,Int,UInt64)->Void)?
    var onStateChange: ((NativeBoardState) -> Void)?
    var onRoundWon: ((UInt64) -> Void)?
    var onTerminal: ((NativeResolution) -> Void)?
    var prepareJourneyRewardController:((NativeResolution)->NativeJourneyRewardController?)?
    var prepareJourneyResultController:((NativeResolution)->NativeResultController?)?
    private var preparedJourneyResult:(generation:UInt64,controller:NativeResultController)?
    func takePreparedJourneyResult(generation:UInt64)->NativeResultController? {
        guard let prepared=preparedJourneyResult,prepared.generation==generation,engine.state.generation==generation else{retirePreparedJourneyResult();return nil}
        preparedJourneyResult=nil;return prepared.controller
    }
    private func retirePreparedJourneyResult(){preparedJourneyResult?.controller.dispose();preparedJourneyResult=nil}
    private var preparedJourneyReward:NativeJourneyRewardController?
    func takePreparedJourneyReward(generation:UInt64)->NativeJourneyRewardController? {
        guard engine.state.generation==generation,preparedJourneyReward?.presentationGeneration==generation else {retirePreparedJourneyReward();return nil}
        let card=preparedJourneyReward;preparedJourneyReward=nil;return card
    }
    private func retirePreparedJourneyReward() {preparedJourneyReward?.dispose(notify:false);preparedJourneyReward=nil}
    var visibleJourneyRewardController:NativeJourneyRewardController? {
        children.compactMap{$0 as? NativeJourneyRewardController}.first ?? (presentedViewController as? NativeJourneyRewardController)
    }
    func mountJourneyRewardController(_ card:NativeJourneyRewardController,generation:UInt64) {
        guard !disposed,isViewLoaded,view.window != nil,engine.state.generation==generation,visibleJourneyRewardController==nil,presentedViewController==nil else {card.dispose(notify:false);return}
        card.setRewardActionsAdmitted(false)
        card.loadViewIfNeeded()
        guard card.phase != "asset-failed",card.phase != "disposed" else{return}
        addChild(card);card.view.frame=view.bounds;card.view.autoresizingMask=[.flexibleWidth,.flexibleHeight]
        view.addSubview(card.view);card.view.setNeedsLayout();card.view.layoutIfNeeded();card.didMove(toParent:self);card.start()
        card.setRewardActionsAdmitted(true)
    }
    func retireJourneyRewardController(_ card:NativeJourneyRewardController) {
        guard card.parent === self else{return}
        card.dispose(notify:false);card.willMove(toParent:nil);card.view.removeFromSuperview();card.removeFromParent()
    }
    private func retireJourneyRewardChildren(excludingGeneration:UInt64?=nil) {
        for card in children.compactMap({$0 as? NativeJourneyRewardController}) where card.presentationGeneration != excludingGeneration {
            retireJourneyRewardController(card)
        }
    }
    var onSourceGuidedSnapBack:((NativeDiceNode)->Void)?
    var onGameplayEvent: ((NativeGameplayEvent) -> Void)?
    var onGameplayReceipt: ((NativeGameplayEvent,NativeTile?,NativeTile?,UInt64) -> Void)?
    var onSpecialFadeCapture: ((String,UInt64) -> ((Double) -> Void)?)?
    var onSpecialMoment: ((String?,String,Int) -> Void)?
    var onHUDCoinArrival:((Double)->Void)?
    var onHUDTapContact:((String)->Void)?
    var onHelp: (() -> Void)?
    var onScore: (() -> Void)?
    var onCombo: (() -> Void)?
    var onPointerState: ((Bool) -> Void)?
    var onHaptic: ((String) -> Void)?
    var beforeInitialBoardEntry: ((@escaping () -> Void) -> Void)?
    var onBoardEntry: ((TimeInterval,[TimeInterval]) -> Void)?
    var onBoardExit: ((TimeInterval) -> Void)?
    var onBoardArtworkFailure:(()->Void)?
    var onSourcePresentationFailure:(()->Void)?
    struct SourcePresentationFailure:Equatable {
        enum Kind:Equatable {case renderOwnership,phaseAuthority}
        let reason:String
        let generation:UInt64
        let boardState:NativeBoardState
        var kind:Kind {reason == "source_spawn_visual_safety_rejected" ? .renderOwnership:.phaseAuthority}
    }
    private(set) var sourcePresentationFailure:SourcePresentationFailure?
    private(set) var sourcePresentationFailureGeneration:UInt64?
    var journeyDecorCatalog:NativeJourneyBottomDecorCatalog?
    var journeyDecorResources:((URL)->NativeJourneyBottomDecorResourcePreparing)?
    private(set) var journeyBottomDecor:NativeJourneyBottomDecorOwner?
    private var decorWaiters:[(UInt64,(Bool)->Void)]=[]
    private var decorPreparing=false
    private var exitingBoard=false
    private var endgameHint:NativeEndgameHintCoordinator?
    private weak var endgameHintSourceScope:NativeGameplaySourceContext.Scope?
    private let resourceRoot: URL
    private let spriteView: UIView & NativeGameplaySurfaceControl
    private var tutorialSpecialBarSiblings:[(UIView,CGFloat)]=[]
    func focusTutorialSpecialBarSiblings(excluding overlay:UIView) {
        guard tutorialSpecialBarSiblings.isEmpty else{return}
        tutorialSpecialBarSiblings=view.subviews.filter{$0 !== spriteView && $0 !== paperSurface && $0 !== overlay}.map{($0,$0.alpha)}
        boardScene?.onTutorialSpecialBarFocusProgress = {[weak self] progress in self?.paintTutorialSpecialBarSiblings(progress)}
        paintTutorialSpecialBarSiblings(boardScene?.tutorialSpecialBarFocusValue ?? 1)
    }
    private func paintTutorialSpecialBarSiblings(_ progress:Double) {
        for (surface,alpha) in tutorialSpecialBarSiblings {surface.alpha=alpha+(min(alpha,0.2)-alpha)*CGFloat(progress)}
    }
    func restoreTutorialSpecialBarSiblings() {
        boardScene?.onTutorialSpecialBarFocusProgress=nil
        let captured=tutorialSpecialBarSiblings;tutorialSpecialBarSiblings=[]
        for (surface,alpha) in captured where surface.superview === view {surface.alpha=alpha}
    }
    static func makeRenderSurface(bundleIdentifier:String?=Bundle.main.bundleIdentifier)->(UIView & NativeGameplaySurfaceControl) {
        // Icon/cold launches must use the same renderer as device
        // delivery. The previous launch-only flag silently selected SKView
        // again after the user closed and reopened the standalone app.
        if bundleIdentifier == "com.taptapdesign.stacktosix.native",
           let owned=NativeOwnedMetalGameplayView() { return owned }
        return SKView()
    }
    private let fishIdleOwner:NativeFishIdleOwner
    private let paperSurface:NativeAppPaperSurface
    private var preparedBoardEntryGeneration:UInt64?
    private var initialEntryGateRequested = false,initialEntryGateReleased = false
    private(set) var boardScene: NativeBoardScene?
    private var observations: [NSObjectProtocol] = []
    private var disposed = false
    weak var sourceContext: NativeGameplaySourceContext?
    var sourceInitialConstruction:NativeSourceInitialBoardConstruction?
    var sourceTutorialActivationEnabled=false
    var sourceTutorialFirstStepMonitorEnabled=false
    var sourceTutorialHUDEnabled=false
    var onSourceTutorialRetired:(()->Void)?
    var onSourceTutorialPrepared:(()->Void)?
    var sourceBoardEntryEnabled=false
    /// Fresh Arcade save runs after actual Source holders/owners are mounted,
    /// before the board wave changes their painted alpha or admits input.
    var beforeSourceInitialBoardReveal:(()->Bool)?
    private(set) var sourceInitialBoardSaveAccepted=false
    var sourceRegularIdlePresentationEnabled=false
    var sourceSpecialIdlePresentationEnabled=false
    var sourceWildShimmerPresentationEnabled=false
    var onSourceBoardEntrySound:((Double,UInt64,UInt64)->(()->Void)?)?
    var onSourceBoardEntryCompleted:((NativeSourceBoardEntryOwner.Completion)->Void)?
    // Bounded actual ordinary caller; Wild/global/save admission stays separate.
    var sourceOrdinaryPresentationEnabled=false
    private var sourceOrdinaryPresentationInstalled=false
    var sourceGameplayRuntimeObservationEnabled=false
    private var sourceGameplayRuntimeObservationInstalled=false
    var sourceMagnetPresentationEnabled=false
    var sourceOrdinaryEndgamePresentationEnabled=false
    var sourceTntPresentationEnabled=false
    private var sourceTntPresentationInstalled=false
    var captureSourceMagnetCleanup:((String,UInt64)->NativeMagnetPullCleanup?)?
    private var sourceMagnetPresentationInstalled=false
    var sourceDirectPresentationEnabled=false
    private var sourceDirectHUDInstalled=false
    private var sourceDirectHUDPrepared:NativeSourceHUDStarTexturePreparation.Prepared?
    private var sourceDirectPresentationInstalled=false
    var sourceSmallStackPresentationEnabled = false
    var sourceEndgameMutationLedgerEnabled = false
    var sourceNoMovesPresentationEnabled = false
    /// Whole gameplay ownership is mounted after physical layout/resources and
    /// before the first scene reveal. One captured completion admits input.
    var beforeSourceGameplayAdmission:((@escaping(Bool)->Void)->Void)?
    private var sourceWildDestinationResourcesPreparing=false
    private var sourceWildDestinationResourcesPrepared=false
    private var sourceGameplayAdmissionRequested=false
    private var sourceGameplayAdmissionAccepted=false
    var sourceNoMovesBindings:NativeSourceNoMovesSceneBindings?
    private(set) var sourceNoMovesUIKit:NativeSourceNoMovesUIKitCoordinator?
    private(set) var nativeNoMovesUIKit:NativeSourceNoMovesUIKitCoordinator?
    private(set) var sourceNoMovesTerminalRegistry:NativeSourceNoMovesTerminalRegistryEndpoint?
    private var sourceNoMovesInstalledGeneration:UInt64?
    private var sourceNoMovesUIKitEpoch:UInt64=0
    private var sourceConfirmedFailHandoff:NativeSourceConfirmedFailHandoff?
    private(set) var sourceScope: NativeGameplaySourceContext.Scope?
    private var explicitlySuspended = false
    private var backgrounded = false
    private var hasPresentedScene = false
    var waitsForFirstFrameOnReplacement=false
    var keepsGameplayChromeVisibleOnEntry=false
    private var firstBoardFrameReady=false
    var incomingOriginalThemedCoverExpected=false
    private var incomingOriginalCoverCompletion:(()->Void)?
    private var incomingOriginalCoverGeneration:UInt64?
    var retainsOutgoingWorldPaint:Bool {incomingOriginalCoverCompletion != nil}
    /// Keep the real outgoing World painted beneath the incoming original
    /// themed cover. Paper becomes opaque only at the real cover handoff.
    func retainOutgoingWorldUntilOriginalCover(_ completion:@escaping()->Void) {
        guard !disposed else{return}
        incomingOriginalCoverGeneration=engine.state.generation
        incomingOriginalCoverCompletion=completion
        loadViewIfNeeded();paperSurface.isHidden=true;view.backgroundColor = .clear;view.isOpaque=false
        whenFirstBoardFrameReady {[weak self] in
            guard let self,!self.incomingOriginalThemedCoverExpected else{return}
            self.acceptIncomingOriginalOpaqueCover()
        }
    }
    func acceptIncomingOriginalOpaqueCover() {
        guard !disposed,incomingOriginalCoverGeneration==engine.state.generation,viewIfLoaded?.window != nil,
              let completion=incomingOriginalCoverCompletion else{return}
        incomingOriginalCoverCompletion=nil;incomingOriginalCoverGeneration=nil
        paperSurface.isHidden=false;view.backgroundColor=NativeAppPaperSurface.base;view.isOpaque=true
        completion()
    }
    private var firstBoardFrameWaiters:[()->Void]=[]
    func whenFirstBoardFrameReady(_ completion:@escaping()->Void) {
        guard !disposed else{return}
        if firstBoardFrameReady {completion()}else{firstBoardFrameWaiters.append(completion)}
    }
    private var fishFinale: NativeFishFinalePresentation?
    private var tntGlyphs: [String: NativeSplashGlyphField] = [:]
    private var sourceTntGlyphScopes:[String:NativeGameplaySourceContext.Scope]=[:]
    private var sourceTntGlyphOwnerIDs:[String:String]=[:]
    private var fishGeneration: UInt64?
    private var bottleFinale: NativeBottleFinalePresentation?
    private var bottleGeneration: UInt64?
    private var boardClearedPresentation:NativeArcadeRoundPresentation?
    var boardClearedUsesPuppyThumb:Bool {boardClearedPresentation?.isPuppyThumb == true}
    var hasPresentedBoardCleared:Bool {boardClearedGeneration==engine.state.generation}
    private var boardClearedGeneration:UInt64?
    private var boardClearedTerminalContinuation:(()->Void)?
    private var boardClearedSuccessorReady=false
    private var honeyFinale: NativeHoneyFinalePresentation?
    private var honeyGeneration: UInt64?
    var tutorialVisualPresentationAllowed:Bool{!disposed && !backgrounded && !explicitlySuspended && !exitingBoard}
    var tutorialEncouragementPresentationReady:Bool {
        !disposed && !backgrounded && !explicitlySuspended && !exitingBoard &&
        (boardScene?.tutorialEncouragementMilestoneReached==true ||
         (fishFinale==nil && bottleFinale==nil && honeyFinale==nil && area55Finales.isEmpty && tntGlyphs.isEmpty)) &&
        boardScene?.tutorialEncouragementSettled==true
    }
    private var lastRoboExitFrame:Int?
    private var laserResources:NativeLaserGunResources? {finaleArtworkOwner?.laserResources}
    private(set) var finaleArtworkOwner:NativeSelectedUIKitFinaleArtworkOwner?
    private var area55Finales: [String:NativeFinitePresentation] = [:]
    private var area55Generations: [String:UInt64] = [:]
    private var area55SourceOwnerIDs:[String:String]=[:]

    init(engine: NativeGameplayEngine, resourceRoot: URL,
         renderSurfaceFactory:(()->(UIView & NativeGameplaySurfaceControl))?=nil) {
        self.engine = engine; self.resourceRoot = resourceRoot
        spriteView=renderSurfaceFactory?() ?? Self.makeRenderSurface()
        // Original frame strip avoids the transparent frame at HEVC queue
        // loop boundaries. Reuse the route lease and accepted board clock;
        // preserve 1x motion and sample every rendered frame like the movie.
        fishIdleOwner=NativeFishIdleOwner(resourceRoot:resourceRoot,preferOriginalSVG:true,minimumPaintInterval:0)
        paperSurface=NativeAppPaperSurface(artwork:JimiV9Artwork(resourceRoot:resourceRoot))
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    /// Pre-entry preparation captures the real upload receipt. Scene geometry
    /// is not yet mounted here; do not invent a viewport to install HUD roots.
    @discardableResult func configureSourceDirectHUDPresentation(prepared:NativeSourceHUDStarTexturePreparation.Prepared)->Bool {
        guard !disposed,!exitingBoard,sourceDirectPresentationEnabled,sourceOrdinaryPresentationEnabled,
              !sourceDirectHUDInstalled,sourceDirectHUDPrepared==nil,boardScene != nil,
              let scope=sourceScope,scope.current,scope.hudStarTextures.accepts(prepared) else{return false}
        sourceDirectHUDPrepared=prepared;return true
    }
    private func installSourceDirectHUDPresentation(scene:NativeBoardScene)->Bool {
        guard !disposed,!exitingBoard,boardScene === scene,let scope=sourceScope,scope.current,
              let prepared=sourceDirectHUDPrepared,scope.hudStarTextures.accepts(prepared),
              scene.configureSourceSpecialTransactions(scope:scope) else{return false}
        scene.sourceHUDStarJobsPresentationEnabled=true
        guard scene.configureSourceDirectHUDCaller(scope:scope,prepared:prepared),
              !disposed,boardScene === scene,sourceScope === scope,scope.current else{return false}
        sourceDirectHUDInstalled=true;sourceDirectHUDPrepared=nil;return true
    }
    /// Binds the already-current APP owners to this controller's actual Scene.
    /// Resources must have completed their real preload before Source admission.
    /// The caller admits the covered Core count timing; this method never flips
    /// whole-game flags or manufactures a cold-resource readiness receipt.
    @discardableResult
    func configureSourceMeterAndStarPresentation(resources:NativeWildMeterDropResources,
        texturesCurrent:@escaping()->Bool,
        selectedAudio:@escaping(NativeTile,NativeMeterSelectedFinaleWarmup<SKTexture>.Capture)->Void,
        carrierAudio:@escaping(Bool,String,UInt64)->(()->Void),
        landingSound:@escaping()->Void)->Bool {
        guard !disposed,!exitingBoard,let scene=boardScene,let scope=sourceScope,
              scope.current,scene.sourceAnimationBindingAdmissionOpen,
              scene.sourceMicrotaskBoundariesInstalled,
              scene.sourceOuterTimelineDriver === scope.timeline,
              scene.sourceDragTweenDriver === scope.tween,
              engine.sourceMathRandom === scope.mathRandom,
              engine.sourceStarOrbitCountAtPresentationEnabled,
              let ready=resources.sourceSynchronousPreparationReceipt(),
              resources.sourceSynchronousPreparationIsCurrent(ready) else{return false}
        let retainedStarOwner=scene.sourcePlainStarHalosConfigured(scope:scope)
        guard retainedStarOwner || scene.configureSourcePlainStarHalos(scope:scope,
            waitForSharedIdle:sourceSpecialIdlePresentationEnabled) else{return false}
        let admitted=scene.configureSourceMeterOpen(scope:scope,resources:resources,
            texturesCurrent:texturesCurrent,selectedAudio:selectedAudio,
            carrierAudio:carrierAudio,dividerMask:{[weak scene,weak scope] in
                guard let scene,let scope,scope.current else{return {}}
                guard let release=scene.beginSourceMeterDividerMask() else {
                    scene.onSourcePresentationFailure?("source_meter_divider_owner_rejected",scene.engine.state.generation)
                    return {}
                }
                return release
            },landing:{[weak scene] _,capture in
                scene?.onSourcePresentationFailure?("source_meter_landing_owner_missing",capture.generation)
            })
        guard admitted,!disposed,!exitingBoard,boardScene === scene,
              sourceScope === scope,scope.current else {
            // A duplicate/rejected meter admission does not own the retained
            // Star presentation installed by the preceding successful call.
            if !retainedStarOwner {scene.retireSourcePlainStarHalos(scope:scope)}
            return false
        }
        guard scene.configureSourceMeterLanding(scope:scope,sound:landingSound),
              !disposed,!exitingBoard,boardScene === scene,sourceScope === scope,scope.current else {
            if boardScene === scene,sourceScope === scope,scope.current {
                scene.onSourcePresentationFailure?("source_meter_landing_owner_rejected",engine.state.generation)
            }
            return false
        }
        return true
    }

    override func loadView() {
        let root = UIView(); root.backgroundColor = NativeAppPaperSurface.base
        paperSurface.frame=root.bounds;paperSurface.autoresizingMask=[.flexibleWidth,.flexibleHeight];root.addSubview(paperSurface)
        spriteView.backgroundColor = .clear
        if let legacy=spriteView as? SKView {
            legacy.allowsTransparency=true;legacy.ignoresSiblingOrder=false
        }
        spriteView.surfaceFrameRate=60
        if let owned=spriteView as? NativeOwnedMetalGameplayView {
            owned.diagnosticsEnabled=drawableBudgetDiagnosticsEnabled
        }
        // Raster density follows the display; board layout and input remain in points.
        spriteView.contentScaleFactor=UIScreen.main.scale
        spriteView.frame = root.bounds; spriteView.autoresizingMask = [.flexibleWidth,.flexibleHeight]
        spriteView.accessibilityIdentifier = "native-gameplay-board"
        root.addSubview(spriteView)
        fishIdleOwner.frame=root.bounds;fishIdleOwner.autoresizingMask=[.flexibleWidth,.flexibleHeight];root.addSubview(fishIdleOwner)
        if beforeInitialBoardEntry != nil || journeyDecorCatalog != nil && engine.state.mode == .journey {
            spriteView.isHidden = true
        }
        view = root
        ensureJourneyBottomDecor()
        startDecorPreparation()
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        let scene = NativeBoardScene(engine: engine, resourceRoot: resourceRoot, size: view.bounds.size,sourceInitialConstruction:sourceInitialConstruction)
        scene.keepsHUDVisibleOnEntry=keepsGameplayChromeVisibleOnEntry
        scene.sourceWildShimmerEnabled=sourceWildShimmerPresentationEnabled
        if (sourceInitialConstruction != nil || sourceSpecialIdlePresentationEnabled),!sourceSmallStackPresentationEnabled,let sourceContext {
            sourceScope=sourceContext.beginScene(engine:engine) { [weak self] in self?.boardScene?.retireSourceAnimationBindings() }
            sourceScope?.update(foreground:!backgrounded,globalPaused:explicitlySuspended && !exitingBoard,terminalSuspended:engine.state.terminal != nil && !exitingBoard)
        }
        if sourceSmallStackPresentationEnabled, let sourceContext {
            sourceScope = sourceContext.beginScene(engine:engine) { [weak self] in
                self?.retireSourceNoMovesUIKit()
                self?.boardScene?.retireSourceAnimationBindings()
            }
            if let scope = sourceScope {
                scope.update(foreground: !backgrounded, globalPaused: explicitlySuspended && !exitingBoard,
                             terminalSuspended: engine.state.terminal != nil && !exitingBoard)
                scene.sourceOuterTimelineDriver = scope.timeline
                scene.sourceDragTweenDriver = scope.tween
                let companions = NativeRegularContactSceneCompanions(session: scope.smokeSession, smoke: scope.smoke,
                    tween: scope.tween, timeline: scope.timeline, monotonicMillisecondsNow: {CACurrentMediaTime()*1000})
                scene.configureSourceRegularContact(companions, admitted: { [weak self, weak scope, weak scene] in
                    guard let self, let scope, let scene else {return false}
                    return !self.disposed && scope.current && self.boardScene === scene
                })
                scene.sourceSameNodeStackAbsorbsEnabled = true
                if sourceOrdinaryPresentationEnabled {
                    scene.sourceRegularStackHandoffEnabled=true
                    scene.sourceStackCoreFaceReceiptsEnabled=true
                    scene.configureSourceRegularStackHandoff(service:scope.service,admitted:{[weak self,weak scope,weak scene] in
                        guard let self,let scope,let scene else{return false}
                        return !self.disposed && self.boardScene === scene && scope.current
                    })
                }
                if sourceEndgameMutationLedgerEnabled {
                    scene.sourceEndgameMutationLedgerEnabled=true
                    if !scene.configureSourceEndgameMutationLedger(scope:scope) {
                        scene.onPresentationFailure?("source_endgame_handoff_ledger_not_bound")
                    }
                }
            }
        }
        if sourceBoardEntryEnabled {
            scene.sourceBoardEntryEnabled=true
            if let scope=sourceScope,let tasks=scope.sourceMicrotaskTasks,let sound=onSourceBoardEntrySound {
                scene.sourceOuterTimelineDriver=scope.timeline;scene.sourceDragTweenDriver=scope.tween
                if scene.configureSourceMicrotaskBoundaries(scope:scope,fifo:tasks.fifo) {
                    _=scene.configureSourceBoardEntry(scope:scope,sound:sound,completed:{[weak self] in self?.onSourceBoardEntryCompleted?($0)})
                }
            }
        }
        if sourceSpecialIdlePresentationEnabled,let scope=sourceScope {
            scene.sourceOuterTimelineDriver=scope.timeline;scene.sourceDragTweenDriver=scope.tween
            if !scene.sourceMicrotaskBoundariesInstalled,let tasks=scope.sourceMicrotaskTasks {
                _=scene.configureSourceMicrotaskBoundaries(scope:scope,fifo:tasks.fifo)
            }
        }
        if sourceTutorialActivationEnabled,let scope=sourceScope {
            scene.sourceTutorialActivationEnabled=true
            scene.sourceTutorialHUDEnabled=sourceTutorialHUDEnabled
            scene.sourceTutorialFirstStepMonitorEnabled=sourceTutorialFirstStepMonitorEnabled
            scene.onSourceTutorialRetired={ [weak self] in self?.onSourceTutorialRetired?() }
            scene.onSourceTutorialPrepared={ [weak self] in self?.onSourceTutorialPrepared?() }
            _=scene.configureSourceTutorialActivation(scope:scope)
        }
        scene.onSourceGuidedSnapBack={ [weak self] node in self?.onSourceGuidedSnapBack?(node) }
        scene.onExitRequest = { [weak self, weak scene] in
            guard let self, let scene, !self.disposed, !scene.navigationLocked else { return }
            scene.cancelDrag(); self.onStateChange?(self.engine.state); self.onExit?()
        }
        scene.onPrepareSourceTntGlyphs = {[weak self,weak scene] id,scope,generation in
            guard let self,let scene else{return false}
            let current:()->Bool = {[weak self,weak scene,weak scope] in
                guard let self,let scene,let scope else{return false}
                return !self.disposed && self.boardScene === scene && scope.current && self.sourceScope === scope &&
                    self.engine.state.generation==generation && scene.sourceAnimationBindingAdmissionOpen
            }
            guard current(),self.tntGlyphs[id]==nil,let artwork=self.selectedFinaleArtwork(),
                  let plan=NativeSourceSplashGlyphPlan.capture(text:"BOOM",random:{scope.mathRandom.next()},current:current),current() else{return false}
            let color=UIColor(red:241.0/255,green:132.0/255,blue:83.0/255,alpha:1)
            let field=NativeSplashGlyphField(artwork:artwork,text:"BOOM",
                colors:[color,color],splitIndex:0,deferExitRotationCapture:true,sourcePlan:plan)
            guard current(),self.tntGlyphs[id]==nil else{field.removeFromSuperview();return false}
            field.frame=self.view.bounds;field.autoresizingMask=[.flexibleWidth,.flexibleHeight]
            self.tntGlyphs[id]=field;self.sourceTntGlyphScopes[id]=scope
            self.sourceTntGlyphOwnerIDs[id]=self.engine.pendingDirectWild?.id ?? self.engine.pendingSpecial?.id ?? self.engine.pendingSourceLateFinalMerge?.ownerID
            self.view.addSubview(field);field.layoutIfNeeded()
            guard current(),self.tntGlyphs[id] === field,self.sourceTntGlyphScopes[id] === scope else {
                if self.tntGlyphs[id] === field {self.tntGlyphs.removeValue(forKey:id);self.sourceTntGlyphScopes.removeValue(forKey:id)}
                field.removeFromSuperview();return false
            }
            return true
        }
        scene.onTntGlyphClock = { [weak self] id,time,finished in
            guard let self else { return }
            if finished {self.sourceTntGlyphScopes.removeValue(forKey:id);self.sourceTntGlyphOwnerIDs.removeValue(forKey:id);self.tntGlyphs.removeValue(forKey:id)?.removeFromSuperview();return}
            guard !self.disposed else {return}
            if let scope=self.sourceTntGlyphScopes[id],let glyphs=self.tntGlyphs[id] {
                let generation=self.engine.state.generation
                let current:()->Bool = {[weak self,weak scope,weak glyphs] in
                    guard let self,let scope,let glyphs else{return false}
                    return !self.disposed && scope.current && self.sourceScope === scope &&
                        self.engine.state.generation==generation && self.tntGlyphs[id] === glyphs &&
                        self.sourceTntGlyphScopes[id] === scope && glyphs.superview === self.view
                }
                guard current() else{return}
                if time>=glyphs.exitStart,!glyphs.captureSourceExitRotations(random:{scope.mathRandom.next()},current:current) {
                    if current(){self.boardScene?.onSourcePresentationFailure?("source_tnt_glyph_exit_capture_refused",generation)}
                    return
                }
                guard current() else{return};glyphs.paint(seconds:time)
                self.boardScene?.reportFinalMergeProgress(seconds:time,duration:glyphs.duration,generation:generation,ownerID:self.sourceTntGlyphOwnerIDs[id])
                // Authored final handoff waits actual BOOM exit, not the
                // independent four-second debris parent completion.
                if time>=glyphs.duration,current() {
                    self.boardScene?.sourceTntGlyphExitCompleted(id:id,generation:generation)
                }
                return
            }
            let glyphs: NativeSplashGlyphField
            if let existing = self.tntGlyphs[id] { glyphs = existing }
            else {
                guard let artwork=self.selectedFinaleArtwork() else{return}
                let color = UIColor(red: 241.0/255,green: 132.0/255,blue: 83.0/255,alpha: 1)
                glyphs = NativeSplashGlyphField(artwork: artwork,text: "BOOM",colors: [color,color],splitIndex: 0)
                glyphs.frame = self.view.bounds; glyphs.autoresizingMask = [.flexibleWidth,.flexibleHeight]
                self.view.addSubview(glyphs); self.tntGlyphs[id] = glyphs; glyphs.layoutIfNeeded()
            }
            glyphs.paint(seconds: time)
        }
        scene.onSplashGlyphClock = { [weak self] variant,id,time,finished in
            guard let self else { return }
            if finished { self.tntGlyphs.removeValue(forKey: id)?.removeFromSuperview(); return }
            guard !self.disposed,variant == "star" || variant == "juice" || variant == "magnet" else { return }
            let glyphs: NativeSplashGlyphField
            if let existing = self.tntGlyphs[id] { glyphs = existing }
            else {
                guard let artwork=self.selectedFinaleArtwork() else{return}
                let color = variant == "magnet" ? UIColor(red: 1,green: 148.0/255,blue: 114.0/255,alpha: 1) :
                    variant == "juice" ? UIColor(red: 1,green: 182.0/255,blue: 175.0/255,alpha: 1) : UIColor(red: 1,green: 203.0/255,blue: 129.0/255,alpha: 1)
                glyphs = NativeSplashGlyphField(artwork: artwork,text: variant == "magnet" ? "SWOOP":variant == "juice" ? "BUBBLY" : "SPARKLE",colors: variant == "juice" ? [color,UIColor(red:249.0/255,green:222.0/255,blue:161.0/255,alpha:1)]:[color],splitIndex: variant == "juice" ? 3:0)
                glyphs.frame = self.view.bounds; glyphs.autoresizingMask = [.flexibleWidth,.flexibleHeight]
                self.view.addSubview(glyphs); self.tntGlyphs[id] = glyphs; glyphs.layoutIfNeeded()
            }
            glyphs.paint(seconds: time)
        }
        scene.onFishIdleFrames={ [weak self] frames,generation,force in
            guard let self,!self.disposed else {return}
            self.fishIdleOwner.paint(frames,generation:generation,force:force)
        }
        fishIdleOwner.onPrepared={ [weak self,weak scene] id,generation in
            guard let self,!self.disposed,self.engine.state.generation==generation else {return}
            scene?.prepareFishMedia(tileID:id,generation:generation)
        }
        fishIdleOwner.onMediaReady={ [weak self,weak scene] id,generation,ready in
            guard let self,!self.disposed,self.engine.state.generation==generation else {return}
            scene?.setFishMediaReady(tileID:id,generation:generation,ready:ready)
        }
        scene.onHaptic = { [weak self] style in self?.onHaptic?(style) }
        scene.onSpecialPresentationCancelled = { [weak self] variant in
            guard let variant else { return }; self?.area55Finales[variant]?.dispose()
        }
        scene.authoredFinalePresentationReady = { [weak self] variant in self?.finaleArtworkReady(variant) == true }
        scene.authoredTntPresentationReady = { [weak self] variant in self?.tntArtworkReady(variant) == true }
        scene.onAuthoredLaserImpact = { [weak self] targets,generation,impact,allContacts,completion in
            guard let self,!self.disposed,self.engine.state.generation == generation,self.tntArtworkReady("laser-gun"),let resources=self.laserResources else {return false}
            let owner=NativeLaserGunImpactPresentation(resources:resources,viewport:self.view.bounds.size,targets:targets,generation:generation)
            guard owner.assetReady else {owner.dispose();return false}
            self.area55Finales["laser-gun"]?.dispose();self.area55Finales["laser-gun"]=owner;self.area55Generations["laser-gun"]=generation;self.area55SourceOwnerIDs["laser-gun"]=self.engine.pendingDirectWild?.id ?? self.engine.pendingSpecial?.id ?? self.engine.pendingSourceLateFinalMerge?.ownerID
            owner.autoresizingMask=[.flexibleWidth,.flexibleHeight];self.view.addSubview(owner)
            owner.onImpact=impact;owner.onImpactsComplete=allContacts
            owner.onCue={ [weak self] moment,index in
                guard self?.engine.state.generation == generation else {return}
                let prefix="laser-gun-",cue=moment.hasPrefix(prefix) ? String(moment.dropFirst(prefix.count)):moment
                self?.onSpecialMoment?("laser-gun",cue,index)
            }
            owner.onFinished={ [weak self,weak owner] _ in
                if self?.area55Finales["laser-gun"] === owner {self?.area55Finales.removeValue(forKey:"laser-gun");self?.area55Generations.removeValue(forKey:"laser-gun")}
                if let self {self.prepareSelectedFinaleArtwork(self.engine.state)}
                completion()
            }
            self.bindFinalMergeProgress(owner,generation:generation);owner.start();return true
        }
        scene.onAuthoredTntPresentation = { [weak self] variant,_,generation,ready,completion in
            self?.presentTntVariant(variant,generation:generation,onGameplayReady:ready,completion:completion) == true
        }
        scene.onAuthoredFinale = { [weak self] variant,origin,generation,completion in
            guard let self,!self.disposed,self.engine.state.generation == generation else { return false }
            if ["coconut","flower","barell","beach-ball","bloob-ball"].contains(variant) {
                return self.presentTntVariant(variant,generation:generation,onGameplayReady:nil,completion:completion)
            }
            if variant == "spaceship" || variant == "laser-gun" {
                let owner: NativeFinitePresentation,ready: Bool
                if variant == "spaceship" {
                    let spaceship = NativeSpaceshipFinalePresentation(resourceRoot: self.resourceRoot,viewport: self.view.bounds.size,origin: origin,generation: generation,preparedArtwork:self.selectedFinaleArtwork())
                    owner = spaceship; ready = spaceship.assetReady
                } else {
                    let laser = NativeLaserGunFinalePresentation(resourceRoot: self.resourceRoot,viewport: self.view.bounds.size,origin: origin,generation: generation,preparedArtwork:self.selectedFinaleArtwork())
                    owner = laser; ready = laser.assetReady
                }
                guard ready else { owner.dispose(); return false }
                self.area55Finales[variant]?.dispose()
                if variant == "spaceship" { self.bottleFinale?.dispose(); self.honeyFinale?.dispose() }
                self.area55Finales[variant] = owner; self.area55Generations[variant] = generation
                self.area55SourceOwnerIDs[variant]=self.engine.pendingDirectWild?.id ?? self.engine.pendingSpecial?.id ?? self.engine.pendingSourceLateFinalMerge?.ownerID
                owner.autoresizingMask = [.flexibleWidth,.flexibleHeight]; self.view.addSubview(owner)
                owner.onCue = { [weak self] moment,index in
                    guard self?.engine.state.generation == generation else { return }
                    let prefix = variant+"-",cue = moment.hasPrefix(prefix) ? String(moment.dropFirst(prefix.count)) : moment
                    self?.onSpecialMoment?(variant,cue,index)
                }
                let releaseSource=variant == "laser-gun" ? self.boardScene?.beginSourceMotion(.tntFinale,id:UUID().uuidString,generation:generation):nil
                owner.onFinished = { [weak self,weak owner] _ in
                    releaseSource?()
                    if self?.area55Finales[variant] === owner { self?.area55Finales.removeValue(forKey: variant); self?.area55Generations.removeValue(forKey: variant) }
                    if let self {self.prepareSelectedFinaleArtwork(self.engine.state)}
                    completion()
                }
                self.bindFinalMergeProgress(owner,generation:generation);owner.start(); return true
            }
            if variant == "mushroom" || variant == "robo-cube" {
                let owner:NativeFinitePresentation
                if variant == "mushroom" {
                    let mushroom=NativeMushroomFinalePresentation(resourceRoot:self.resourceRoot,viewport:self.view.bounds.size,preparedArtwork:self.selectedFinaleArtwork())
                    guard mushroom.assetReady else {mushroom.dispose();return false}
                    mushroom.onHaptic={ [weak self] style in guard self?.engine.state.generation == generation else {return};self?.onHaptic?(style)}
                    owner=mushroom
                } else {
                    let robo=NativeRoboFinalePresentation(resourceRoot:self.resourceRoot,viewport:self.view.bounds.size,previousExitFrame:self.lastRoboExitFrame,preparedArtwork:self.selectedFinaleArtwork())
                    guard robo.assetReady else {robo.dispose();return false}
                    robo.onHaptic={ [weak self] style in guard self?.engine.state.generation == generation else {return};self?.onHaptic?(style)}
                    robo.onExitFrameSelected={ [weak self] frame in guard self?.engine.state.generation == generation else {return};self?.lastRoboExitFrame=frame}
                    owner=robo
                }
                self.area55Finales[variant]?.dispose();self.area55Finales[variant]=owner;self.area55Generations[variant]=generation
                owner.autoresizingMask=[.flexibleWidth,.flexibleHeight];self.view.addSubview(owner)
                let releaseSource=self.boardScene?.beginSourceMotion(.juiceFinale,id:UUID().uuidString,generation:generation)
                owner.onFinished={ [weak self,weak owner] _ in
                    releaseSource?()
                    (owner as? NativeMushroomFinalePresentation)?.onHaptic=nil
                    (owner as? NativeRoboFinalePresentation)?.onHaptic=nil;(owner as? NativeRoboFinalePresentation)?.onExitFrameSelected=nil
                    if self?.area55Finales[variant] === owner {self?.area55Finales.removeValue(forKey:variant);self?.area55Generations.removeValue(forKey:variant)}
                    if let self {self.prepareSelectedFinaleArtwork(self.engine.state)}
                    completion()
                }
                self.bindFinalMergeProgress(owner,generation:generation);owner.start();return true
            }
            if variant == "baloon" {
                guard let resources=self.finaleArtworkOwner?.baloonResources,let artwork=self.selectedFinaleArtwork() else{return false}
                let owner=NativeBaloonFinalePresentation(viewport:self.view.bounds.size,origin:origin,resources:resources,artwork:artwork)
                guard owner.assetReady else{owner.dispose();return false}
                self.area55Finales[variant]?.dispose();self.area55Finales[variant]=owner;self.area55Generations[variant]=generation
                owner.autoresizingMask=[.flexibleWidth,.flexibleHeight];self.view.addSubview(owner)
                let release=self.boardScene?.beginSourceMotion(.juiceFinale,id:UUID().uuidString,generation:generation)
                owner.onCue={ [weak self,weak owner] moment,index in
                    guard let self,self.engine.state.generation==generation,self.area55Finales[variant] === owner else{return}
                    self.onSpecialMoment?(variant,moment,index)
                }
                owner.onFinished={ [weak self,weak owner] _ in
                    release?()
                    if self?.area55Finales[variant] === owner {self?.area55Finales.removeValue(forKey:variant);self?.area55Generations.removeValue(forKey:variant)}
                    if let self {self.prepareSelectedFinaleArtwork(self.engine.state)}
                    completion()
                }
                self.bindFinalMergeProgress(owner,generation:generation);owner.start();return true
            }
            if variant == "cubero" {
                let owner=NativeCuberoFinalePresentation(resourceRoot:self.resourceRoot,viewport:self.view.bounds.size,preparedArtwork:self.selectedFinaleArtwork())
                guard owner.assetReady else {owner.dispose();return false}
                self.area55Finales[variant]?.dispose()
                self.area55Finales[variant]=owner;self.area55Generations[variant]=generation
                owner.autoresizingMask=[.flexibleWidth,.flexibleHeight];self.view.addSubview(owner)
                owner.onHaptic={ [weak self] style in
                    guard self?.engine.state.generation == generation else {return}
                    self?.onHaptic?(style)
                }
                owner.onFinished={ [weak self,weak owner] _ in
                    owner?.onHaptic=nil
                    if self?.area55Finales[variant] === owner {self?.area55Finales.removeValue(forKey:variant);self?.area55Generations.removeValue(forKey:variant)}
                    if let self {self.prepareSelectedFinaleArtwork(self.engine.state)}
                    completion()
                }
                self.bindFinalMergeProgress(owner,generation:generation);owner.start();return true
            }
            if variant == "bloob" {
                let owner=NativeBloobFinalePresentation(resourceRoot:self.resourceRoot,viewport:self.view.bounds.size,origin:origin,preparedArtwork:self.selectedFinaleArtwork())
                guard owner.assetReady else {owner.dispose();return false}
                self.area55Finales[variant]?.dispose()
                self.area55Finales[variant]=owner;self.area55Generations[variant]=generation
                owner.bindScreenShake(to:self.view)
                owner.bindBoardReaction(self.boardScene?.makeBloobBoardReaction())
                owner.autoresizingMask=[.flexibleWidth,.flexibleHeight];self.view.addSubview(owner)
                owner.onCue={ [weak self] moment,index in
                    guard self?.engine.state.generation == generation else {return}
                    self?.onSpecialMoment?(variant,moment,index)
                }
                owner.onFinished={ [weak self,weak owner] _ in
                    if self?.area55Finales[variant] === owner {self?.area55Finales.removeValue(forKey:variant);self?.area55Generations.removeValue(forKey:variant)}
                    if let self {self.prepareSelectedFinaleArtwork(self.engine.state)}
                    completion()
                }
                self.bindFinalMergeProgress(owner,generation:generation);owner.start();return true
            }
            if variant == "bee" || variant == "kite" {
                let owner=NativeBeeFinalePresentation(resourceRoot:self.resourceRoot,viewport:self.view.bounds.size,origin:origin,preparedArtwork:self.selectedFinaleArtwork(),kite:variant == "kite")
                guard owner.assetReady else {owner.dispose();return false}
                self.area55Finales[variant]?.dispose()
                self.area55Finales[variant]=owner;self.area55Generations[variant]=generation
                owner.autoresizingMask=[.flexibleWidth,.flexibleHeight];self.view.addSubview(owner)
                owner.onCue={ [weak self] moment,index in
                    guard self?.engine.state.generation == generation else {return}
                    self?.onSpecialMoment?(variant,moment,index)
                }
                owner.onHaptic={ [weak self] style in
                    guard self?.engine.state.generation == generation else {return}
                    self?.onHaptic?(style)
                }
                owner.onFinished={ [weak self,weak owner] _ in
                    owner?.onHaptic=nil
                    if self?.area55Finales[variant] === owner {self?.area55Finales.removeValue(forKey:variant);self?.area55Generations.removeValue(forKey:variant)}
                    if let self {self.prepareSelectedFinaleArtwork(self.engine.state)}
                    completion()
                }
                self.bindFinalMergeProgress(owner,generation:generation);owner.start();return true
            }
            if variant == "kanta" {
                let owner = NativeKantaFinalePresentation(resourceRoot:self.resourceRoot,viewport:self.view.bounds.size,preparedArtwork:self.selectedFinaleArtwork())
                guard owner.assetReady else {owner.dispose();return false}
                self.area55Finales[variant]?.dispose()
                self.area55Finales[variant] = owner;self.area55Generations[variant] = generation
                owner.autoresizingMask = [.flexibleWidth,.flexibleHeight];self.view.addSubview(owner)
                owner.onCue = { [weak self,weak owner] moment,index in
                    guard let self,!self.disposed,self.engine.state.generation == generation else {return}
                    self.onSpecialMoment?(variant,moment,index)
                    if moment == "walking" {owner?.onAudioFade = self.onSpecialFadeCapture?(variant,generation)}
                }
                owner.onHaptic = { [weak self] style in
                    guard self?.engine.state.generation == generation else {return}
                    self?.onHaptic?(style)
                }
                owner.onFinished = { [weak self,weak owner] _ in
                    owner?.onAudioFade = nil;owner?.onHaptic = nil
                    if self?.area55Finales[variant] === owner {self?.area55Finales.removeValue(forKey:variant);self?.area55Generations.removeValue(forKey:variant)}
                    if let self {self.prepareSelectedFinaleArtwork(self.engine.state)}
                    completion()
                }
                self.bindFinalMergeProgress(owner,generation:generation);owner.start();return true
            }
            if variant == "bottle" {
                self.area55Finales["spaceship"]?.dispose()
                self.honeyFinale?.dispose()
                self.bottleFinale?.dispose()
                let owner = NativeBottleFinalePresentation(resourceRoot: self.resourceRoot,viewport: self.view.bounds.size,preparedArtwork:self.selectedFinaleArtwork())
                let plan=self.engine.pendingSpecial
                let excluded=Set((plan?.targets.map(\.id) ?? [])+[plan?.source.id,plan?.destination.id].compactMap{$0})
                owner.bindBoardReaction(self.boardScene?.makeBloobBoardReaction(excluding:excluded),pullComplete:{[weak scene=self.boardScene] in
                    scene?.sourcePullConverged(ownerID:plan?.id,generation:generation) ?? true
                })
                owner.autoresizingMask = [.flexibleWidth,.flexibleHeight]
                self.bottleFinale = owner; self.bottleGeneration = generation; self.view.addSubview(owner)
                owner.onCue = { [weak self] moment,index in
                    guard self?.engine.state.generation == generation else { return }
                    self?.onSpecialMoment?("bottle",moment,index)
                    if moment == "water-waves" { self?.onHaptic?("medium") }
                }
                owner.onFinished = { [weak self,weak owner] _ in
                    if self?.bottleFinale === owner { self?.bottleFinale = nil; self?.bottleGeneration = nil }
                    if let self {self.prepareSelectedFinaleArtwork(self.engine.state)}
                    completion()
                }
                self.bindFinalMergeProgress(owner,generation:generation);owner.start(); return true
            }
            if variant == "honey" {
                self.area55Finales["spaceship"]?.dispose()
                self.bottleFinale?.dispose(); self.honeyFinale?.dispose()
                let owner = NativeHoneyFinalePresentation(resourceRoot: self.resourceRoot,viewport: self.view.bounds.size,preparedArtwork:self.selectedFinaleArtwork())
                owner.autoresizingMask = [.flexibleWidth,.flexibleHeight]
                self.honeyFinale = owner; self.honeyGeneration = generation; self.view.addSubview(owner)
                owner.onCue = { [weak self] moment,index in
                    guard self?.engine.state.generation == generation else { return }
                    self?.onSpecialMoment?("honey",moment,index)
                }
                owner.onFinished = { [weak self,weak owner] _ in
                    if self?.honeyFinale === owner { self?.honeyFinale = nil; self?.honeyGeneration = nil }
                    if let self {self.prepareSelectedFinaleArtwork(self.engine.state)}
                    completion()
                }
                self.bindFinalMergeProgress(owner,generation:generation);owner.start(); return true
            }
            guard variant == "fish" else { return false }
            self.fishFinale?.dispose()
            let owner = NativeFishFinalePresentation(resourceRoot: self.resourceRoot,origin: origin,viewport: self.view.bounds.size,preparedArtwork:self.selectedFinaleArtwork())
            owner.autoresizingMask = [.flexibleWidth,.flexibleHeight]
            self.fishFinale = owner; self.fishGeneration = generation; self.view.addSubview(owner)
            owner.onFinished = { [weak self,weak owner] success in
                if self?.fishFinale === owner { self?.fishFinale = nil; self?.fishGeneration = nil }
                if !success { NSLog("[NativeFishFinale] preserved HEVC rendering did not complete") }
                if let self {self.prepareSelectedFinaleArtwork(self.engine.state)}
                completion()
            }
            owner.onProgress = self.boardScene?.finalMergeProgressObserver(generation:generation);owner.start(); return true
        }
        scene.unreadJourneyDice = {[weak self] in self?.unreadJourneyDice() ?? []}
        scene.onJourneyDieLanded = {[weak self] id,board,generation in self?.onJourneyDieLanded?(id,board,generation)}
        scene.refreshBackpackAlert()
        scene.onHUDTapContact = {[weak self] kind in self?.onHUDTapContact?(kind)}
        scene.onHelpRequest = { [weak self] in
            guard let self,self.engine.state.mode != .arcade || self.engine.state.effectiveArcadeVariant != .pureDice else { return }
            self.onHelp?()
        }
        scene.onScoreRequest = { [weak self] in self?.onScore?() }
        scene.onComboRequest = { [weak self] in self?.onCombo?() }
        scene.onPointerState = { [weak self] active in self?.onPointerState?(active) }
        scene.onEndgameHintEvaluation={ [weak self] _ in self?.updateNativeEndgameHint() }
        scene.onEndgameHintInteraction={ [weak self] in self?.endgameHint?.interact() }
        scene.onStateChange = { [weak self] state in
            if let self,let generation=self.boardClearedGeneration,generation != state.generation {self.retireBoardCleared();self.boardClearedGeneration=nil}
            if self?.preparedJourneyReward?.presentationGeneration != state.generation {self?.retirePreparedJourneyReward()}
            if self?.preparedJourneyResult?.generation != state.generation {self?.retirePreparedJourneyResult()}
            self?.retireJourneyRewardChildren(excludingGeneration:state.generation)
            if let generation = self?.fishGeneration,generation != state.generation { self?.fishFinale?.dispose() }
            if let generation = self?.bottleGeneration,generation != state.generation { self?.bottleFinale?.dispose() }
            if let generation = self?.honeyGeneration,generation != state.generation { self?.honeyFinale?.dispose() }
            if let self { for (variant,generation) in self.area55Generations where generation != state.generation { self.area55Finales[variant]?.dispose() } }
            self?.prepareSelectedFinaleArtwork(state)
            self?.onStateChange?(state)
            self?.updateNativeEndgameHint()
        }
        scene.onFinalMergeProgress = {[weak self] _,_,generation in self?.presentBoardCleared(generation:generation)}
        scene.onTerminal = { [weak self] result in
            guard let self,!self.disposed else{return}
            guard result.kind == .complete,(self.engine.state.mode == .journey || self.engine.state.tutorial?.requiresResultCompletion != true) else {
                self.onTerminal?(result);return
            }
            guard !self.exitingBoard else{return}
            let generation=self.engine.state.generation
            self.presentBoardCleared(generation:generation)
            self.retirePreparedJourneyResult()
            if let resultController=self.prepareJourneyResultController?(result) {
                self.preparedJourneyResult=(generation,resultController)
                resultController.prepareForHandoff(viewport:self.view.bounds.size)
            }
            self.preparedJourneyReward=self.prepareJourneyRewardController?(result)
            self.preparedJourneyReward?.loadViewIfNeeded()
            self.animateBoardExit(finalMerge:true) { [weak self,weak scene] completed in
                guard let self else{return}
                guard let scene,completed,!self.disposed,self.boardScene === scene,
                      self.engine.state.generation==generation else{self.retirePreparedJourneyReward();self.retirePreparedJourneyResult();return}
                let deliver:()->Void = {[weak self] in
                    guard let self,!self.disposed,self.engine.state.generation==generation else{return}
                    self.onTerminal?(result)
                }
                if self.boardClearedPresentation != nil {self.boardClearedTerminalContinuation=deliver;self.boardClearedSuccessorReady=true}
                else {deliver()}
            }
        }
        scene.onFirstBoardFrame = { [weak self] in
            guard let self,!self.disposed else{return}
            self.updateNativeEndgameHint()
            self.firstBoardFrameReady=true
            let ready=self.firstBoardFrameWaiters;self.firstBoardFrameWaiters.removeAll();ready.forEach{$0()}
        }
        scene.onBoardEntry = { [weak self] duration,beats in self?.onBoardEntry?(duration,beats) }
        scene.onBoardExit = { [weak self] duration in self?.onBoardExit?(duration) }
        scene.onHUDDrop = { [weak self] generation in
            guard let self,!self.disposed,self.engine.state.generation==generation else{return}
            self.revealJourneyBottomDecor()
        }
        scene.onBoardEntry = { [weak self] duration,beats in self?.onBoardEntry?(duration,beats) }
        scene.captureSourceScreenOverlayShake = { [weak self] ownerID,variant,generation in
            guard let self,!self.disposed,self.engine.state.generation==generation else{return nil}
            if variant==nil {
                guard let id=self.sourceTntGlyphOwnerIDs.first(where:{$0.value==ownerID && self.tntGlyphs[$0.key] != nil})?.key,
                      let glyphs=self.tntGlyphs[id],let scope=self.sourceTntGlyphScopes[id],scope.current,
                      glyphs.superview === self.view else{return nil}
                return NativeSourceScreenShakeOverlayTarget(read:{[weak glyphs] in
                    guard let glyphs else{return .zero};return CGPoint(x:glyphs.transform.tx,y:glyphs.transform.ty)
                },paint:{[weak glyphs] offset in glyphs?.transform=CGAffineTransform(translationX:offset.x,y:offset.y)},current:{[weak self,weak glyphs,weak scope] in
                    guard let self,let glyphs,let scope else{return false}
                    return !self.disposed && self.engine.state.generation==generation && scope.current &&
                        self.tntGlyphs[id] === glyphs && self.sourceTntGlyphOwnerIDs[id]==ownerID && glyphs.superview === self.view
                })
            }
            guard let variant,
                  ["coconut","flower","barell","beach-ball","laser-gun","bloob-ball"].contains(variant),
                  self.area55SourceOwnerIDs[variant]==ownerID,self.area55Generations[variant]==generation,
                  let owner=self.area55Finales[variant],owner.superview != nil else{return nil}
            return NativeSourceScreenShakeOverlayTarget(read:{[weak owner] in
                guard let owner else{return .zero};return CGPoint(x:owner.transform.tx,y:owner.transform.ty)
            },paint:{[weak owner] offset in owner?.transform=CGAffineTransform(translationX:offset.x,y:offset.y)},current:{[weak self,weak owner] in
                guard let self,let owner else{return false}
                return !self.disposed && self.engine.state.generation==generation &&
                    self.area55Finales[variant] === owner && self.area55SourceOwnerIDs[variant]==ownerID && owner.superview != nil
            })
        }
        scene.onJourneyBottomDecorShake = { [weak self] offset,generation in
            self?.journeyBottomDecor?.applyShake(sourceOffset:offset,generation:generation)
        }
        scene.onGameplayReceipt = { [weak self] event,source,destination,generation in self?.onGameplayReceipt?(event,source,destination,generation) }
        scene.onSpecialMoment = { [weak self] variant,moment,index in self?.onSpecialMoment?(variant,moment,index) }
        scene.onHUDCoinArrival = { [weak self] relativeSize in self?.onHUDCoinArrival?(relativeSize) }
        scene.onGameplayEvent = { [weak self] event in
            guard let self,!self.disposed else{return}
            // Ordinary final contact starts the clear group immediately. Wild/
            // Special finales keep the screen until their authored animation ends.
            let ordinary=self.engine.pendingOrdinarySix
            if event.kind == .ordinarySixReserved,ordinary?.isFinal == true,event.reason == ordinary?.id {
                self.presentBoardCleared(generation:self.engine.state.generation)
            }
            self.onGameplayEvent?(event)
        }
        scene.onFrameTarget={ [weak self,weak scene] fps in
            guard let self,!self.disposed,self.spriteView.surfaceFrameRate != fps else{return}
            if fps<60 {scene?.retireSourceRendererDragTransport()}
            self.spriteView.surfaceFrameRate=fps
        }
        scene.onRenderSurfacePreparation = { [weak self,weak scene] in
            guard let self,let scene,!self.disposed,self.boardScene === scene,
                  self.spriteView.renderedScene === scene else{return}
            self.applyGameplayDrawableBudget()
        }
        // Registry suspension pauses shared SpriteKit motion, not Fish's
        // direct authored media. Only its pointer or route lifecycle hides it.
        scene.onRenderingDemand = { [weak self,weak scene] active in
            guard let self, !self.disposed else { return }
            // The Scene admits its finite HUD entrance/contact feedback while a
            // foreground modal freezes gameplay. Do not override that receipt.
            // Late resource completions may relinquish normal board rendering
            // while a foreground sheet still owns finite HUD presentation.
            // Its existing scene receipt wins until that exact feedback settles.
            let hudFeedback=scene?.hasActiveHUDPresentationFeedback == true
            let paused = self.backgrounded ||
                ((!active || self.explicitlySuspended && !self.exitingBoard) && !hudFeedback)
            if paused {scene?.retireSourceRendererDragTransport()}
            self.spriteView.surfacePaused = paused
        }
        boardScene = scene
        scene.onSourcePresentationFailure = {[weak self,weak scene] reason,generation in
            guard let self,let scene,!self.disposed,self.boardScene === scene,let scope=self.sourceScope,scope.current,
                self.engine.state.generation==generation,self.sourcePresentationFailureGeneration != generation else{return}
            NativeSourceRejectionDiagnostics.record(.init(reason:reason,generation:generation,
                board:self.engine.state.board,mode:self.engine.state.mode.rawValue,
                phase:self.backgrounded ? "background":self.explicitlySuspended ? "suspended":"foreground",
                counters:["revision":Int(clamping:self.engine.state.revision),"moves":self.engine.state.moves,
                    "pendingHUDCoins":self.engine.pendingHUDStars.count],
                details:["impact":scene.sourceSpecialImpactParticleRejection ?? "none",
                    "spawnSafety":scene.sourceSpawnSafetyDiagnostic,"tnt":scene.sourceTntMainDiagnostic(),
                    "tntResume":scene.sourceTntSpawnResumeRejection ?? "none",
                    "physical":scene.sourcePhysicalBoardCaptureDiagnostic,
                    "minimum":scene.sourceMinimumCaptureDiagnostic]))
            self.finaleArtworkOwner?.dispose();self.finaleArtworkOwner=nil
            self.sourcePresentationFailureGeneration=generation
            self.sourcePresentationFailure = .init(reason:reason,generation:generation,boardState:self.engine.state)
            self.retirePreparedJourneyReward();self.retirePreparedJourneyResult();self.retireJourneyRewardChildren()
            guard scene.sealSourcePresentationFailure(generation:generation),!self.disposed,self.boardScene === scene,
                self.engine.state.generation==generation else{return}
            NSLog("[NativeSourcePresentation] captured generation %llu retired: %@",generation,reason)
            self.onSourcePresentationFailure?()
        }
        prepareSelectedFinaleArtwork(engine.state)
        prepareSourceNoMovesSceneBinding()
        prepareNativeNoMovesPresentation()
        observations = [
            NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.backgrounded = true; self?.applySuspension() }
            },
            NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.backgrounded = false; self?.applySuspension() }
            }
        ]
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        paperSurface.frame=view.bounds
        if let tasks=sourceScope?.sourceMicrotaskTasks {
            _=tasks.layoutTask{layoutGameplayPresentation()}
        } else {layoutGameplayPresentation()}
    }
    private func layoutGameplayPresentation() {
        guard !disposed,let boardScene,spriteView.bounds.width > 0,spriteView.bounds.height > 0 else { return }
        let scale=spriteView.window?.screen.scale ?? UIScreen.main.scale
        if spriteView.contentScaleFactor != scale {spriteView.contentScaleFactor=scale}
        applyGameplayDrawableBudget()
        journeyBottomDecor?.frame=view.bounds
        if !hasPresentedScene,!initialEntryGateReleased,beforeInitialBoardEntry != nil || journeyBottomDecor != nil {
            if !initialEntryGateRequested {
                initialEntryGateRequested = true
                let generation = engine.state.generation
                let release:()->Void = { [weak self] in
                    self?.prepareBoardEntryArtwork { [weak self] ready in
                        guard let self,!self.disposed,!self.initialEntryGateReleased,self.engine.state.generation == generation else {return}
                        guard ready else{self.onBoardArtworkFailure?();return}
                        self.initialEntryGateReleased=true;self.spriteView.isHidden=false
                        self.view.setNeedsLayout();self.view.layoutIfNeeded()
                    }
                }
                if let beforeInitialBoardEntry {beforeInitialBoardEntry(release)}else{release()}
            }
            return
        }
        // Only Arcade's prepared snapshot needs animation suppression before
        // its save receipt. Journey's prior-attempt retirement is metadata-only;
        // keep its entry running so Wild idle remains deferred until entry ends.
        let preparedSourceSave = !hasPresentedScene && engine.state.mode == .arcade && beforeSourceInitialBoardReveal != nil
        boardScene.layout(size: spriteView.bounds.size,insets: view.safeAreaInsets,animateEntry: !hasPresentedScene && !preparedSourceSave)
        if sourceDirectPresentationEnabled,!sourceDirectHUDInstalled {
            guard installSourceDirectHUDPresentation(scene:boardScene) else {
                boardScene.onSourcePresentationFailure?("source_app_direct_hud_not_bound",engine.state.generation)
                return
            }
        }
        // Initial synchronize above must precede this captured generation's
        // idle registration; new board generations retire the previous owner.
        if sourceSpecialIdlePresentationEnabled,sourceInitialConstruction != nil,!boardScene.sourceRestoredWildSkinsConfigured {
            guard let scope=sourceScope,scope.current,
                  boardScene.configureSourceRestoredWildSkins(scope:scope) else {
                boardScene.onSourcePresentationFailure?("source_restored_wild_skin_owner_not_bound",engine.state.generation)
                return
            }
        }
        if sourceSpecialIdlePresentationEnabled,sourceInitialConstruction != nil {
            guard let scope=sourceScope,boardScene.configureSourceRestoredPlainStarHalos(scope:scope,waitForSharedIdle:true) else {
                boardScene.onSourcePresentationFailure?("source_restored_star_halo_owner_not_bound",engine.state.generation)
                return
            }
        }
        if sourceSpecialIdlePresentationEnabled,!boardScene.sourceSpecialIdleAdmissionOpen {
            guard let scope=sourceScope,scope.current,boardScene.sourceMicrotaskBoundariesInstalled,
                  boardScene.configureSourceSpecialIdle(scope:scope) else {
                boardScene.onSourcePresentationFailure?("source_app_idle_owner_not_bound",engine.state.generation)
                return
            }
        }
        if sourceOrdinaryPresentationEnabled,!sourceOrdinaryPresentationInstalled {
            guard sourceSmallStackPresentationEnabled,sourceEndgameMutationLedgerEnabled,
                  engine.sourceOrdinaryStackFacesEnabled,let scope=sourceScope,scope.current,
                  boardScene.sourceSpecialIdleAdmissionOpen,boardScene.sourceEndgameMutationLedgerAdmissionOpen else {
                boardScene.onSourcePresentationFailure?("source_app_ordinary_dependencies_not_bound",engine.state.generation)
                return
            }
            boardScene.sourceOrdinarySixSameNodeEnabled=true
            guard boardScene.configureSourceOrdinarySixMain(scope:scope,acquireIdle:{[weak boardScene] reason in
                boardScene?.acquireSourceSpecialIdle(reason:reason)
            }),boardScene.configureSourceOrdinaryLockedSettlements(scope:scope),
                boardScene.configureSourceOrdinaryMinimumTileAuthority(scope:scope),
                boardScene.configureSourceNormalOrdinarySpawnCoroutine(scope:scope,includeEndgame:sourceOrdinaryEndgamePresentationEnabled) else {
                boardScene.onSourcePresentationFailure?("source_app_ordinary_main_not_bound",engine.state.generation)
                return
            }
            sourceOrdinaryPresentationInstalled=true
        }
        if sourceDirectPresentationEnabled,!sourceDirectPresentationInstalled {
            guard sourceOrdinaryPresentationInstalled,sourceDirectHUDInstalled,let scope=sourceScope,scope.current else {
                boardScene.onSourcePresentationFailure?("source_app_direct_dependencies_not_bound",engine.state.generation)
                return
            }
            boardScene.sourceDirectWildSameNodeEnabled=true
            guard boardScene.configureSourceDirectWildMain(scope:scope) else {
                boardScene.onSourcePresentationFailure?("source_app_direct_main_not_bound",engine.state.generation)
                return
            }
            sourceDirectPresentationInstalled=true
        }
        if sourceTntPresentationEnabled,!sourceTntPresentationInstalled {
            guard sourceOrdinaryPresentationInstalled,sourceDirectPresentationInstalled,let scope=sourceScope,scope.current,
                  boardScene.configureSourceTntMain80(scope:scope) else {
                boardScene.onSourcePresentationFailure?("source_app_tnt_main_not_bound",engine.state.generation);return
            }
            sourceTntPresentationInstalled=true
        }
        if sourceMagnetPresentationEnabled,!sourceMagnetPresentationInstalled,
           let initial=sourceInitialConstruction,initial.constructorBatchPending {
            // Resume from the actual constructor RAF, before partially mounting
            // Magnet's scope owners. A timer cannot substitute this boundary.
            initial.onConstructorBatchSettled = {[weak self,weak initial] in
                guard let self,let initial,!self.disposed,self.sourceInitialConstruction === initial else{return}
                self.view.setNeedsLayout();self.view.layoutIfNeeded()
            }
            return
        }
        if sourceMagnetPresentationEnabled,!sourceMagnetPresentationInstalled {
            guard sourceOrdinaryPresentationInstalled,let scope=sourceScope,scope.current,
                  let capture=captureSourceMagnetCleanup,
                  (sourceDirectPresentationInstalled || boardScene.ensureSourceSpecialTransactions(scope:scope)) else {
                boardScene.onSourcePresentationFailure?("source_app_magnet_dependencies_not_bound",engine.state.generation)
                return
            }
            let stages:[(String,()->Bool)] = [
                ("fallback",{boardScene.configureSourceMagnetFallback(scope:scope)}),
                ("physical",{boardScene.configureSourceMagnetPhysicalVerification(scope:scope)}),
                ("main",{boardScene.configureSourceMagnetMain80(scope:scope)}),
                ("lazy",{boardScene.configureSourceMagnetLazyRespawn(scope:scope)}),
                ("pull",{boardScene.configureSourceMagnetPullCleanup(scope:scope,captureCleanup:capture)})]
            for (stage,install) in stages {
                guard install() else {
                    boardScene.onSourcePresentationFailure?("source_app_magnet_"+stage+"_not_bound",engine.state.generation);return
                }
            }
            sourceMagnetPresentationInstalled=true
        }
        if sourceRegularIdlePresentationEnabled,!boardScene.sourceRegularIdleAdmissionOpen {
            guard sourceOrdinaryPresentationInstalled,let scope=sourceScope,scope.current,
                  boardScene.configureSourceRegularIdle(scope:scope) else {
                boardScene.onSourcePresentationFailure?("source_app_regular_idle_not_bound",engine.state.generation);return
            }
        }
        if sourceDirectPresentationInstalled,!sourceWildDestinationResourcesPrepared {
            if !sourceWildDestinationResourcesPreparing,let scope=sourceScope,scope.current {
                sourceWildDestinationResourcesPreparing=true
                boardScene.sourceDirectWildDestinationFaceEnabled=true
                let generation=engine.state.generation
                boardScene.prepareSourceDirectWildDestinationFace(scope:scope) {[weak self,weak boardScene] ready in
                    guard let self,let boardScene,!self.disposed,self.boardScene === boardScene,
                          self.engine.state.generation==generation,scope.current else{return}
                    guard ready else {
                        boardScene.onSourcePresentationFailure?("source_wild_destination_assets_not_ready",generation);return
                    }
                    self.sourceWildDestinationResourcesPrepared=true
                    self.view.setNeedsLayout()
                }
            }
            return
        }
        if sourceGameplayRuntimeObservationEnabled,!sourceGameplayRuntimeObservationInstalled {
            guard let scope=sourceScope,scope.current,
                  boardScene.configureSourceGameplayRuntimeObservation(scope:scope) else {
                boardScene.onSourcePresentationFailure?("source_app_runtime_marker_owners_not_bound",engine.state.generation)
                return
            }
            sourceGameplayRuntimeObservationInstalled=true
        }
        if !hasPresentedScene,let prepare=beforeSourceGameplayAdmission,!sourceGameplayAdmissionAccepted {
            if !sourceGameplayAdmissionRequested {
                sourceGameplayAdmissionRequested=true
                let generation=engine.state.generation
                prepare {[weak self,weak boardScene] accepted in
                    guard let self,let boardScene,!self.disposed,self.boardScene === boardScene,
                          self.engine.state.generation==generation else{return}
                    guard accepted else {
                        boardScene.onSourcePresentationFailure?("native_gameplay_ownership_not_mounted",generation);return
                    }
                    self.sourceGameplayAdmissionAccepted=true
                    self.beforeSourceGameplayAdmission=nil
                    self.view.setNeedsLayout()
                }
            }
            return
        }
        if !hasPresentedScene {
            if let save=beforeSourceInitialBoardReveal {
                guard save(),!disposed,self.boardScene === boardScene else {
                    boardScene.onSourcePresentationFailure?("source_prepared_arcade_save_not_admitted",engine.state.generation);return
                }
                sourceInitialBoardSaveAccepted=true;beforeSourceInitialBoardReveal=nil
            }
            boardScene.prepareSourceBoardEntry()
            if preparedSourceSave {boardScene.synchronize(animateEntry:true)}
            hasPresentedScene=true
            guard spriteView.presentGameplayScene(boardScene) else {
                hasPresentedScene=false
                boardScene.onSourcePresentationFailure?("native_render_host_mount_refused",engine.state.generation)
                return
            }
            applyGameplayDrawableBudget()
            // Artwork admission is independent of the optional board wave.
            if !boardScene.isHUDRevealPending {revealJourneyBottomDecor()}
        }
    }
    // Uses the same opt-in admission as Scene diagnostics. No sampling timer
    // or layout/resource walk; counters are read by the existing capture owner.
    var drawableBudgetDiagnosticsEnabled=NativeDiagnosticsCapture.admitted(arguments:ProcessInfo.processInfo.arguments,
        bundleIdentifier:Bundle.main.bundleIdentifier,preferenceEnabled:UserDefaults.standard.bool(forKey:"cc.performanceDiagnostics"))
    private var drawableBudgetCalls=0,drawableBudgetWrites=0
    private var drawableBudgetBefore=CGSize.zero,drawableBudgetAfter=CGSize.zero,drawableBudgetDesired=CGSize.zero
    private var drawableBudgetLastWriteBefore=CGSize.zero,drawableBudgetLastWriteAfter=CGSize.zero
    private var drawableBudgetWorstMilliseconds=0.0
    func drawableBudgetDiagnosticSnapshot()->[String:Any] {
        guard drawableBudgetDiagnosticsEnabled else{return [:]}
        func dimensions(_ size:CGSize)->[Double] {[Double(size.width),Double(size.height)]}
        var snapshot:[String:Any] = ["calls":drawableBudgetCalls,"actualWrites":drawableBudgetWrites,
            "lastBeforePixels":dimensions(drawableBudgetBefore),"lastAfterPixels":dimensions(drawableBudgetAfter),
            "desiredPixels":dimensions(drawableBudgetDesired),
            "lastWriteBeforePixels":dimensions(drawableBudgetLastWriteBefore),
            "lastWriteAfterPixels":dimensions(drawableBudgetLastWriteAfter),
            "worstMilliseconds":drawableBudgetWorstMilliseconds,
            "renderingMode":spriteView is NativeOwnedMetalGameplayView ? "owned-metal" : ((spriteView as? SKView)?.isAsynchronous == true ? "asynchronous":"synchronous"),
            "preferredFramesPerSecond":spriteView.surfaceFrameRate,
            "contentScaleFactor":Double(spriteView.contentScaleFactor)]
        if let legacy=spriteView as? SKView {snapshot["isAsynchronous"]=legacy.isAsynchronous}
        if let owned=spriteView as? NativeOwnedMetalGameplayView {
            snapshot["ownedMetal"]=owned.diagnosticSnapshot()
        }
        if let surface=spriteView.layer as? CAMetalLayer {
            snapshot["presentsWithTransaction"]=surface.presentsWithTransaction
            snapshot["maximumDrawableCount"]=surface.maximumDrawableCount
        }
        return snapshot
    }
    private func applyGameplayDrawableBudget() {
        // SpriteKit sizes its drawable explicitly; changing UIView density
        // alone leaves the native-resolution Metal target unchanged.
        guard let surface=spriteView.layer as? CAMetalLayer,
              spriteView.bounds.width>0,spriteView.bounds.height>0 else{return}
        let diagnosticStart=drawableBudgetDiagnosticsEnabled ? CACurrentMediaTime():nil
        let scale=spriteView.window?.screen.scale ?? UIScreen.main.scale
        let pixels=CGSize(width:(spriteView.bounds.width*scale).rounded(.up),
                          height:(spriteView.bounds.height*scale).rounded(.up)),before=surface.drawableSize
        if before != pixels {
            if let owned=spriteView as? NativeOwnedMetalGameplayView {owned.drawableSize=pixels}
            else {surface.drawableSize=pixels}
        }
        if let diagnosticStart {
            drawableBudgetCalls+=1
            let after=surface.drawableSize
            drawableBudgetBefore=before;drawableBudgetAfter=after;drawableBudgetDesired=pixels
            if before != pixels {
                drawableBudgetWrites+=1;drawableBudgetLastWriteBefore=before;drawableBudgetLastWriteAfter=after
            }
            drawableBudgetWorstMilliseconds=max(drawableBudgetWorstMilliseconds,(CACurrentMediaTime()-diagnosticStart)*1000)
        }
    }
    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        setSuspended(true)
    }
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        if hasPresentedScene { setSuspended(false) }
    }
    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
        boardScene?.handleMemoryWarning()
    }

    func selectedFinaleArtwork()->JimiV9Artwork? {
        guard !disposed,sourcePresentationFailureGeneration != engine.state.generation else{return nil}
        if finaleArtworkOwner?.generation != engine.state.generation {
            finaleArtworkOwner?.dispose()
            let generation=engine.state.generation
            finaleArtworkOwner=NativeSelectedUIKitFinaleArtworkOwner(root:resourceRoot,generation:generation,current:{[weak self] in
                guard let self else{return false}
                return !self.disposed && self.engine.state.generation==generation && self.sourcePresentationFailureGeneration != generation
            })
        }
        return finaleArtworkOwner?.artwork
    }
    private func prepareSelectedFinaleArtwork(_ state:NativeBoardState) {
        guard state.generation==engine.state.generation,selectedFinaleArtwork() != nil else{return}
        // Only actual selected/restored variants, never the entire reward pool.
        // This runs at selection publication, before the meter drop/next merge.
        var variants=Set(state.tiles.filter(\.isWild).compactMap(\.variant)).union(area55Finales.keys)
        // The Source prefix intentionally clears the destination's Wild state
        // before main. Its current transaction still owns the selected finale;
        // retain that family until the mounted presentation takes over the lease.
        if let plan=engine.pendingDirectWild,plan.generation==state.generation,let variant=plan.variant {variants.insert(variant)}
        if let plan=engine.pendingSpecial,plan.generation==state.generation,let variant=plan.variant {variants.insert(variant)}
        if let receipt=engine.pendingSourceLateFinalMerge,receipt.generation==state.generation,let variant=receipt.variant {variants.insert(variant)}
        if state.tiles.contains(where:{$0.gameplayArchetype == .magnet && $0.variant==nil}) {boardScene?.preparePlainMagnetFinaleTextures()}
        if bottleFinale != nil {variants.insert("bottle")}
        if honeyFinale != nil {variants.insert("honey")}
        if fishFinale != nil {variants.insert("fish")}
        finaleArtworkOwner?.setSuspended(backgrounded || explicitlySuspended && !exitingBoard)
        finaleArtworkOwner?.retain(variants:variants)
        for variant in variants {finaleArtworkOwner?.prepare(variant:variant)}
    }
    private func finaleArtworkReady(_ variant:String)->Bool {
        guard !disposed,let artwork=selectedFinaleArtwork() else{return false}
        if ["coconut","flower","barell","beach-ball","laser-gun","bloob-ball"].contains(variant) {return tntArtworkReady(variant)}
        if variant=="baloon",finaleArtworkOwner?.baloonResources==nil {return false}
        if variant=="fish" {
            return ["assets/shop/fish/fish-mobile-hevc.mov","assets/shop/fish/bubbly-fast-hevc.mov"].allSatisfy{FileManager.default.fileExists(atPath:resourceRoot.appendingPathComponent($0).path)}
        }
        guard let specs=NativeSelectedUIKitFinaleArtworkOwner.assets(variant) else{return false}
        return specs.allSatisfy{artwork.image($0.path,densityAware:$0.densityAware) != nil}
    }
    private func tntArtworkReady(_ variant:String)->Bool {
        guard !disposed,let artwork=selectedFinaleArtwork() else{return false}
        if variant=="laser-gun" {
            return laserResources.map{NativeLaserGunImpactPresentation.resourcesReady($0)}==true
        }
        guard ["coconut","flower","barell","beach-ball","bloob-ball"].contains(variant),
              let specs=NativeSelectedUIKitFinaleArtworkOwner.assets(variant) else{return false}
        return specs.allSatisfy{artwork.image($0.path,densityAware:$0.densityAware) != nil}
    }

    private func bindFinalMergeProgress(_ owner:NativeFinitePresentation,generation:UInt64) {
        owner.onProgress=boardScene?.finalMergeProgressObserver(generation:generation)
    }
    /// One generation owns one finite reused Arcade clear card. It never
    /// commits a round; the existing terminal receipt remains authoritative.
    private func presentBoardCleared(generation:UInt64) {
        guard !disposed,!backgrounded,engine.state.generation==generation,
              boardClearedGeneration != generation,(engine.state.mode == .journey || engine.state.tutorial?.requiresResultCompletion != true) else{return}
        retireBoardCleared();boardClearedGeneration=generation
        let owner=NativeArcadeRoundPresentation(resourceRoot:resourceRoot,clearedRound:engine.state.stage,
            nextRound:engine.state.stage+1,boardClearedOnly:true)
        boardClearedPresentation=owner;boardClearedSuccessorReady=false
        if engine.state.mode == .journey {owner.permitsBoardClearedExit = {[weak self] in
            guard let self else{return false}
            return self.boardClearedSuccessorReady && (self.preparedJourneyReward?.initialPresentationReady ?? true)
        }}
        owner.frame=view.bounds;owner.autoresizingMask=[.flexibleWidth,.flexibleHeight]
        // Transparent overlay above SpriteKit dice/ghost exits and UIKit finale
        // art. Its stage margins leave the real HUD/footer visible underneath.
        owner.layer.zPosition=1000;view.addSubview(owner)
        owner.onCue = {[weak self] cue in
            guard let self,!self.disposed,self.engine.state.generation==generation else{return}
            if case .thumbWhoosh=cue {self.onRoundWon?(generation)}
            if case .heavyHaptic=cue {self.onHaptic?("heavy")}
        }
        owner.onFinished = {[weak self,weak owner] success in
            guard let self,self.boardClearedPresentation === owner else{return}
            self.boardClearedPresentation=nil
            let pending=self.boardClearedTerminalContinuation;self.boardClearedTerminalContinuation=nil
            if success,!self.disposed,self.engine.state.generation==generation {pending?()}
        }
        boardScene?.beginClearedResidualExit(generation:generation)
        owner.start()
    }
    private func retireBoardCleared() {
        let old=boardClearedPresentation;boardClearedPresentation=nil;boardClearedSuccessorReady=false
        boardClearedTerminalContinuation=nil;old?.onFinished=nil;old?.dispose()
    }

    private func presentTntVariant(_ variant: String,generation: UInt64,onGameplayReady: (() -> Void)?,completion: @escaping () -> Void) -> Bool {
        guard !disposed,engine.state.generation == generation,tntArtworkReady(variant) else { return false }
        let owner: NativeFinitePresentation
        if variant == "beach-ball" {
            let ball = NativeBeachBallPresentation(resourceRoot:resourceRoot,viewport:view.bounds.size,preparedArtwork:selectedFinaleArtwork())
            guard ball.assetsReady else { ball.dispose(); return false }
            ball.onGameplayReady = onGameplayReady; owner = ball
        } else {
            let tnt = NativeTntVariantPresentation(resourceRoot:resourceRoot,variant:variant == "coconut" ? .coconut:variant == "flower" ? .flower:variant == "bloob-ball" ? .bloobGas:.barell,viewport:view.bounds.size,preparedArtwork:selectedFinaleArtwork(),coconutBoardBodySize:boardScene?.coconutFinaleBodySize)
            guard tnt.assetsReady else { tnt.dispose(); return false }
            if variant == "coconut" {tnt.bindScreenShake(to:view)}
            if variant == "bloob-ball" {tnt.bindBoardReaction(boardScene?.makeBloobBoardReaction())}
            tnt.onSprite6Entered = onGameplayReady; owner = tnt
        }
        // These variants share their source TNT/Flower visual owner.
        for key in ["coconut","flower","barell","beach-ball","bloob-ball"] { area55Finales[key]?.dispose() }
        area55Finales[variant] = owner;area55Generations[variant] = generation
        area55SourceOwnerIDs[variant]=engine.pendingDirectWild?.id ?? engine.pendingSpecial?.id ?? engine.pendingSourceLateFinalMerge?.ownerID
        owner.autoresizingMask = [.flexibleWidth,.flexibleHeight];view.addSubview(owner)
        owner.onCue = { [weak self] moment,index in
            guard self?.engine.state.generation == generation else { return }
            self?.onSpecialMoment?(variant,moment,index)
        }
        let sourceKind:NativeSourceFrameRuntime.Kind=variant == "beach-ball" ? .juiceFinale:.tntFinale
        let releaseSource=boardScene?.beginSourceMotion(sourceKind,id:UUID().uuidString,generation:generation)
        owner.onFinished = { [weak self,weak owner] _ in
            releaseSource?()
            if self?.area55Finales[variant] === owner {self?.area55Finales.removeValue(forKey:variant);self?.area55Generations.removeValue(forKey:variant)}
            if let self {self.prepareSelectedFinaleArtwork(self.engine.state)}
            completion()
        }
        bindFinalMergeProgress(owner,generation:generation);owner.start(); return true
    }

    func setSuspended(_ value: Bool) {
        guard !disposed else { return }
        explicitlySuspended = value; applySuspension()
    }

    private func sourceHintModule(scope:NativeGameplaySourceContext.Scope)->NativeEndgameHintCoordinator {
        if endgameHintSourceScope === scope,let retained=endgameHint {return retained}
        endgameHint?.dispose()
        let owner=NativeEndgameHintCoordinator(host:view,root:resourceRoot,service:scope.service,
            current:{[weak self,weak scope] generation in
                guard let self,let scope,!self.disposed else{return false}
                return self.sourceScope === scope && scope.current && self.engine.state.generation==generation &&
                    self.viewIfLoaded?.window != nil && !self.backgrounded && !self.explicitlySuspended && !self.exitingBoard && !self.tutorialSheetPresented
            },random:{[weak scope] in scope?.mathRandom.next() ?? .nan})
        endgameHint=owner;endgameHintSourceScope=scope
        // Literal module initialization; no positive decision or absent flags
        // inferred from Native Core. This allocates no hint art/timer/root.
        owner.update(eligible:false,generation:engine.state.generation)
        return owner
    }
    private var tutorialSheetPresented:Bool {
        viewIfLoaded?.subviews.contains{ $0 is NativeTutorialOverlay && !$0.isHidden } == true
    }
    func tutorialSheetPresentationChanged(){
        if tutorialSheetPresented{endgameHint?.forceClear()}
        updateNativeEndgameHint()
    }
    private func updateNativeEndgameHint() {
        guard !disposed else{return}
        if let scope=sourceScope {
            let owner=sourceHintModule(scope:scope)
            let allowed=viewIfLoaded?.window != nil && !backgrounded && !explicitlySuspended && !exitingBoard && !tutorialSheetPresented &&
                boardScene?.sourceEndgameHintAllowed(scope:scope)==true
            owner.update(eligible:allowed,generation:engine.state.generation)
            return
        }
        // Unbound Native Core keeps its own authority; Source eligibility above
        // comes only from the installed whole caller and actual physical roster.
        let tiles=engine.state.activeTiles
        let allowed=sourceScope==nil && viewIfLoaded?.window != nil && !backgrounded && !explicitlySuspended && !exitingBoard && !tutorialSheetPresented &&
            engine.state.terminal==nil && !engine.flags.busyEnding && !engine.navigationLocked &&
            engine.resolve().kind == .continue && tiles.count>=2 && !tiles.contains(where:{$0.isWild}) &&
            NativeGameplayResolver.anyMergePossible(tiles)
        if allowed,endgameHint==nil {
            endgameHint=NativeEndgameHintCoordinator(host:view,root:resourceRoot,service:.shared,current:{[weak self] generation in
                guard let self,!self.disposed else{return false}
                return self.engine.state.generation==generation && self.viewIfLoaded?.window != nil &&
                    !self.backgrounded && !self.explicitlySuspended && !self.exitingBoard && !self.tutorialSheetPresented
            },preparedCloudImages:{[weak self] in self?.nativeNoMovesUIKit?.preparedOriginalCloudImages})
        }
        endgameHint?.update(eligible:allowed,generation:engine.state.generation)
    }
    private func applySuspension() {
        guard !disposed else { return }
        let value = backgrounded || (explicitlySuspended && !exitingBoard)
        finaleArtworkOwner?.setSuspended(value)
        if !value {prepareSelectedFinaleArtwork(engine.state)}
        if value {endgameHint?.forceClear()}
        boardClearedPresentation?.setSuspended(value)
        nativeNoMovesUIKit?.setSuspended(value)
        boardScene?.setPreservesPausedSpecialVisuals(!backgrounded && explicitlySuspended && !exitingBoard,hardBackgroundPause:backgrounded)
        sourceScope?.update(foreground: !backgrounded, globalPaused: explicitlySuspended && !exitingBoard,
                            terminalSuspended: engine.state.terminal != nil && !exitingBoard)
        boardScene?.setSourceRegularIdleForeground(!backgrounded)
        fishIdleOwner.setSuspended(value,preservingVisiblePose:!backgrounded)
        boardScene?.setSuspended(value,allowHUDFeedback:!backgrounded); fishFinale?.setSuspended(value); bottleFinale?.setSuspended(value); honeyFinale?.setSuspended(value)
        area55Finales.values.forEach { $0.setSuspended(value) }
        journeyBottomDecor?.setForeground(!backgrounded)
        journeyBottomDecor?.setSuspended(backgrounded || explicitlySuspended && !exitingBoard)
        if !backgrounded {startDecorPreparation()}
        if value { onStateChange?(engine.state) }else {updateNativeEndgameHint()}
    }

    /// Called after the engine installs a fresh generation beneath the opaque
    /// transition cover. Only this captured release starts its authored wave.
    func prepareNextBoardEntry() -> (() -> Void)? {
        guard !disposed,hasPresentedScene,let boardScene,preparedBoardEntryGeneration != engine.state.generation else {return nil}
        let generation=engine.state.generation
        preparedBoardEntryGeneration=generation
        firstBoardFrameReady=false
        refreshFromEngine();boardScene.prepareNextBoardEntry()
        var released=false
        return { [weak self,weak boardScene] in
            guard let self,let boardScene,!self.disposed,!released,self.boardScene === boardScene,self.engine.state.generation == generation,self.preparedBoardEntryGeneration == generation else {return}
            released=true;boardScene.releasePreparedBoardEntry(generation:generation)
            if !boardScene.isHUDRevealPending {self.revealJourneyBottomDecor()}
        }
    }

    func refreshFromEngine() {
        prepareSelectedFinaleArtwork(engine.state)
        if sourceNoMovesInstalledGeneration != engine.state.generation {
            retireSourceNoMovesUIKit()
            prepareSourceNoMovesSceneBinding()
        }

        let needsDecorEntry=journeyBottomDecor?.generation != engine.state.generation
        ensureJourneyBottomDecor();startDecorPreparation()
        if needsDecorEntry,hasPresentedScene,preparedBoardEntryGeneration != engine.state.generation {
            let generation=engine.state.generation
            prepareBoardEntryArtwork { [weak self] ready in
                guard let self,!self.disposed,self.engine.state.generation==generation else{return}
                if ready {self.revealJourneyBottomDecor()}else{self.onBoardArtworkFailure?()}
            }
        }
        if let fishGeneration,fishGeneration != engine.state.generation { fishFinale?.dispose() }
        if let bottleGeneration,bottleGeneration != engine.state.generation { bottleFinale?.dispose() }
        if let honeyGeneration,honeyGeneration != engine.state.generation { honeyFinale?.dispose() }
        for (variant,generation) in area55Generations where generation != engine.state.generation { area55Finales[variant]?.dispose() }
        boardScene?.synchronize()
        if sourceEndgameMutationLedgerEnabled,!disposed,let scene=boardScene,let scope=sourceScope,
            !scene.sourceEndgameMutationLedgerAdmissionOpen {
            scene.sourceEndgameMutationLedgerEnabled=true
            if !scene.configureSourceEndgameMutationLedger(scope:scope) {scene.onPresentationFailure?("source_endgame_handoff_ledger_not_bound")}
        }
        boardScene?.evaluate()
    }

    /// Capture/unhook BEFORE any external graph/Scene cleanup callback.
    func retireSourceNoMovesUIKit() {
        let handoff=sourceConfirmedFailHandoff;sourceConfirmedFailHandoff=nil
        let abortFlow=handoff != nil ? engine.sourceNoMovesFinalFlowReceipt:nil
        let owner=sourceNoMovesUIKit,terminal=sourceNoMovesTerminalRegistry
        sourceNoMovesTerminalRegistry=nil;sourceNoMovesUIKit=nil;sourceNoMovesInstalledGeneration=nil;sourceNoMovesUIKitEpoch &+= 1
        if let abortFlow {_ = engine.finishSourceConfirmedFinalFlow(receipt:abortFlow)}
        handoff?.retire()
        if let terminal {_ = boardScene?.retireSourceNoMovesTerminalRegistry(terminal);terminal.retire()}
        else {boardScene?.retireSourceNoMoves()}
        owner?.dispose()
    }

    /// Default Native Core retains its conservative signature/confirmation.
    /// Borrow only the original rendered graph; never enable Source authority.
    private func prepareNativeNoMovesPresentation(){
        guard !disposed,sourceScope==nil,!sourceSmallStackPresentationEnabled,!engine.stagedSourceNoMoves,
            let scene=boardScene,nativeNoMovesUIKit==nil else{return}
        let owner=NativeSourceNoMovesUIKitCoordinator(host:view,root:resourceRoot,service:.shared,
            current:{[weak self,weak scene] gen in
                guard let self,let scene else{return false}
                return !self.disposed && self.sourceScope==nil && !self.engine.stagedSourceNoMoves &&
                    self.boardScene === scene && self.engine.state.generation==gen
            },random:{Double.random(in:0..<1)},fallback:{[weak scene] gen,callback in
                scene?.scheduleSourceNoMovesExitFallback(generation:gen,elapsed:callback) ?? {}
            },onVisibleShow:{[weak scene] gen,receipt in scene?.nativeNoMovesVisibleShow(generation:gen,receipt:receipt)})
        nativeNoMovesUIKit=owner
        owner.setSuspended(backgrounded || explicitlySuspended && !exitingBoard)
        scene.onNativeNoMovesShow={ [weak self,weak owner] gen,receipt in
            guard let self,let owner,!self.disposed,self.nativeNoMovesUIKit === owner,self.sourceScope==nil else{return false}
            self.endgameHint?.reset()
            return owner.show(generation:gen,receipt:receipt)
        }
        scene.onNativeNoMovesExit={ [weak owner] gen,reply in
            guard let owner else{reply();return}
            owner.beginExit(generation:gen){_ in reply()}
        }
        scene.onNativeNoMovesClear={ [weak owner] in owner?.clear() }
        owner.prepare{_ in} // Selected original resources, once per live VC.
    }

    /// Complete actual Source NO MOVES assembly: original UIKit resources first,
    /// captured runtime authority, eight ordinary/depleted callers, level caller.
    func sourceEntryDiagnostic()->String {
        "presented=\(hasPresentedScene);frame=\(firstBoardFrameReady);admissionRequested=\(sourceGameplayAdmissionRequested);admissionAccepted=\(sourceGameplayAdmissionAccepted);initialGate=\(initialEntryGateReleased);initialEntry=\(beforeInitialBoardEntry != nil);beforeReveal=\(beforeSourceInitialBoardReveal != nil);disposed=\(disposed);viewWindow=\(view.window != nil);spriteWindow=\(spriteView.window != nil)"
    }
    func configureSourceCompleteNoMoves(scope:NativeGameplaySourceContext.Scope,persistStuckState:@escaping()->Void,
        visibleShowCue:@escaping(UInt64,UInt64)->Void,completion:@escaping(Bool)->Void) {
        guard !disposed,sourceScope === scope,scope.current,let scene=boardScene,
            let bindings=scene.makeSourceCompleteNoMovesBindings(scope:scope,persist:persistStuckState,visibleCue:visibleShowCue) else{completion(false);return}
        sourceNoMovesPresentationEnabled=true;scene.sourceNoMovesPresentationEnabled=true
        scene.sourceNoMovesRuntimeAuthorityEnabled=true;engine.stagedSourceNoMoves=true
        sourceNoMovesBindings=bindings
        prepareSourceNoMovesSceneBinding{[weak self,weak scene,weak scope] ready in
            guard let self,let scene,let scope,ready,!self.disposed,self.boardScene === scene,self.sourceScope === scope,scope.current else{completion(false);return}
            completion(scene.configureSourceCompleteNoMovesCallers(scope:scope))
        }
    }

    /// Selected original artwork prep is bounded and separate from the candidate
    /// wait. No candidate is enabled until this actual preparation completes.
    func prepareSourceNoMovesSceneBinding(completion:((Bool)->Void)?=nil) {
        guard sourceNoMovesPresentationEnabled,engine.stagedSourceNoMoves,
            !disposed,let scene=boardScene,let scope=sourceScope,scope.current,
            let bindings=sourceNoMovesBindings else {completion?(false);return}
        let generation=engine.state.generation,epoch=sourceNoMovesUIKitEpoch
        let hints=sourceHintModule(scope:scope)
        var ownedBindings=bindings
        ownedBindings.resetHint={ [weak self,weak scope,weak hints] in
            guard let self,let scope,let hints,!self.disposed,self.sourceScope === scope,scope.current,
                self.engine.state.generation==generation,self.endgameHint === hints else{return}
            hints.reset()
            guard !self.disposed,self.sourceScope === scope,scope.current,self.engine.state.generation==generation,
                self.endgameHint === hints else{return}
            bindings.resetHint()
        }
        if sourceNoMovesInstalledGeneration==generation {completion?(true);return}
        let owner:NativeSourceNoMovesUIKitCoordinator
        if let retained=sourceNoMovesUIKit {owner=retained}
        else {
            owner=NativeSourceNoMovesUIKitCoordinator(host:view,root:resourceRoot,service:scope.service,
                current:{[weak self,weak scope,weak scene] gen in
                    guard let self,let scope,let scene else{return false}
                    return !self.disposed && scope.current && self.sourceScope === scope &&
                        self.boardScene === scene && self.engine.state.generation==gen
                },random:{[session=scope.smokeSession] in session.nextVisualRandom()},
                fallback:{[weak scene] gen,callback in
                    scene?.scheduleSourceNoMovesExitFallback(generation:gen,elapsed:callback) ?? {}
                },onVisibleShow:bindings.visibleShowCue)
            sourceNoMovesUIKit=owner
        }
        owner.prepare { [weak self,weak owner,weak scene,weak scope] ready in
            guard let self,let owner,let scene,let scope,!self.disposed,
                self.sourceNoMovesUIKit === owner,self.boardScene === scene,self.sourceScope === scope,
                scope.current,self.engine.state.generation==generation,self.sourceNoMovesUIKitEpoch==epoch else {completion?(false);return}
            guard ready else {completion?(false);return}
            if self.sourceNoMovesInstalledGeneration==generation {completion?(true);return}
            scene.sourceNoMovesPresentationEnabled=self.sourceNoMovesPresentationEnabled
            let terminal=NativeSourceNoMovesTerminalRegistryEndpoint(scope:scope.registries,engine:self.engine)
            let installed=scene.configureSourceNoMoves(bindings:ownedBindings,
                showText:{[weak owner,weak scene] plan,gen in
                    _=owner?.show(generation:gen,receipt:plan.token)
                    scene?.traceNoMovesHandoff("text-show",token:plan.token,owner:owner?.presentation,mounted:owner?.presentation?.superview != nil)
                },
                beginTextExit:{[weak owner,weak scene] gen,reply in
                    guard let owner else{reply(false);return}
                    let presentation=owner.presentation
                    scene?.traceNoMovesHandoff("text-exit-begin",owner:presentation,mounted:presentation?.superview != nil)
                    owner.beginExit(generation:gen,completion:{[weak presentation,weak scene] success in
                        scene?.traceNoMovesHandoff(success ? "text-exit-complete":"text-exit-rejected",owner:presentation,mounted:presentation?.superview != nil)
                        reply(success)
                    })
                },clearText:{[weak owner,weak scene] in
                    scene?.traceNoMovesHandoff("text-clear",owner:owner?.presentation,mounted:owner?.presentation?.superview != nil)
                    owner?.clear()
                },
                confirmedBoardExit:{[weak self,weak scene] gen,reply in
                    guard let self,let scene,!self.disposed,self.boardScene === scene,
                        self.engine.state.generation==gen else{reply(false);return}
                    self.beginSourceConfirmedFailBoardExit(generation:gen,completion:reply)
                },terminalRegistry:terminal,callerInvocationReceiptBound:true)
            guard !self.disposed,self.sourceNoMovesUIKitEpoch==epoch,self.sourceNoMovesUIKit === owner,
                self.boardScene === scene,self.sourceScope === scope,scope.current,
                self.engine.state.generation==generation else {_ = scene.retireSourceNoMovesTerminalRegistry(terminal);terminal.retire();completion?(false);return}
            guard installed,scene.confirmSourceNoMovesTerminalRegistry(terminal) else{_ = scene.retireSourceNoMovesTerminalRegistry(terminal);terminal.retire();completion?(false);return}
            guard !self.disposed,self.sourceNoMovesUIKitEpoch==epoch,self.sourceNoMovesUIKit === owner,
                self.boardScene === scene,self.sourceScope === scope,scope.current,
                self.engine.state.generation==generation else{_ = scene.retireSourceNoMovesTerminalRegistry(terminal);terminal.retire();completion?(false);return}
            self.sourceNoMovesTerminalRegistry=terminal;self.sourceNoMovesInstalledGeneration=generation
            completion?(true)
        }
    }

    /// Source showFinalScreen confirmed branch, before actual board-exit receipt.
    func beginSourceConfirmedFailBoardExit(generation:UInt64,completion:@escaping(Bool)->Void) {
        guard !disposed,sourceNoMovesPresentationEnabled,let scene=boardScene,
            let endpoint=sourceNoMovesTerminalRegistry,endpoint.current,
            let plan=engine.pendingSourceNoMoves,let flow=engine.sourceNoMovesFinalFlowReceipt,flow.generation==generation,flow.planToken==plan.token,engine.state.generation==generation,
            let scope=sourceScope,scope.current,sourceConfirmedFailHandoff==nil else{completion(false);return}
        let epoch=sourceNoMovesUIKitEpoch
        scene.traceNoMovesHandoff("confirmed-fail-clear",token:plan.token,owner:sourceNoMovesUIKit?.presentation,mounted:sourceNoMovesUIKit?.presentation?.superview != nil)
        sourceNoMovesUIKit?.clear() // literal showFinalScreen before wall wait
        guard !disposed,sourceNoMovesUIKitEpoch==epoch,boardScene === scene,sourceNoMovesTerminalRegistry === endpoint,scope.current,engine.state.generation==generation else{completion(false);return}
        let owner=NativeSourceConfirmedFailHandoff(wait:{[weak scene] gen,ms,elapsed,cancelled in
            guard let scene else{cancelled();return {}}
            return scene.scheduleSourceConfirmedFailWait(generation:gen,milliseconds:ms,elapsed:elapsed,cancelled:cancelled)
        })
        sourceConfirmedFailHandoff=owner
        let launched=owner.begin(generation:generation,planToken:plan.token,isArcade:engine.state.mode == .arcade,
            current:{[weak self,weak scene,weak endpoint,weak scope,weak owner] in
                guard let self,let scene,let endpoint,let scope,let owner,!self.disposed,
                    self.boardScene === scene,self.sourceScope === scope,scope.current,
                    self.sourceNoMovesUIKitEpoch==epoch,self.sourceNoMovesTerminalRegistry === endpoint,
                    self.sourceConfirmedFailHandoff === owner,self.engine.state.generation==generation,
                    self.engine.pendingSourceNoMoves==plan,scene.sourceAnimationBindingAdmissionOpen else{return false}
                return endpoint.current && !self.disposed && self.sourceConfirmedFailHandoff === owner && self.sourceNoMovesUIKitEpoch==epoch
            },cleanup:{[weak scene] in scene?.cleanupSourceConfirmedFailHUDStars(plan:plan,generation:generation) == true},
            completion:{[weak self,weak owner] ready in
                guard let self,let owner,self.sourceConfirmedFailHandoff === owner else{completion(false);return}
                self.sourceConfirmedFailHandoff=nil
                guard ready,!self.disposed,self.sourceNoMovesUIKitEpoch==epoch,self.engine.state.generation==generation else{
                    _=endpoint.actualConfirmedFlowCleanup(receipt:flow)
                    completion(false);return
                }
                self.animateBoardExit(completion:completion)
            })
        // Literal runNoMovesFailFlow calls showFinalScreen without awaiting its
        // wall40/60 or eventual modal. Only this accepted real owner launch can
        // complete a captured caller; Scene queues the genuine Promise reaction.
        if launched,!disposed,sourceConfirmedFailHandoff === owner,sourceNoMovesUIKitEpoch==epoch,
            boardScene === scene,sourceScope === scope,engine.state.generation==generation {
            _=scene.sourceNoMovesConfirmedCallerInvocation(planToken:plan.token,generation:generation)
        }
    }
    /// Bind only the captured final-modal coroutine. Its action/abort cleanup is
    /// BEFORE route replacement; merely completing board exit retains the key.
    func sourceConfirmedFailFinalCleanup(receipt:NativeSourceNoMovesCompletedReceipt,endpoint:NativeSourceNoMovesTerminalRegistryEndpoint)->Bool {
        guard engine.completedSourceNoMovesReceipt==receipt,engine.state.generation==receipt.generation else{return false}
        if !disposed,let active=sourceNoMovesTerminalRegistry,active !== endpoint {return false}
        if !disposed,sourceNoMovesTerminalRegistry === endpoint,endpoint.current {return endpoint.actualFinalCleanup(receipt:receipt)}
        // Genuine modal-abort finally after captured Scene/scope retirement:
        // its registry lease already unhooked; Core still seals the old flow.
        return engine.finishSourceNoMovesFinalCleanup(receipt:receipt)
    }
    func animateBoardExit(finalMerge:Bool=false,completion: @escaping (Bool) -> Void) {
        guard let boardScene,!disposed,!exitingBoard else {completion(false);return}
        if let plan=engine.pendingSourceNoMoves {boardScene.traceNoMovesHandoff("board-exit-begin",token:plan.token)}
        exitingBoard=true
        applySuspension()
        journeyBottomDecor?.setSuspended(backgrounded)
        // Journey retires HUD/footer after residual ghosts, before its opaque reward screen.
        // Arcade automatic round continuation retains its already settled chrome.
        let keepsChromeVisible=finalMerge && engine.state.mode == .arcade
        var remaining=keepsChromeVisible || journeyBottomDecor == nil ? 1:2,finished=false
        let generation=engine.state.generation
        let settled:(Bool)->Void = { [weak self] success in
            guard !finished else{return}
            guard let self,!self.disposed,self.engine.state.generation==generation,success else {
                finished=true;self?.exitingBoard=false;completion(false);return
            }
            remaining -= 1
            if remaining==0 {
                finished=true;self.exitingBoard=false
                if let plan=self.engine.pendingSourceNoMoves {self.boardScene?.traceNoMovesHandoff("board-exit-complete",token:plan.token)}
                completion(true)
            }
        }
        if keepsChromeVisible {
            boardScene.animateExit(keepsHUDVisible:true,completion:settled)
        } else if finalMerge {
            boardScene.animateExit(afterResidualExit:{ [weak self] in
                self?.journeyBottomDecor?.exit(completion:settled)
            },hudExitDelay:{[weak self] in
                guard let clear=self?.boardClearedPresentation else{return 0}
                // First CLEARED/PNG paint is at thumbEnterStart. Retain chrome
                // for one further second, overlapping all existing residual work.
                return max(0,clear.thumbEnterStart+1-clear.elapsed)
            },completion:settled)
        } else {
            journeyBottomDecor?.exit(completion:settled)
            boardScene.animateExit(completion:settled)
        }
    }

    /// Preparation runs while the themed carrier is moving. Its opaque cover
    /// remains until the selected original footer is ready for the HUD entry.
    func prepareBoardEntryArtwork(completion:@escaping(Bool)->Void) {
        guard !disposed else{completion(false);return}
        loadViewIfNeeded();ensureJourneyBottomDecor()
        guard let owner=journeyBottomDecor else{completion(true);return}
        if owner.isPrepared,!backgrounded,owner.isForeground {completion(true);return}
        decorWaiters.append((engine.state.generation,completion));startDecorPreparation()
    }
    private func ensureJourneyBottomDecor() {
        guard !disposed,isViewLoaded,engine.state.tutorial?.shouldLockHUD != true,engine.state.mode == .journey,let catalog=journeyDecorCatalog else{return}
        let generation=engine.state.generation
        if journeyBottomDecor?.generation == generation {return}
        let old=journeyBottomDecor;journeyBottomDecor=nil;decorPreparing=false
        let cancelled=decorWaiters;decorWaiters.removeAll();old?.dispose();cancelled.forEach{$0.1(false)}
        let owner=NativeJourneyBottomDecorOwner(root:resourceRoot,board:engine.state.board,viewport:view.bounds.size,generation:generation,isCurrent:{[weak self] in
            self?.disposed == false && self?.engine.state.generation == $0
        },catalog:catalog,resources:journeyDecorResources?(resourceRoot),isApplicationActive:{[weak self] in self?.backgrounded == false})
        journeyBottomDecor=owner;owner.autoresizingMask=[.flexibleWidth,.flexibleHeight]
        view.insertSubview(owner,aboveSubview:paperSurface)
        owner.setSuspended(explicitlySuspended && !exitingBoard)
    }
    private func revealJourneyBottomDecor() {
        if keepsGameplayChromeVisibleOnEntry {journeyBottomDecor?.showSettled()}
        else {journeyBottomDecor?.enter()}
    }
    private func startDecorPreparation() {
        guard !disposed,!backgrounded,!decorPreparing,let owner=journeyBottomDecor else{return}
        let generation=owner.generation
        decorPreparing=true
        owner.prepare { [weak self,weak owner] ready in
            guard let self,let owner,!self.disposed,self.journeyBottomDecor === owner,self.engine.state.generation==generation else{return}
            self.decorPreparing=false
            // Background cancellation retains the cover and retries on resume.
            guard !self.backgrounded,owner.isForeground else{return}
            let replies=self.decorWaiters;self.decorWaiters.removeAll()
            replies.forEach{$0.1(ready && $0.0==generation && !self.disposed && self.engine.state.generation==generation)}
        }
    }

    func dispose() {
        retirePreparedJourneyReward();retirePreparedJourneyResult();retireJourneyRewardChildren();prepareJourneyRewardController=nil;prepareJourneyResultController=nil
        restoreTutorialSpecialBarSiblings()
        beforeSourceInitialBoardReveal=nil
        beforeSourceGameplayAdmission=nil
        guard !disposed else { return }
        incomingOriginalCoverCompletion=nil;incomingOriginalCoverGeneration=nil
        disposed = true;retireBoardCleared();onJourneyDieLanded=nil;unreadJourneyDice={[]};nativeNoMovesUIKit?.dispose();nativeNoMovesUIKit=nil;endgameHint?.dispose();endgameHint=nil;endgameHintSourceScope=nil;firstBoardFrameWaiters.removeAll();beforeInitialBoardEntry = nil
        sourceDirectHUDPrepared=nil
        finaleArtworkOwner?.dispose();finaleArtworkOwner=nil
        retireSourceNoMovesUIKit();sourceNoMovesBindings=nil

        let replies=decorWaiters;decorWaiters.removeAll();decorPreparing=false
        journeyBottomDecor?.dispose();journeyBottomDecor=nil;journeyDecorResources=nil;journeyDecorCatalog=nil;onBoardArtworkFailure=nil;onSourcePresentationFailure=nil
        replies.forEach{$0.1(false)}
        observations.forEach(NotificationCenter.default.removeObserver); observations.removeAll()
        fishIdleOwner.dispose()
        fishFinale?.dispose(); fishFinale = nil; fishGeneration = nil
        bottleFinale?.dispose(); bottleFinale = nil; bottleGeneration = nil
        honeyFinale?.dispose(); honeyFinale = nil; honeyGeneration = nil
        Array(area55Finales.values).forEach { $0.dispose() }; area55Finales.removeAll(); area55Generations.removeAll();area55SourceOwnerIDs.removeAll()
        sourceScope?.dispose(); sourceScope = nil; sourceContext = nil
        boardScene?.dispose(); boardScene = nil;
        sourceTntGlyphScopes.removeAll();sourceTntGlyphOwnerIDs.removeAll();tntGlyphs.values.forEach { $0.removeFromSuperview() }; tntGlyphs.removeAll(); spriteView.presentGameplayScene(nil); spriteView.surfacePaused = true
        onSourceGuidedSnapBack=nil;onSourceTutorialRetired=nil;onSourceTutorialPrepared=nil
        onSourceBoardEntrySound=nil;onSourceBoardEntryCompleted=nil
        onExit = nil; onStateChange = nil; onRoundWon=nil; onTerminal = nil; onGameplayEvent = nil; onHUDTapContact=nil; onHelp = nil; onScore = nil; onCombo = nil; onPointerState = nil; onHaptic = nil; onBoardEntry = nil; onBoardExit = nil; onGameplayReceipt = nil; onSpecialMoment = nil; onHUDCoinArrival = nil; onSpecialFadeCapture = nil
    }
}

/// One selected/restored UIKit finale bitmap owner per gameplay generation.
/// It has no clock/input/gameplay lease. Presentation borrows this same artwork;
/// queued raster work is serial, coalesced, and retired with the generation.
@MainActor final class NativeSelectedUIKitFinaleArtworkOwner {
    struct Asset:Equatable {let path:String;let densityAware:Bool}
    let generation:UInt64,artwork:JimiV9Artwork
    private let current:()->Bool
    private let root:URL
    private(set) var baloonResources:NativeBaloonResources?
    private(set) var laserResources:NativeLaserGunResources?
    private var laserTask:Task<Void,Never>?
    private var laserEpoch=0,laserImagesReady=false
    private var baloonTask:Task<Void,Never>?
    private var baloonEpoch=0
    private var disposed=false,suspended=false
    private(set) var selected:Set<String>=[]
    private(set) var pendingFamilies:Set<String>=[]
    private(set) var readyFamilies:Set<String>=[]
    init(root:URL,generation:UInt64,current:@escaping()->Bool) {
        self.generation=generation;self.current=current;self.root=root;artwork=JimiV9Artwork(resourceRoot:root)
        // Plain Star/juice also borrow the generation font before their first paint.
        _=artwork.font(size:32,weight:"ExtraBold")
    }
    static func assets(_ variant:String)->[Asset]? {
        let paths:[String]
        switch variant {
        case "coconut":paths=NativeTntVariantPresentation.assets(.coconut).map{$0.replacingOccurrences(of:"@2x.png",with:".png")}
        case "flower":paths=NativeTntVariantPresentation.assets(.flower).map{$0.replacingOccurrences(of:"@2x.png",with:".png")}
        case "barell":paths=NativeTntVariantPresentation.assets(.barell).map{$0.replacingOccurrences(of:"@2x.png",with:".png")}
        case "beach-ball":paths=NativeBeachBallPresentation.assets
        case "kanta":paths=["assets/journey assets/robo/robo1.png","assets/journey assets/robo/robo frontalni.png"]+["01","03","04","kante-ljevo","kante-sredina","kante-desno"].map{"assets/shop/kanta/\($0).png"}
        case "mushroom":paths=NativeMushroomFinalePresentation.assets
        case "robo-cube":paths=NativeRoboFinalePresentation.assets
        case "baloon":paths=NativeBaloonFinalePresentation.assets
        case "cubero":paths=(1...7).map{"assets/shop/cubero/krpa\($0).png"}
        case "bloob-ball":paths=NativeTntVariantPresentation.assets(.bloobGas).map{$0.replacingOccurrences(of:"@2x.png",with:".png")}
        case "bloob":paths=NativeBloobFinalePresentation.assets
        case "kite":paths=NativeKiteArt.assets
        case "bee":paths=(1...4).map{"assets/shop/bee/bee\($0).png"}+(1...6).map{"assets/shop/bee/leaf\($0).png"}+["assets/shop/honey/bee1.png","assets/shop/honey/bee3.png"]
        case "honey":paths=(1...7).map{"assets/shop/honey/bee\($0).png"}
        case "bottle":paths=NativeBottleFinaleMotion.layers.map{"assets/shop/bottle/bottle animation pack/\($0.asset).png"}+(1...6).map{"assets/shop/bottle/bottle animation pack/bubble\($0).png"}
        case "laser-gun":paths=(1...6).map{"assets/shop/gun/lasergun\($0)@2x.png"}+["assets/shop/gun/left laser@2x.png","assets/shop/gun/right laser@2x.png"]
        case "spaceship":paths=(1...4).map{"assets/shop/spaceship/saucer\($0)@2x.png"}+["assets/shop/spaceship/leftbeam@2x.png","assets/shop/spaceship/rightbeam@2x.png","assets/tile@2x.png"]+NativeArea55Motion.debris.compactMap(\.source)
        case "fish":paths=[] // Existing AVPlayer owner retains exact HEVC lifecycle.
        default:return nil
        }
        // Authored explicit @2x callers keep their scale1 UIImage semantics;
        // density-aware callers keep the same canonical high-density selector.
        return paths.map{Asset(path:$0,densityAware:variant != "spaceship" && variant != "laser-gun" && variant != "bloob")}
    }
    private func prepareBaloon() {
        guard !disposed,!suspended,current(),baloonResources==nil,baloonTask==nil else{return}
        let root=root,epoch=baloonEpoch
        baloonTask=Task { [weak self] in
            let worker=Task.detached(priority:.utility){try NativeBaloonResources.load(root:root)}
            let result=await withTaskCancellationHandler(operation:{await worker.result},onCancel:{worker.cancel()})
            guard let self else{return}
            self.baloonTask=nil // retain the slot until an ImageIO drain really ends.
            guard !self.disposed,!self.suspended,self.current(),self.selected.contains("baloon") else{return}
            guard self.baloonEpoch==epoch else{self.prepareBaloon();return}
            if case .success(let resources)=result {self.baloonResources=resources}
        }
    }
    private func prepareLaser() {
        guard !disposed,!suspended,current(),laserImagesReady,selected.contains("laser-gun"),
              laserResources==nil,laserTask==nil,
              let left=artwork.image("assets/shop/gun/left laser@2x.png")?.cgImage,
              let right=artwork.image("assets/shop/gun/right laser@2x.png")?.cgImage else{return}
        let frames=(1...6).compactMap{artwork.image("assets/shop/gun/lasergun\($0)@2x.png")}
        guard frames.count==6 else{return}
        let pixels=NativeLaserGunResources.BeamPixels(left:left,right:right),epoch=laserEpoch
        laserTask=Task { [weak self] in
            // Original images are already materialized on the selected raster
            // queue. The two finite Core Image glow renders must not block input.
            let worker=Task.detached(priority:.utility){try pixels.prepare()}
            let result=await withTaskCancellationHandler(operation:{await worker.result},onCancel:{worker.cancel()})
            guard let self else{return}
            self.laserTask=nil // one in-flight filter drains before a replacement.
            guard !self.disposed,!self.suspended,self.current(),self.selected.contains("laser-gun") else{return}
            guard self.laserEpoch==epoch else{self.prepareLaser();return}
            self.pendingFamilies.remove("laser-gun")
            if case .success(let beams)=result {
                self.laserResources=NativeLaserGunResources(artwork:self.artwork,frames:frames,leftBeam:beams.left,rightBeam:beams.right)
                self.readyFamilies.insert("laser-gun")
            } else {self.selected.remove("laser-gun")}
        }
    }
    func prepare(variant:String) {
        if variant=="baloon" {prepareBaloon()}
        if variant=="laser-gun" {prepareLaser()}
        guard !disposed,!suspended,current(),!selected.contains(variant),let specs=Self.assets(variant) else{return}
        selected.insert(variant);pendingFamilies.insert(variant)
        _=artwork.font(size:32,weight:"ExtraBold")
        if specs.isEmpty {pendingFamilies.remove(variant);readyFamilies.insert(variant);return}
        var remaining=specs.count,failed=false
        for spec in specs {
            artwork.prepareImage(spec.path,densityAware:spec.densityAware){[weak self] image in
                guard let self,!self.disposed,self.current() else{return}
                remaining-=1;failed = failed || image==nil
                if remaining==0 {
                    if variant=="laser-gun",!failed {
                        self.laserImagesReady=true;self.prepareLaser();return
                    }
                    self.pendingFamilies.remove(variant)
                    if !failed {self.readyFamilies.insert(variant)}
                    else {self.selected.remove(variant)} // genuine missing asset may retry.
                }
            }
        }
    }
    func setSuspended(_ value:Bool) {
        guard !disposed,suspended != value else{return};suspended=value
        if value {
            baloonEpoch+=1;baloonTask?.cancel()
            laserEpoch+=1;laserTask?.cancel()
            selected.subtract(pendingFamilies);pendingFamilies.removeAll()
            artwork.cancelPendingImagePreparation()
        }
    }
    func retain(variants:Set<String>) {
        guard !disposed,current() else{return}
        if !variants.contains("baloon") {baloonEpoch+=1;baloonTask?.cancel();baloonResources=nil}
        if !variants.contains("laser-gun") {laserEpoch+=1;laserTask?.cancel();laserResources=nil;laserImagesReady=false}
        selected.formIntersection(variants);pendingFamilies.formIntersection(variants);readyFamilies.formIntersection(variants)
        let specs=variants.flatMap{Self.assets($0) ?? []}
        artwork.retainPreparedImages(specs.map{($0.path,$0.densityAware)})
    }
    func dispose() {
        guard !disposed else{return};disposed=true
        baloonEpoch+=1;baloonTask?.cancel();baloonResources=nil
        laserEpoch+=1;laserTask?.cancel();laserResources=nil;laserImagesReady=false
        selected.removeAll();pendingFamilies.removeAll();readyFamilies.removeAll()
        artwork.retireImagePreparation()
    }
}
