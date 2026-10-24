import UIKit
import StackToSixGameplay
import StackToSixNativeState

/// The accepted restart action owns announcement admission, independently of
/// the selected Journey world/Unit or Arcade round.
enum NativeGameplayRestartOrigin:Equatable {
    case exitMenu,result,failPlayAgain
    var skipsBoardAnnouncement:Bool {
        switch self {
        case .exitMenu:return !NativeJourneyTransitionAdmission.requiresTransition(entry:.endRunRestart,tutorial:false)
        case .result:return true
        case .failPlayAgain:return !NativeJourneyTransitionAdmission.requiresTransition(entry:.failureRetry,tutorial:false)
        }
    }
}

/// Owns the native profile and connects Swift services to the native surfaces.
/// The migration exporter is retired before any gameplay route is admitted.
@MainActor
final class NativeBootstrap {
    private let ownsSourceContext: Bool
    private let root: URL
    private let showStudioIntro:Bool
    private let store: NativeSaveStore
    private let layouts: NativeWorldLayouts
    private var envelope = NativeSaveEnvelope()
    private var exporter: NativeHybridExport?
    private var soundtrack: NativeSoundtrackRouteOwner?
    private var arcadeMusic: NativeArcadeMusicOwner?
    private var audio: NativeGameplayAudioOwner?
    private var audioReceipt: UInt64 = 0
    private var ambient: NativeJourneyAmbientOwner?
    private var routeLease: UInt64 = 0
    private var currentAmbientRoute:NativeJourneyAmbientOwner.Route = .none
    private var backpackPreservesAudio=false
    private var endRun: NativeEndRunOwner?
    private(set) var sourceFailureModal:JimiNativeEndRunModal?
    private var sourceFailureModalEpoch=0
    private var sourceFailureObservers:[NSObjectProtocol]=[]
    private var scoreOwner:NativeScoreOwner?
    private var tutorialOwner:NativeTutorialOwner?
    private weak var gameplay: NativeGameplayViewController?
    private weak var host: UIViewController?
    private var controller: NativeAppController?
    /// Existing route receipt, sampled only by explicitly enabled diagnostics.
    var diagnosticRoute:String {controller.map{String(describing:$0.route)} ?? "unmounted"}
    private var returnAction: (() -> Void)?
    private var resultOwner: NativeResultOwner?
    private var lastReturnBoard: Int?
    private var attemptCommitted = false
    private var interimJourney=false
    private var committedScore:Int?
    private var boardEntryHaptics:NativeBoardEntryHaptics?
    private lazy var haptics=NativeHapticRuntime(enabled:{[weak self] in self?.disposed==false && self?.envelope.settings.hapticsEnabled==true})
    var hapticOutputObserver:((NativeHapticRuntime.Output)->Void)? {get {haptics.onOutput} set {haptics.onOutput=newValue}}
    private var failHapticGeneration:UInt64?
    private var ordinarySixHapticContact:String?
    private var specialHapticTargetCounts:[String:Int]=[:]

    private var tutorialComplete:NativeTutorialCompleteController?
    private var arcadeEntryCue:NativeArcadeRoundPresentation?
    private var boardTransition:NativeThemedBoardTransitionController?
    private var sourceBoardTransitionClaim:(scope:NativeGameplaySourceContext.Scope,claim:NativeSourceBoardTransitionState.Claim)?
    private let transitionVariation=NativeThemedTransitionVariationOwner()
    private let journeyBottomDecorCatalog=NativeJourneyBottomDecorCatalog()
    private let sourceContext:NativeGameplaySourceContext
    // Bounded fresh-start caller only. Restart/resume/full Source mode remain off.
    var sourceTutorialActivationEnabled=false
    var sourceTutorialIntroEnabled=false
    var sourceTutorialSubsequentPresentationEnabled=false
    var sourceTutorialFirstStepMonitorEnabled=false
    var sourceTutorialHUDEnabled=false
    var sourceTutorialEarnedMeterEnabled=false
    var sourceOrdinaryPresentationEnabled=false
    var sourceDirectPresentationEnabled=false
    var sourceMagnetPresentationEnabled=false
    var sourceOrdinaryEndgamePresentationEnabled=false
    var sourceTntPresentationEnabled=false
    var sourceFreshOrdinaryPresentationEnabled=false
    var sourceRestoredOrdinaryPresentationEnabled=false
    private var sourceTutorialMeterResources:NativeWildMeterDropResources?
    private var sourceTutorialMeterRequest:NativeWildMeterDropResources.Request?
    private var sourceTutorialHUDStarRequest:NativeSourceHUDStarTexturePreparation.Request?
    private var sourceTutorialMeterEpoch:UInt64=0
    var sourceBoardEntryEnabled=false
    var sourceSpecialIdlePresentationEnabled=false
    var sourceWildShimmerPresentationEnabled=false
    var sourceInitialFreshStartupEnabled=false
    var sourceInitialRegularResumeEnabled=false
    var sourceInitialWildResumeEnabled=false
    var sourceLogicalMathRandomEnabled=false
    var sourceCanonicalGameplaySaveEnabled=false
    var completeNativeGameplayEnabled=false
    private var sourceCanonicalSaveBinding:NativeSourceCanonicalSaveOwner<NativeBoardState>.Binding?
    private var sourceCanonicalSaveEpoch:UInt64=0
    private var sourcePreparedArcadeSaveGeneration:UInt64?
    @MainActor private final class InitialTexturePreparation {
        let board:Int?,number:Int,tutorial:Bool,saved:NativeBoardState?,textures:NativeBoardTextures
        let freshEntry:FreshGameplayEntry?,callerCurrent:()->Bool
        var ready=false
        init(board:Int?,number:Int,tutorial:Bool,saved:NativeBoardState?,textures:NativeBoardTextures,
             freshEntry:FreshGameplayEntry?,callerCurrent:@escaping()->Bool){
            self.board=board;self.number=number;self.tutorial=tutorial;self.saved=saved;self.textures=textures
            self.freshEntry=freshEntry;self.callerCurrent=callerCurrent
        }
    }
    private var initialTexturePreparation:InitialTexturePreparation?
    private let errorLabel = UILabel()
    private var disposed = false

    init(root: URL, store: NativeSaveStore? = nil,showStudioIntro:Bool=true,sourceContext:NativeGameplaySourceContext?=nil, ownsSourceContext:Bool=true) throws {
        self.ownsSourceContext=ownsSourceContext
        self.showStudioIntro=showStudioIntro;self.sourceContext=sourceContext ?? NativeGameplaySourceContext()
        self.root = root
        self.store = try store ?? NativeSaveStore.applicationStore()
        layouts = try NativeWorldLayouts()
    }
    func start(in host: UIViewController) {
        self.host = host
        do {
            if let saved = try store.load() {envelope=saved}
            else {envelope=NativeSaveEnvelope();try store.save(envelope)}
            mount(in: host)
        } catch NativeSaveError.requiresLegacyImport {
            showError("Preparing your Native save…")
            let exporter = NativeHybridExport(libraryRoot:store.legacyImportLibraryRoot); self.exporter = exporter
            exporter.importInto(store) { [weak self, weak host] result in
                guard let self, let host,!self.disposed else { return }
                self.exporter = nil
                switch result {
                case .success(let value): self.envelope = value; self.mount(in: host)
                case .failure(let error): self.showError(error.localizedDescription)
                }
            }
        } catch { showError(error.localizedDescription) }
    }
    private func mount(in host: UIViewController) {
        envelope.discardUntouchedLayouts()
        errorLabel.removeFromSuperview()
        var services = NativeAppServices(
            settings: { [weak self] in self?.settings() ?? [:] },
            setPreference: { [weak self] key, value in try self?.setPreference(key, value) },
            worldSnapshot: { [weak self] world, size, generation in
                guard let self else { throw CancellationError() }
                return try self.layouts.snapshot(world: world, width: size.width, height: size.height,
                    generation: generation, progression: self.envelope.progression,
                    resumableBoards: Set(self.envelope.journeyRuns.keys.filter {
                        self.envelope.resumedRun(mode: .journey, board: $0) != nil
                    }), returnBoard: self.lastReturnBoard)
            },
            markViewed: { [weak self] board in
                guard let self else { return }
                self.envelope.progression.markViewed(board: board); try self.flush()
            },
            makeGameplay: { [weak self] board, exit in
                guard let self else { throw CancellationError() }
                return try self.makeGameplay(board: board, exit: exit)
            },
            flush: { [weak self] in try self?.flush() })
        services.selectArcadeVariant = {[weak self] variant in
            guard let self else{throw CancellationError()}
            self.cancelGameplayEntryPreparation();self.envelope.activeArcadeVariant=variant
        }
        services.readJourneyDie = {[weak self] id in self?.readJourneyDie(id) ?? false}
        services.journeyProgression = { [weak self] in self?.envelope.progression ?? NativeProgressionState() }
        services.developerAction = { [weak self] action, presenter in
            try self?.openDeveloperAction(action, presenter: presenter)
        }
        services.showsStudioIntro=showStudioIntro
        services.studioIntroCue = { [weak self] character in
            guard let self else{return};self.audioReceipt &+= 1
            self.audio?.studioIntro(character:character,receipt:self.audioReceipt,generation:self.audio?.generation ?? 1)
        }
        services.ambient = { [weak self] world, viewport, ids in
            self?.layouts.nextAmbient(world: world, top: viewport.minY, bottom: viewport.maxY, ids: ids)
        }
        services.bees = { [weak self] ids in self?.layouts.nextBees(ids: ids) }
        services.canContinueArcade = {[weak self] variant in
            guard let self,self.envelope.progression.firstPlayTutorialComplete else{return false}
            var selected=self.envelope
            selected.activeArcadeVariant=variant
            if selected.pendingArcadeRound != nil {return false}
            guard let board=selected.arcadeRun?.board else{return false}
            return selected.resumedRun(mode:.arcade,board:board) != nil
        }
        services.requiresTutorial = { [weak self] in self?.envelope.progression.firstPlayTutorialComplete == false }
        services.prepareGameplayEntry = {[weak self] board,completion in
            guard let self else{completion(false);return};self.prepareGameplayEntry(board:board,completion:completion)
        }
        services.cancelGameplayEntry = {[weak self] in self?.cancelGameplayEntryPreparation()}
        let controller = NativeAppController(resourceRoot: root, services: services)
        self.controller = controller
        let transport = JimiNativeMusic(root:root)
        soundtrack = NativeSoundtrackRouteOwner(root: root,transport:transport)
        arcadeMusic = NativeArcadeMusicOwner(transport:transport)
        arcadeMusic?.onPlaybackReady = { [weak self] duration in self?.soundtrack?.arcadePlaybackReady(duration:duration) }
        audio = NativeGameplayAudioOwner(root:root,enabled:envelope.settings.gameSoundsEnabled,
            random:{[sourceContext] in sourceContext.smokeSession.nextVisualRandom()})
        ambient = NativeJourneyAmbientOwner(root:root,enabled:envelope.settings.gameSoundsEnabled)
        soundtrack?.onError = { [weak self] detail in self?.showError(detail) }
        soundtrack?.apply(enabled: envelope.settings.musicEnabled)
        arcadeMusic?.apply(enabled:envelope.settings.musicEnabled)
        controller.onShipVisibility = {[weak self] visible in self?.ambient?.setSpaceshipVisible(visible)}
        controller.onRoute = { [weak self] route in
            guard let self else { return }
            self.routeLease &+= 1
            if route == .backpack {
                self.backpackPreservesAudio=true
                self.ambient?.continueCurrentRoute(generation:self.routeLease)
                return
            }
            let ambientRoute:NativeJourneyAmbientOwner.Route
            switch route {
            case .hub:ambientRoute = .hub
            case .world(let id):ambientRoute = .world(id)
            case .gameplay:
                if let state=self.gameplay?.engine.state {ambientRoute = .gameplay(state.mode,state.board)} else {ambientRoute = .none}
            default:ambientRoute = .none
            }
            if self.backpackPreservesAudio,ambientRoute==self.currentAmbientRoute {
                self.backpackPreservesAudio=false
                self.ambient?.continueCurrentRoute(generation:self.routeLease)
                return
            }
            self.backpackPreservesAudio=false;self.currentAmbientRoute=ambientRoute
            self.ambient?.setRoute(ambientRoute,generation:self.routeLease)
            if route == .gameplay,let state=self.gameplay?.engine.state {
                if state.mode == .journey {
                    // Selected artwork preparation retains the menu gain until
                    // the authored transition's first actual phase contact.
                    if self.boardTransition == nil {self.soundtrack?.setJourneyGameplay()}
                }
                else {self.soundtrack?.setArcadeGameplay();self.arcadeMusic?.enterRound(generation:state.generation)}
            } else {self.arcadeMusic?.leave();self.soundtrack?.setMenu()}
        }
        controller.onFeedback = { [weak self] kind in self?.routeFeedback(kind) }
        host.addChild(controller); controller.view.frame = host.view.bounds
        controller.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        host.view.addSubview(controller.view); controller.didMove(toParent: host)
        print("[NATIVE_SWIFT_BOOT] product=com.taptapdesign.stacktosix.native webRuntime=absent")
    }
    private func settings() -> [String: Any] {
        ["gameSoundsEnabled": envelope.settings.gameSoundsEnabled,
         "musicEnabled": envelope.settings.musicEnabled,
         "hapticsEnabled": envelope.settings.hapticsEnabled]
    }
    private func setPreference(_ key: String, _ value: Bool) throws {
        if key == "firstPlayRequired" {
            let previous = envelope.progression.firstPlayTutorialComplete
            envelope.progression.firstPlayTutorialComplete = !value
            do { try flush() } catch { envelope.progression.firstPlayTutorialComplete = previous; throw error }
            return
        }
        let previous = envelope.settings
        guard ["gameSoundsEnabled","musicEnabled","hapticsEnabled"].contains(key) else{return}
        // PWA preserves OFF's final light pulse before changing the preference.
        if key != "hapticsEnabled" || !value {impactFeedback("light")}
        switch key {
        case "gameSoundsEnabled": envelope.settings.gameSoundsEnabled = value
        case "musicEnabled": envelope.settings.musicEnabled = value
        case "hapticsEnabled": envelope.settings.hapticsEnabled = value
        default: return
        }
        do { try flush() } catch { envelope.settings = previous; throw error }
        soundtrack?.apply(enabled: envelope.settings.musicEnabled)
        arcadeMusic?.apply(enabled:envelope.settings.musicEnabled)
        audio?.setEnabled(envelope.settings.gameSoundsEnabled)
        if let state=gameplay?.engine.state {audio?.prepareBottleOnBoard(state)}
        ambient?.setEnabled(envelope.settings.gameSoundsEnabled)
        if key == "hapticsEnabled",value {impactFeedback("light")}
    }
    private enum FreshGameplayEntry:Equatable {
        case restart(UInt64,NativeGameplayRestartOrigin),arcadeContinuation(UInt64),journeyContinuation(UInt64,Int),tutorialCompletion(UInt64)
        var generation:UInt64 {
            switch self {case .restart(let value,_),.arcadeContinuation(let value),.journeyContinuation(let value,_),.tutorialCompletion(let value):return value}
        }
        var isJourneyContinuation:Bool {if case .journeyContinuation=self{return true};return false}
        var isRestart:Bool {if case .restart=self{return true};return false}
        var consumesPendingArcade:Bool {if case .arcadeContinuation=self{return true};return false}
        var alreadyAnnouncedArcade:Bool {consumesPendingArcade}
        var skipsBoardAnnouncement:Bool {if case .restart(_,let origin)=self{return origin.skipsBoardAnnouncement};return false}
        var keepsGameplayChromeVisible:Bool {if case .restart(_, .exitMenu)=self{return true};return consumesPendingArcade}
        var carriedJourneyScore:Int? {if case .journeyContinuation(_,let score)=self{return score};return nil}
    }
    private func cancelGameplayEntryPreparation(){
        let old=initialTexturePreparation;initialTexturePreparation=nil;old?.textures.dispose()
    }
    private func prepareGameplayEntry(board:Int?,freshEntry:FreshGameplayEntry?=nil,
        callerCurrent:@escaping()->Bool={true},completion:@escaping(Bool)->Void){
        cancelGameplayEntryPreparation()
        guard !disposed,callerCurrent(),!disposed else{completion(false);return}
        guard sourceInitialFreshStartupEnabled || sourceInitialRegularResumeEnabled || sourceInitialWildResumeEnabled else{completion(true);return}
        let mode:NativeRunMode=board == nil ? .arcade:.journey
        let tutorial = !envelope.progression.firstPlayTutorialComplete
        let number=tutorial ? 1:board ?? (freshEntry?.isRestart==true ? 1:(envelope.pendingArcadeRound?.round ?? envelope.arcadeRun?.board ?? 1))
        guard mode == .arcade || envelope.progression.isPlayable(board:number) else{completion(false);return}
        let saved=freshEntry != nil || tutorial || mode == .arcade && envelope.pendingArcadeRound != nil ? nil:envelope.resumedRun(mode:mode,board:number)
        let textures=NativeBoardTextures(root:root)
        let lease=InitialTexturePreparation(board:board,number:number,tutorial:tutorial,saved:saved,textures:textures,
            freshEntry:freshEntry,callerCurrent:callerCurrent)
        initialTexturePreparation=lease
        var additional:[String]=[NativeComboHUDMotion.atlasPath]
        for tile in saved?.tiles ?? [] where tile.isWild {
            guard let core=tile.gameplayArchetype,let face=NativeDiceArtwork.sourceWildSkinDefinition(kind:core.rawValue,variant:tile.variant) else{cancelGameplayEntryPreparation();completion(false);return}
            additional.append(face.path)
        }
        textures.prepareSourceInitialResources(additionalPaths:additional,current:{[weak self,weak lease] in
            guard let self,let lease,!self.disposed,self.initialTexturePreparation === lease else{return false}
            let accepted=lease.callerCurrent()
            return accepted && !self.disposed && self.initialTexturePreparation === lease
        }){[weak self,weak lease] ready in
            guard let self,let lease,!self.disposed,self.initialTexturePreparation === lease else{completion(false);return}
            guard ready,lease.callerCurrent(),!self.disposed,self.initialTexturePreparation === lease else{
                if self.initialTexturePreparation === lease {self.cancelGameplayEntryPreparation()}
                completion(false);return
            }
            lease.ready=true;completion(true)
        }
    }
    private func makeGameplay(board: Int?, exit: @escaping () -> Void,freshEntry:FreshGameplayEntry?=nil) throws -> UIViewController {
        sourcePreparedArcadeSaveGeneration=nil
        let mode: NativeRunMode = board == nil ? .arcade : .journey
        let needsTutorial = !envelope.progression.firstPlayTutorialComplete
        let number = needsTutorial ? 1 : board ?? (freshEntry?.isRestart == true ? 1:(envelope.pendingArcadeRound?.round ?? envelope.arcadeRun?.board ?? 1))
        guard mode == .arcade || envelope.progression.isPlayable(board: number) else {
            throw NativeSaveError.invalidState(["journey-board-locked"])
        }
        sourceCanonicalSaveEpoch &+= 1;let oldSave=sourceCanonicalSaveBinding;sourceCanonicalSaveBinding=nil;oldSave?.retire()
        retireSourceTutorialMeterRequest()
        retireBoardTransition()
        endRun?.dispose();scoreOwner?.dispose();tutorialOwner?.dispose();resultOwner?.dispose();resultOwner = nil
        var state = freshEntry==nil ? envelope.resumedRun(mode: mode, board: number):nil
        // Immutable v9 Homepage Play never resumes a saved run while first
        // play is forced. Reading/mounting Home preserves the old document;
        // the user's new Play starts the demo until authored result Continue.
        let previousTutorialGeneration = mode == .arcade ? envelope.arcadeRun?.generation : envelope.journeyRuns[number]?.generation
        let freshEntryGeneration = freshEntry?.generation ?? (needsTutorial ? (max(state?.generation ?? 0,previousTutorialGeneration ?? 0)+1):1)
        if needsTutorial {state=nil}
        var preparedTextures:NativeBoardTextures?
        if let lease=initialTexturePreparation,lease.ready,lease.board==board,lease.freshEntry==freshEntry,
           lease.number==number,lease.tutorial==needsTutorial,lease.callerCurrent(),
           lease.saved == (!needsTutorial && mode == .arcade && envelope.pendingArcadeRound != nil ? nil:state) {
            preparedTextures=lease.textures;initialTexturePreparation=nil
        }else{cancelGameplayEntryPreparation()}
        if freshEntry != nil,sourceInitialFreshStartupEnabled,preparedTextures==nil {
            throw NativeSaveError.invalidState(["source-fresh-entry-foundation-unprepared"])
        }
        var sourceConstruction:NativeSourceInitialBoardConstruction?
        defer{if sourceConstruction==nil {preparedTextures?.dispose()}}
        @MainActor func freshForInitialEntry(boardNumber:Int,generation:UInt64) throws -> NativeBoardState {
            guard sourceInitialFreshStartupEnabled else{return fresh(mode:mode,board:boardNumber,generation:generation,tutorial:needsTutorial)}
            // Current Native tutorial start rewrites cells/revision. Its actual
            // subsequent Source face graph must be ported before this route.
            guard !needsTutorial || (sourceTutorialActivationEnabled && sourceBoardEntryEnabled && sourceContext.sourceMicrotaskTasks != nil) else{throw NativeSaveError.invalidState(["source-initial-tutorial-owner-unavailable"])}
            guard !needsTutorial || !sourceTutorialEarnedMeterEnabled ||
                (sourceLogicalMathRandomEnabled && sourceSpecialIdlePresentationEnabled && sourceTutorialSubsequentPresentationEnabled) else {
                throw NativeSaveError.invalidState(["source-tutorial-earned-meter-dependencies-unavailable"])
            }
            guard !needsTutorial || !sourceDirectPresentationEnabled ||
                (sourceOrdinaryPresentationEnabled && sourceTutorialEarnedMeterEnabled) else {
                throw NativeSaveError.invalidState(["source-tutorial-direct-dependencies-unavailable"])
            }
            guard let construction=NativeSourceInitialBoardConstruction.make(root:root,service:sourceContext.service,
                mode:mode,board:boardNumber,columns:UIDevice.current.userInterfaceIdiom == .pad ? 7:5,
                generation:generation,tutorialDemo:needsTutorial,arcadeVariant:envelope.activeArcadeVariant,preparedTextures:preparedTextures,random:{[sourceContext] in sourceContext.smokeSession.nextVisualRandom()}),
                let recipe=construction.recipe else{throw NativeSaveError.invalidState(["source-initial-constructor-not-admitted"])}
            sourceConstruction=construction
            return recipe.state
        }
        defer {if let sourceConstruction,sourceConstruction.readyToAdopt {sourceConstruction.dispose()}}
        let pendingArcadeEntry=envelope.pendingArcadeRound
        let consumedPending = !needsTutorial && mode == .arcade && pendingArcadeEntry != nil &&
            (freshEntry == nil || freshEntry?.consumesPendingArcade == true)
        if consumedPending, let pending = envelope.pendingArcadeRound {
            state = try freshForInitialEntry(boardNumber:pending.round,generation:freshEntry?.generation ?? ((envelope.arcadeRun?.generation ?? 0)+1))
            state?.score = pending.score
            state?.lastSpecialMergeWorld = pending.lastSpecialMergeWorld
            state?.wildMeter = envelope.activeArcadeVariant == .pureDice ? 0 : (pending.meterProgress ?? 0.25)
            envelope.pendingArcadeRound = nil
        }
        // A pending next round carries score into a newly constructed board.
        // It is not a restored run: fresh owners, entry artwork and the Source
        // board wave must still be installed for that actual constructor.
        let resumed = state != nil && !consumedPending
        var initial:NativeBoardState
        if let state {initial=state}else {initial=try freshForInitialEntry(boardNumber:number,generation:freshEntryGeneration)}
        if let carriedScore=freshEntry?.carriedJourneyScore {initial.score=carriedScore}
        if sourceInitialWildResumeEnabled,resumed,!consumedPending,sourceConstruction==nil,initial.tiles.contains(where:{$0.isWild}) {
            guard !needsTutorial,sourceSpecialIdlePresentationEnabled,sourceContext.sourceMicrotaskTasks != nil,
                  let construction=NativeSourceInitialBoardConstruction.makeRestored(
                    root:root,service:sourceContext.service,saved:initial,preparedTextures:preparedTextures,
                    random:{[sourceContext] in sourceContext.smokeSession.nextVisualRandom()}),
                  let recipe=construction.recipe else{throw NativeSaveError.invalidState(["source-wild-resume-constructor-not-admitted"])}
            sourceConstruction=construction;initial=recipe.state
        }
        if sourceInitialRegularResumeEnabled,resumed,!consumedPending,sourceConstruction==nil {
            guard !needsTutorial,let construction=NativeSourceInitialBoardConstruction.makeRestoredRegular(
                root:root,service:sourceContext.service,saved:initial,preparedTextures:preparedTextures,
                random:{[sourceContext] in sourceContext.smokeSession.nextVisualRandom()}),
                let recipe=construction.recipe else{throw NativeSaveError.invalidState(["source-regular-resume-constructor-not-admitted"])}
            sourceConstruction=construction;initial=recipe.state
        }
        initial.bestScore = mode == .arcade ? envelope.progression.arcadeStats(for:envelope.activeArcadeVariant).highScore : envelope.progression.boardStats[number]?.highScore ?? 0
        // Progression cannot change Worlds while this engine owns its run.
        // Forest entry records the existing unlock evidence for later Arcade entry.
        let plainStarUnlocked=envelope.progression.hasUnlockedWildStar
        let mushroomUnlocked=envelope.progression.unlockedSpecialDice.contains("mushroom") || envelope.progression.announcedJourneyDice.contains("mushroom")
        let unlockedJourneyDice=envelope.progression.announcedJourneyDice
        let engine = NativeGameplayEngine(state: initial, rewardPicker: { state, roll, nextRoll in
            NativeWildRewardPolicy.choose(state:state,roll:roll,plainStarUnlocked:plainStarUnlocked,mushroomUnlocked:mushroomUnlocked,unlockedJourneyDice:unlockedJourneyDice,nextRoll:nextRoll)
        }, sourceMathRandom:sourceLogicalMathRandomEnabled && (!sourceTutorialEarnedMeterEnabled || needsTutorial ||
            (sourceConstruction != nil && (sourceFreshOrdinaryPresentationEnabled || sourceRestoredOrdinaryPresentationEnabled))) ? sourceContext.mathRandom:nil)
        engine.comboHUDCoinRewardsEnabled=true
        engine.comboWindowExtension=1.5
        if needsTutorial,engine.state.tutorial == nil {
            if sourceTutorialActivationEnabled {
                guard sourceConstruction != nil else{throw NativeSaveError.invalidState(["source-tutorial-constructor-unavailable"])}
                engine.sourceTutorialDemoActivationEnabled=true
                guard engine.beginSourceTutorialDemoActivation() != nil else{throw NativeSaveError.invalidState(["source-tutorial-demo-not-admitted"])}
            } else {
                guard engine.startTutorial().accepted else {throw NativeSaveError.invalidState(["tutorial-canonical-cells-unavailable"])}
            }
        }
        let gameplay = NativeGameplayViewController(engine: engine, resourceRoot: root)
        gameplay.keepsGameplayChromeVisibleOnEntry=freshEntry?.keepsGameplayChromeVisible == true
        gameplay.waitsForFirstFrameOnReplacement=freshEntry?.skipsBoardAnnouncement == true || freshEntry?.consumesPendingArcade == true
        gameplay.sourceContext=sourceContext
        // The profile remains incomplete until the later result is acknowledged.
        // A saved completed guide has no new demo activation to prepare; retain
        // its board/assist and enter gameplay with normal HUD ownership.
        gameplay.sourceTutorialActivationEnabled=sourceTutorialActivationEnabled && needsTutorial &&
            engine.pendingSourceTutorialDemoActivation != nil
        let freshOrdinarySource=sourceFreshOrdinaryPresentationEnabled && !needsTutorial && !resumed && sourceConstruction != nil
        let restoredOrdinarySource=sourceRestoredOrdinaryPresentationEnabled && !needsTutorial && resumed && sourceConstruction != nil
        let normalOrdinarySource=freshOrdinarySource || restoredOrdinarySource
        gameplay.sourceOrdinaryPresentationEnabled=sourceOrdinaryPresentationEnabled && (gameplay.sourceTutorialActivationEnabled || normalOrdinarySource)
        gameplay.sourceRegularIdlePresentationEnabled=normalOrdinarySource && gameplay.sourceOrdinaryPresentationEnabled
        let completeSource=completeNativeGameplayEnabled && gameplay.sourceOrdinaryPresentationEnabled
        gameplay.sourceGameplayRuntimeObservationEnabled=(normalOrdinarySource || completeSource) && gameplay.sourceOrdinaryPresentationEnabled
        gameplay.sourceMagnetPresentationEnabled=sourceMagnetPresentationEnabled && (normalOrdinarySource || completeSource) && gameplay.sourceOrdinaryPresentationEnabled
        gameplay.sourceOrdinaryEndgamePresentationEnabled=sourceOrdinaryEndgamePresentationEnabled && (normalOrdinarySource || completeSource) && gameplay.sourceOrdinaryPresentationEnabled
        gameplay.sourceTntPresentationEnabled=sourceTntPresentationEnabled && (normalOrdinarySource || completeSource) && gameplay.sourceOrdinaryPresentationEnabled
        gameplay.sourceRegularIdlePresentationEnabled=(normalOrdinarySource || completeSource) && gameplay.sourceOrdinaryPresentationEnabled
        gameplay.captureSourceMagnetCleanup={ [weak self,weak gameplay] _,generation in
            guard let self,let gameplay,!self.disposed,self.gameplay === gameplay,
                  gameplay.engine.state.generation==generation,gameplay.sourceScope?.current==true else{return nil}
            return self.audio?.captureMagnetPullCleanup(generation:generation)
        }
        gameplay.sourceSmallStackPresentationEnabled=gameplay.sourceOrdinaryPresentationEnabled
        gameplay.sourceDirectPresentationEnabled=sourceDirectPresentationEnabled && gameplay.sourceOrdinaryPresentationEnabled
        engine.sourceOrdinaryStackFacesEnabled=gameplay.sourceOrdinaryPresentationEnabled
        gameplay.sourceEndgameMutationLedgerEnabled=gameplay.sourceOrdinaryPresentationEnabled
        gameplay.sourceTutorialHUDEnabled=sourceTutorialHUDEnabled && gameplay.sourceTutorialActivationEnabled
        gameplay.sourceTutorialFirstStepMonitorEnabled=sourceTutorialFirstStepMonitorEnabled && sourceTutorialIntroEnabled && gameplay.sourceTutorialActivationEnabled
        engine.sourceTutorialPresentationBarrierEnabled=gameplay.sourceTutorialFirstStepMonitorEnabled
        engine.sourceTutorialSubsequentPresentationEnabled=sourceTutorialSubsequentPresentationEnabled && gameplay.sourceTutorialFirstStepMonitorEnabled
        engine.sourceStarOrbitCountAtPresentationEnabled=(sourceTutorialEarnedMeterEnabled && gameplay.sourceTutorialActivationEnabled) || normalOrdinarySource
        gameplay.onSourceTutorialRetired={ [weak self,weak gameplay] in guard let self,let gameplay,self.gameplay === gameplay else{return};self.tutorialOwner?.dispose() }
        gameplay.onSourceTutorialPrepared={ [weak self,weak gameplay] in
            guard let self,let gameplay,!self.disposed,self.gameplay === gameplay else{return}
            self.tutorialOwner?.refresh(gameplay.engine.state)
        }
        // Fresh and restore admission are independent. The Source wave owns
        // actual constructed holders; a Native resume cannot borrow that flag
        // when its separate Source restore constructor has not been admitted.
        // Home Arcade entry always presents the captured saved holders again.
        // Restoring gameplay state does not acknowledge its new entry motion.
        let homeArcadeEntry=mode == .arcade && freshEntry == nil && !needsTutorial
        gameplay.sourceBoardEntryEnabled=sourceBoardEntryEnabled && sourceConstruction != nil &&
            (!sourceRestoredOrdinaryPresentationEnabled || !resumed || homeArcadeEntry)
        gameplay.sourceSpecialIdlePresentationEnabled=sourceSpecialIdlePresentationEnabled && (!sourceTutorialEarnedMeterEnabled || gameplay.sourceTutorialActivationEnabled || normalOrdinarySource)
        gameplay.sourceWildShimmerPresentationEnabled=sourceWildShimmerPresentationEnabled
        gameplay.onSourceBoardEntrySound={ [weak self,weak gameplay] duration,_,generation in
            guard let self,let gameplay,!self.disposed,self.gameplay === gameplay,
                gameplay.engine.state.generation==generation else{return nil}
            self.audioReceipt &+= 1
            return self.audio?.startSourceBoardEntrySound(duration:duration,receipt:self.audioReceipt,generation:generation)
        }
        gameplay.sourceInitialConstruction=sourceConstruction
        gameplay.journeyDecorCatalog=journeyBottomDecorCatalog
        gameplay.onBoardArtworkFailure = { [weak self,weak gameplay] in
            guard let self,let gameplay,self.gameplay === gameplay,!self.disposed else{return}
            if gameplay.sourcePresentationFailureGeneration==gameplay.engine.state.generation {self.presentSourceFailureRecovery(gameplay);return}
            self.showError("The stage artwork could not be prepared. Your progress is saved.")
        }
        gameplay.onSourcePresentationFailure = {[weak self,weak gameplay] in
            guard let self,let gameplay,!self.disposed,self.gameplay === gameplay else{return}
            // The last coherent durable envelope is retained. A failed physical
            // phase is never saved, completed, scored or acknowledged here.
            self.presentSourceFailureRecovery(gameplay)
        }
        self.gameplay = gameplay; returnAction = exit; attemptCommitted = false
        if completeSource {
            gameplay.beforeSourceGameplayAdmission = {[weak self,weak gameplay] completion in
                guard let self,let gameplay,!self.disposed,self.gameplay === gameplay else{completion(false);return}
                self.prepareCompleteNativeGameplay(gameplay,completion:completion)
            }
        }
        if freshOrdinarySource,gameplay.sourceOrdinaryPresentationEnabled,
           gameplay.sourceDirectPresentationEnabled,mode == .arcade {
            sourcePreparedArcadeSaveGeneration=initial.generation
            // Until the physical entry receipt writes, retain the original
            // durable round and pending continuation. Native record/lifecycle
            // flush must not consume it merely because construction succeeded.
            if consumedPending {envelope.pendingArcadeRound=pendingArcadeEntry}
            gameplay.beforeSourceInitialBoardReveal = { [weak self,weak gameplay] in
                guard let self,let gameplay else{return false}
                return self.sourceCanonicalGameplaySaveEnabled ?
                    self.saveSourcePreparedArcadeEntry(gameplay:gameplay):self.savePreparedSourceArcadeEntry(gameplay)
            }
        }
        if freshOrdinarySource,mode == .journey {
            let generation=initial.generation
            gameplay.beforeSourceInitialBoardReveal = { [weak self,weak gameplay] in
                guard let self,let gameplay,!self.disposed,self.gameplay === gameplay,
                      gameplay.engine.state.generation==generation,gameplay.sourceScope?.current==true,
                      gameplay.sourceInitialConstruction?.isCurrent==true,
                      !NativeSaveEnvelope.hasRecordedMove(gameplay.engine.state),
                      NativeSaveEnvelope.isCoherentRun(gameplay.engine.state) else{
                    #if DEBUG
                    if let gameplay {print("[JourneyFreshReveal] rejected generation=\(gameplay.engine.state.generation) expected=\(generation) scope=\(gameplay.sourceScope?.current==true) construction=\(gameplay.sourceInitialConstruction?.isCurrent==true) moved=\(NativeSaveEnvelope.hasRecordedMove(gameplay.engine.state)) coherent=\(NativeSaveEnvelope.isCoherentRun(gameplay.engine.state)) entry=\(gameplay.sourceEntryDiagnostic())")}
                    #endif
                    return false
                }
                // Fresh entry retires the previous attempt only when this exact
                // board is ready to reveal. Canonical move-save producers remain
                // responsible for the new run after its first committed move.
                let previous=self.envelope
                self.envelope.journeyRuns.removeValue(forKey:number)
                self.envelope.journeyRunSavedAt.removeValue(forKey:number)
                do {try self.flush();return true}
                catch {self.envelope=previous;self.showError(error.localizedDescription);return false}
            }
        }
        if sourceTutorialEarnedMeterEnabled,gameplay.sourceTutorialActivationEnabled {
            gameplay.beforeInitialBoardEntry = { [weak self,weak gameplay] release in
                guard let self,let gameplay else{return}
                self.prepareSourceTutorialMeter(gameplay:gameplay,release:release)
            }
        } else if normalOrdinarySource {
            gameplay.beforeInitialBoardEntry = { [weak self,weak gameplay] release in
                guard let self,let gameplay,!self.disposed,self.gameplay === gameplay else{return}
                // v9 World-card entries include resumed Journey boards. Prepare
                // meter artwork behind the original transition rather than
                // postponing its first motion until that artwork is ready.
                if mode == .journey,freshEntry == nil {
                    let generation=gameplay.engine.state.generation
                    var meterReady=false,transitionReady=false,released=false
                    let releaseWhenReady:()->Void = { [weak self,weak gameplay] in
                        guard meterReady,transitionReady,!released,let self,let gameplay,
                            !self.disposed,self.gameplay === gameplay,
                            gameplay.engine.state.generation==generation else{return}
                        released=true;release()
                    }
                    self.mountJourneyTransition(gameplay,board:number) {
                        transitionReady=true;releaseWhenReady()
                    }
                    self.prepareSourceTutorialMeter(gameplay:gameplay) {
                        meterReady=true;releaseWhenReady()
                    }
                    return
                }
                self.prepareSourceTutorialMeter(gameplay:gameplay) { [weak self,weak gameplay] in
                    guard let self,let gameplay,!self.disposed,self.gameplay === gameplay else{return}
                    if freshEntry?.alreadyAnnouncedArcade == true || freshEntry?.skipsBoardAnnouncement == true {release()}
                    else if mode == .arcade {self.mountArcadeEntry(gameplay,release:release)}
                    else {self.mountJourneyTransition(gameplay,board:number,sourceContinuation:freshEntry?.isJourneyContinuation==true,release:release)}
                }
            }
        } else if mode == .arcade,!needsTutorial {
            gameplay.beforeInitialBoardEntry = { [weak self,weak gameplay] release in
                guard let self,let gameplay,!self.disposed,self.gameplay === gameplay else{return}
                if freshEntry?.skipsBoardAnnouncement == true {release()}
                else {self.mountArcadeEntry(gameplay,release:release)}
            }
        } else if mode == .journey,NativeJourneyTransitionAdmission.requiresTransition(entry:.worldCard,tutorial:needsTutorial) {
            gameplay.beforeInitialBoardEntry = { [weak self,weak gameplay] release in
                guard let self,let gameplay,!self.disposed,self.gameplay === gameplay else{return}
                if freshEntry?.skipsBoardAnnouncement == true {release()}
                else {self.mountJourneyTransition(gameplay,board:number,release:release)}
            }
        }
        committedScore=nil
        interimJourney = mode == .journey && !envelope.progression.completedJourneyBoards.contains(number)
        audio?.stop();audio?.beginGeneration(initial.generation);audio?.prepareBottleOnBoard(initial)
        haptics.cancelSequences();failHapticGeneration=nil;ordinarySixHapticContact=nil;specialHapticTargetCounts.removeAll()
        lastReturnBoard = mode == .journey ? number : nil
        if !resumed || consumedPending { envelope.progression.beginAttempt(mode: mode, board: number,arcadeVariant:envelope.activeArcadeVariant) }
        gameplay.unreadJourneyDice = {[weak self] in self?.envelope.progression.unreadJourneyDice ?? []}
        gameplay.onJourneyDieLanded = {[weak self,weak gameplay] id,board,generation in
            guard let self,let gameplay,self.gameplay === gameplay,!self.disposed,
                  gameplay.engine.state.mode == .journey,gameplay.engine.state.board==board,
                  gameplay.engine.state.generation==generation else{return}
            let previous=self.envelope
            guard self.envelope.progression.announceJourneyDie(id,board:board) else{return}
            self.envelope.savedAt=Date().timeIntervalSince1970
            do {try self.store.save(self.envelope)}catch{self.envelope=previous;self.showError(error.localizedDescription)}
            gameplay.boardScene?.refreshBackpackAlert()
        }
        gameplay.onStateChange = { [weak self] state in self?.record(state);self?.tutorialOwner?.refresh(state);self?.audio?.prepareBottleOnBoard(state) }
        gameplay.onSourceGuidedSnapBack={ [weak self] node in self?.tutorialOwner?.sourceSnapBackCompleted(node) }
        gameplay.onGameplayEvent = { [weak self] event in self?.tutorialOwner?.gameplayEvent(event) }
        gameplay.onHaptic = { [weak self] kind in self?.impactFeedback(kind) }
        gameplay.onPointerState = { [weak self] dragging in self?.tutorialOwner?.pointerState(dragging) }
        gameplay.onRoundWon = { [weak self,weak gameplay] generation in
            guard let self,let gameplay,!self.disposed,self.gameplay === gameplay,
                  gameplay.engine.state.generation==generation else{return}
            self.audioReceipt &+= 1
            self.audio?.roundWon(receipt:self.audioReceipt,generation:generation)
            if gameplay.boardClearedUsesPuppyThumb {self.resultMoment("arcade-thumb",index:1,duration:nil)}
            // Arcade's clear card moved onto the live board. Keep its existing
            // victory bed here; the successor now presents Round digits only.
            if gameplay.engine.state.mode == .arcade {self.resultMoment("arcade-victory",index:0,duration:nil)}
        }
        gameplay.onTerminal = { [weak self,weak gameplay] result in
            guard let self,let gameplay,self.gameplay === gameplay else{return}
            self.terminal(result)
        }
        gameplay.prepareJourneyRewardController = { [weak self,weak gameplay] result in
            guard let self,let gameplay,self.gameplay === gameplay,!self.disposed,!self.attemptCommitted,
                  self.interimJourney,result.kind == .complete,gameplay.engine.state.mode == .journey,
                  gameplay.engine.state.tutorial?.requiresResultCompletion != true,
                  gameplay.sourcePresentationFailureGeneration != gameplay.engine.state.generation else{return nil}
            let state=gameplay.engine.state
            let score=max(NativeResultOwner.finalScore(state:state,clean:true),self.envelope.progression.boardStats[state.board]?.highScore ?? 0)
            let stars=max(self.envelope.progression.journeyStars(board:state.board),
                NativeJourneyContent.earnedStars(score:NativeResultOwner.finalScore(state:state,clean:true),board:state.board))
            return NativeJourneyRewardController(root:self.root,board:state.board,score:score,generation:state.generation,awardedStars:stars)
        }
        gameplay.onHUDTapContact = {[weak self,weak gameplay] kind in
            guard let self,let gameplay,self.gameplay === gameplay else{return}
            self.routeFeedback(kind,includesHaptic:false)
        }
        gameplay.onGameplayReceipt = { [weak self] event,source,destination,generation in
            guard let self else{return};self.audioReceipt &+= 1
            self.gameplayHaptic(event,source:source,destination:destination,generation:generation)
            self.audio?.onGameplayEvent(event,source:source,destination:destination,generation:generation,receipt:self.audioReceipt)
            if event.kind == .noMovesCandidate,self.gameplay?.engine.stagedSourceNoMoves != true {self.resultMoment("no-moves",index:0,duration:nil)}
            if event.kind == .merged,event.value == 6,initial.mode == .arcade {self.arcadeMusic?.committedMerge6(generation:generation)}
        }
        gameplay.onSpecialFadeCapture = { [weak self] variant,generation in
            self?.audio?.captureSpecialFade(variant:variant,generation:generation)
        }
        gameplay.onHUDCoinArrival = { [weak self,weak gameplay] relativeSize in
            guard let self,let gameplay,self.gameplay === gameplay,!self.disposed else{return}
            self.audioReceipt &+= 1
            self.audio?.specialMoment(variant:"coin",moment:"hud-star-arrived",coinSizeFraction:relativeSize,receipt:self.audioReceipt,generation:gameplay.engine.state.generation)
        }
        gameplay.onSpecialMoment = { [weak self] variant,moment,index in
            guard let self,let state=self.gameplay?.engine.state else{return};self.audioReceipt &+= 1
            if moment == "wild-drop" {self.audio?.routeFeedback(variant ?? "backpack",receipt:self.audioReceipt,generation:state.generation)}
            else {self.audio?.specialMoment(variant:variant ?? "tnt",moment:moment,index:index,receipt:self.audioReceipt,generation:state.generation)}
        }
        gameplay.onBoardExit = { [weak self,weak gameplay] duration in
            guard let self,let gameplay,self.gameplay === gameplay,!self.disposed else{return}
            self.audioReceipt &+= 1
            self.audio?.routeFeedback("board-exit",receipt:self.audioReceipt,generation:gameplay.engine.state.generation,duration:duration)
        }
        gameplay.onBoardEntry = { [weak self] duration,beats in
            guard let self,let state=self.gameplay?.engine.state else{return};self.audioReceipt &+= 1
            self.audio?.prepareBottleOnBoard(state)
            self.audio?.routeFeedback("board-enter",receipt:self.audioReceipt,generation:state.generation,duration:duration)
            self.tutorialOwner?.refresh(state)
            self.boardEntryHaptics?.dispose()
            let pulse=NativeBoardEntryHaptics(duration:duration,beats:beats);self.boardEntryHaptics=pulse
            pulse.onImpact = { [weak self] in guard self?.gameplay?.engine.state.generation==state.generation else{return};self?.impactFeedback("protected-light") }
            self.gameplay?.view.addSubview(pulse);pulse.start()
        }
        endRun = NativeEndRunOwner(gameplay: gameplay, resourceRoot: root,
            save: { [weak self] in self?.saveCurrent() ?? false },
            restart: { [weak self] in self?.restart(origin:.exitMenu) },
            // EndRun commits its exact current save before the authored exit.
            // Its owner/generation-guarded completion must not try to capture
            // a second save after the physical board has become hidden.
            exit: { [weak self] in self?.finishGameplayExit() })
        endRun?.onFeedback = { [weak self] kind in self?.routeFeedback(kind,haptic:kind == "cta" ? "selection":"light") }
        scoreOwner=NativeScoreOwner(gameplay:gameplay,root:root,progression:{[weak self] in self?.envelope.progression ?? NativeProgressionState()})
        scoreOwner?.onReadDie = {[weak self] id in self?.readJourneyDie(id) ?? false}
        scoreOwner?.onFeedback = { [weak self] kind in self?.routeFeedback(kind) }
        installTutorial(gameplay)
        record(engine.state); try flush()
        if sourceConstruction != nil {
            // No await/newwait: adopt actual objects before this input task yields.
            gameplay.loadViewIfNeeded()
            guard self.gameplay === gameplay,gameplay.sourceScope?.current==true,gameplay.boardScene?.sourceInitialStartupReady==true else{gameplay.dispose();throw NativeSaveError.invalidState(["source-initial-adoption-rejected"])}
        }
        return gameplay
    }
    private func prepareCompleteNativeGameplay(_ gameplay:NativeGameplayViewController,completion:@escaping(Bool)->Void) {
        guard completeNativeGameplayEnabled,!disposed,self.gameplay === gameplay,
              let scope=gameplay.sourceScope,scope.current,let scene=gameplay.boardScene,
              scene.publishSourceInstalledSpawnWriters(scope:scope) else{completion(false);return}
        let generation=gameplay.engine.state.generation
        gameplay.configureSourceCompleteNoMoves(scope:scope,persistStuckState:{[weak self,weak gameplay] in
            guard let self,let gameplay,!self.disposed,self.gameplay === gameplay,
                  gameplay.engine.state.generation==generation else{return}
            _=self.sourceCanonicalSaveBinding?.notify(.noMovesPersistStuck)
        },visibleShowCue:{[weak self,weak gameplay] gen,_ in
            guard let self,let gameplay,!self.disposed,self.gameplay === gameplay,gen==generation else{return}
            self.resultMoment("no-moves",index:0,duration:nil)
        }) {[weak self,weak gameplay,weak scene] ready in
            guard let self,let gameplay,let scene,ready,!self.disposed,self.gameplay === gameplay,
                  gameplay.boardScene === scene,scope.current,gameplay.engine.state.generation==generation,
                  self.configureSourceGameplayPersistenceAndQueue(gameplay:gameplay) else{completion(false);return}
            completion(true)
        }
    }
    /// Source's genuine fresh-Arcade save bypasses transient/end-game queries.
    /// This one-shot entry producer never admits ordinary lifecycle saves or
    /// supplies missing global owners to the queue/NO MOVES graph.
    private func savePreparedSourceArcadeEntry(_ gameplay:NativeGameplayViewController)->Bool {
        guard !disposed,!sourceCanonicalGameplaySaveEnabled,!attemptCommitted,self.gameplay === gameplay,
              gameplay.sourceBoardEntryEnabled,gameplay.engine.state.mode == .arcade,
              gameplay.sourceInitialConstruction?.isCurrent==true,
              let scope=gameplay.sourceScope,scope.current,let scene=gameplay.boardScene,
              scene.sourceAnimationBindingAdmissionOpen else{return false}
        let state=gameplay.engine.state
        let current:()->Bool = { [weak self,weak gameplay,weak scene] in
            guard let self,let gameplay,let scene,!self.disposed,!self.attemptCommitted,
                  self.gameplay === gameplay,gameplay.boardScene === scene,gameplay.engine.state==state,
                  gameplay.sourceInitialConstruction?.isCurrent==true else{return false}
            return scope.current && scene.sourceAnimationBindingAdmissionOpen
        }
        let hooks=NativeSourceCanonicalSaveOwner<NativeBoardState>.Hooks(current:current,capture:{ request in
            // Only this fresh-entry receipt can use the Source visibility bypass.
            if case .save(let fresh)=request,!fresh{return nil}
            guard current(),let physical=scene.captureSourcePhysicalBoard(),
                  physical.paintedStateReceipt != nil,physical.isStillCurrent(),current() else{return nil}
            let modes=physical.tiles.mapValues(\.eventMode)
            let paintAccepted=NativeSourceCanonicalSaveCapture.hasSerializablePaint(
                physical.observedState,eventModes:modes,allowPreparedHidden:true)
            let missing=scope.registries.missing([.specialContactCommitRelease,.sourceTileLifecycle,.sourceSpawnMarkers])
            return .init(state:state,guardFields:.init(runMode:state.mode.rawValue,
                skipRebuildBoard:false,journeyCompletedSaveVeto:false,gameHasEnded:self.attemptCommitted,
                gridReady:physical.tiles.count==state.tiles.count,
                // Conservative busy is deliberately bypassed by the genuine
                // fresh receipt. No transient global/Date read is fabricated.
                gameplayTransientBusy:true,freshArcadeEntryAuthorized:true),missingOwners:missing,
                nativeCoherent:NativeSaveEnvelope.isCoherentRun(state) && !gameplay.engine.hasUnsavableSourceGameplayState && paintAccepted,
                physicalStillMatches:physical.isStillCurrent)
        },stillMatches:{current() && gameplay.engine.state==$0},write:{[weak self] value in
            guard let self,current(),self.sourcePreparedArcadeSaveGeneration==value.generation else{return false}
            return self.writeSourceCanonicalState(value,preparedArcadeEntry:true)
        },wall:{_,_ in nil}) // This producer has no delayed save branch.
        guard let binding=scope.installCanonicalSave(hooks:hooks) else{return false}
        defer{scope.retireCanonicalSave(binding)}
        return current() && binding.notify(.preparedArcadeEntry) == .written
    }
    private func fresh(mode: NativeRunMode, board: Int, generation: UInt64,tutorial:Bool=false) -> NativeBoardState {
        var state=NativeBoardFactory.make(mode: mode, board: board,
            columns: UIDevice.current.userInterfaceIdiom == .pad ? 7 : 5,
            generation: generation, seed: UInt64.random(in: 1...UInt64.max),tutorial:tutorial,arcadeVariant:envelope.activeArcadeVariant)
        state.bestScore = mode == .arcade ? envelope.progression.arcadeStats(for:envelope.activeArcadeVariant).highScore : envelope.progression.boardStats[board]?.highScore ?? 0
        return state
    }
    /// Caller supplies genuine Source marker/terminal/prepare observers. This
    /// does not manufacture those capabilities or enable whole Source gameplay.
    @discardableResult func configureSourceCanonicalGameplaySave(
        observe:@escaping(NativeGameplayViewController)->NativeSourceCanonicalSaveCapture?)->NativeSourceCanonicalSaveOwner<NativeBoardState>.Binding? {
        guard sourceCanonicalGameplaySaveEnabled,!disposed,let gameplay else{return nil}
        sourceCanonicalSaveEpoch &+= 1;let e=sourceCanonicalSaveEpoch
        gameplay.loadViewIfNeeded()
        guard !disposed,sourceCanonicalSaveEpoch==e,self.gameplay === gameplay,let scene=gameplay.boardScene,let scope=gameplay.sourceScope,scope.current else{return nil}
        guard !disposed,sourceCanonicalSaveEpoch==e,self.gameplay === gameplay else{return nil}
        let generation=gameplay.engine.state.generation
        let previous=sourceCanonicalSaveBinding;sourceCanonicalSaveBinding=nil;previous?.retire()
        let current:()->Bool = {[weak self,weak gameplay,weak scene,scope] in
            guard let self,let gameplay,let scene,!self.disposed,self.sourceCanonicalGameplaySaveEnabled,
                self.sourceCanonicalSaveEpoch==e,self.gameplay === gameplay,gameplay.boardScene === scene,
                gameplay.engine.state.generation==generation else{return false}
            let accepted=scope.current
            return accepted && !self.disposed && self.sourceCanonicalSaveEpoch==e && self.gameplay === gameplay && gameplay.boardScene === scene && gameplay.engine.state.generation==generation
        }
        guard current() else{return nil}
        var hooks=NativeSourceCanonicalSaveOwner<NativeBoardState>.Hooks(current:current,capture:{[weak gameplay] request in
            guard let gameplay,current(),let observation=observe(gameplay),current() else{return nil}
            let state=gameplay.engine.state
            let source=observation.guardFields
            var missing=observation.missingOwners
            let freshRequested:Bool
            switch request {case .admission:freshRequested=false;case .save(let fresh):freshRequested=fresh}
            let preparedArcade=freshRequested && source.runMode == NativeRunMode.arcade.rawValue && source.freshArcadeEntryAuthorized
            var transient=false
            // Source skip/completed veto precede the transient query; a genuine
            // prepared Arcade entry also bypasses it. No eager Date read.
            if case .save = request,!source.skipRebuildBoard && !(source.runMode != NativeRunMode.arcade.rawValue && source.journeyCompletedSaveVeto) && !preparedArcade {
                let reads=observation.transient
                let ordered=NativeSourceCanonicalSaveTransient.Hooks(current:{
                    guard current() else{return false};let accepted=reads.current();return accepted && current()
                },busyEnding:reads.busyEnding,spawningOrPulling:reads.spawningOrPulling,
                    specialActive:{scope.registries.specialActiveForSave()},regularHandoff:reads.regularHandoff,
                    cleanupClaim:reads.cleanupClaim,livingDrag:reads.livingDrag,
                    foregroundDrop:reads.foregroundDrop,livingTileMarker:reads.livingTileMarker)
                switch NativeSourceCanonicalSaveTransient.capture(ordered) {
                case .known(let value):transient=value
                case .missing(let owner):missing.append(owner)
                case .obsolete:return nil
                }
            }
            guard current() else{return nil}
            let guardFields=NativeSourceCanonicalSaveGuard(runMode:source.runMode,skipRebuildBoard:source.skipRebuildBoard,
                journeyCompletedSaveVeto:source.journeyCompletedSaveVeto,gameHasEnded:source.gameHasEnded,gridReady:source.gridReady,
                gameplayTransientBusy:transient,freshArcadeEntryAuthorized:source.freshArcadeEntryAuthorized)
            // These are genuine mounted Source marker/transaction endpoints,
            // not a caller-supplied empty array masquerading as admission.
            missing += scope.registries.missing([.specialContactCommitRelease,.sourceTileLifecycle,.sourceSpawnMarkers])
            if source.runMode != state.mode.rawValue{missing.append("source-run-mode-identity")}
            if !observation.matchesCanonicalState(state){missing.append("source-save-physical-core-overlay")}
            if observation.paintedStateReceipt != nil && !observation.hasCompletePhysicalEventModes {
                missing.append("source-save-physical-input-modes")
            }
            if observation.paintedStateReceipt != nil && observation.physicalStillMatches == nil {
                missing.append("source-save-physical-revalidation")
            }
            return .init(state:state,guardFields:guardFields,missingOwners:missing,
                nativeCoherent:NativeSaveEnvelope.isCoherentRun(state) && !gameplay.engine.hasUnsavableSourceGameplayState &&
                    observation.hasSerializablePaint(allowPreparedHidden:preparedArcade),
                physicalStillMatches:observation.physicalStillMatches)
        },stillMatches:{[weak gameplay] state in current() && gameplay?.engine.state==state},write:{[weak self] state in
            guard let self,current(),!self.attemptCommitted else{return false}
            return self.writeSourceCanonicalState(state)
        },wall:{[weak scene] ms,callback in guard current() else{return nil};return scene?.scheduleSourceCanonicalSaveWall(milliseconds:ms,generation:generation,elapsed:callback)})
        hooks.writeWithRequest = {[weak self] state,request in
            guard let self,current(),!self.attemptCommitted else{return false}
            let prepared:Bool
            switch request {case .admission:return false;case .save(let fresh):prepared=fresh}
            return self.writeSourceCanonicalState(state,preparedArcadeEntry:prepared)
        }
        guard let binding=scope.installCanonicalSave(hooks:hooks) else{return nil}
        guard current(),self.sourceCanonicalSaveBinding==nil,
            scene.configureSourceCanonicalSave(scope:scope,binding:binding),current(),self.sourceCanonicalSaveBinding==nil else{binding.retire();return nil}
        sourceCanonicalSaveBinding=binding
        scene.requestSourceMeterQueueAfterSaveMounted()
        return binding
    }
    /// Mount real queue writers first, then the canonical physical save owner.
    /// The queue refuses permission until that binding exists; installation
    /// never substitutes unknown lifecycle owners with false observations.
    @discardableResult func configureSourceGameplayPersistenceAndQueue(gameplay:NativeGameplayViewController)->Bool {
        guard sourceCanonicalGameplaySaveEnabled,!disposed,self.gameplay === gameplay,
              let scene=gameplay.boardScene,let scope=gameplay.sourceScope,scope.current else{return false}
        if sourceCanonicalSaveBinding?.current==true {return true}
        if scene.captureSourceMeterQueueSignals()==nil {
            guard configureSourceMeterQueue(gameplay:gameplay,observe:{[weak scene] _ in
                scene?.captureSourceGameplayRuntime(isWild:false)?.meterEnvironment
            },queueInProgress:{_ in
                // NativeMeterQueueSignals already publishes the actual queue
                // owner to save/endgame. Core reservations gate only the
                // arriving tile; queue progress does not own shared input.
            },shimmer:{
                // Literal HUD.shimmerProgress is an authored empty helper.
                // Preserve it without inventing a new HUD effect/clock.
            }) else{return false}
        }
        return configureSourceCanonicalGameplaySave(observe:{[weak self] actual in
            guard let self,self.gameplay === actual,let board=actual.boardScene?.captureSourcePhysicalBoard(),
                  board.isStillCurrent() else{return nil}
            let state=board.canonicalState
            // v9 clears its completion tombstone for a fresh replay. Earned
            // progression survives; only this captured attempt owns the veto.
            let completed=state.mode == .journey && state.terminal?.kind == .complete
            let fields=NativeSourceCanonicalSaveGuard(runMode:state.mode.rawValue,
                skipRebuildBoard:false,journeyCompletedSaveVeto:completed,
                gameHasEnded:self.attemptCommitted,gridReady:true,gameplayTransientBusy:false,
                freshArcadeEntryAuthorized:self.sourcePreparedArcadeSaveGeneration==state.generation)
            return actual.boardScene?.captureSourceCanonicalSaveState(guardFields:fields)
        }) != nil
    }
    @discardableResult func saveSourcePreparedArcadeEntry(gameplay:NativeGameplayViewController)->Bool {
        guard self.gameplay === gameplay,sourceCanonicalGameplaySaveEnabled,
              sourcePreparedArcadeSaveGeneration==gameplay.engine.state.generation,
              let binding=sourceCanonicalSaveBinding,binding.current else{return false}
        return binding.notify(.preparedArcadeEntry) == .written
    }
    private func retireSourceTutorialMeterRequest() {
        sourceTutorialMeterEpoch &+= 1
        let request=sourceTutorialMeterRequest;sourceTutorialMeterRequest=nil
        if let request{sourceTutorialMeterResources?.cancel(request)}
        let hudRequest=sourceTutorialHUDStarRequest;sourceTutorialHUDStarRequest=nil
        if let hudRequest{_ = sourceContext.hudStarTextures.cancel(hudRequest)}
    }
    /// Tutorial and normal constructed boards share the earned Star carrier.
    /// A restored completed guide retains its assist state while entering through
    /// the normal physical board owners, rather than the new-demo activation.
    private func prepareSourceTutorialMeter(gameplay:NativeGameplayViewController,release:@escaping()->Void) {
        guard !disposed,self.gameplay === gameplay,gameplay.sourceScope?.current==true,
              ((gameplay.sourceTutorialActivationEnabled && gameplay.engine.sourceTutorialSubsequentPresentationEnabled) ||
               (sourceFreshOrdinaryPresentationEnabled && gameplay.sourceInitialConstruction != nil &&
                gameplay.sourceOrdinaryPresentationEnabled && gameplay.engine.state.tutorial?.active != true)) else{return}
        retireSourceTutorialMeterRequest()
        let epoch=sourceTutorialMeterEpoch,generation=gameplay.engine.state.generation
        let resources=sourceTutorialMeterResources ?? NativeWildMeterDropResources(root:root)
        sourceTutorialMeterResources=resources
        var completed=false
        let request=resources.prepare(arcade:gameplay.engine.state.mode == .arcade,
            capture:.init(id:"source-tutorial-app-meter",generation:generation,epoch:epoch)) {[weak self,weak gameplay] result in
            completed=true
            guard let self,let gameplay,!self.disposed,self.sourceTutorialMeterEpoch==epoch,
                  self.gameplay === gameplay,gameplay.engine.state.generation==generation,
                  gameplay.sourceScope?.current==true else{return}
            self.sourceTutorialMeterRequest=nil
            guard case .success=result,self.configureSourceMeterPresentation(gameplay:gameplay,resources:resources) else {
                gameplay.boardScene?.onSourcePresentationFailure?("source_tutorial_meter_preparation_rejected",generation)
                return
            }
            if gameplay.sourceDirectPresentationEnabled {
                self.prepareSourceTutorialDirectHUD(gameplay:gameplay,epoch:epoch,generation:generation,release:release)
            } else {release()}
        }
        if !completed,!disposed,sourceTutorialMeterEpoch==epoch,self.gameplay === gameplay {
            sourceTutorialMeterRequest=request
        } else if !completed {resources.cancel(request)}
    }
    /// Original small-star texture borrows the app cache and the same entry
    /// epoch. Cancel only this waiter; root Context owns reusable cache lifetime.
    private func prepareSourceTutorialDirectHUD(gameplay:NativeGameplayViewController,epoch:UInt64,generation:UInt64,release:@escaping()->Void) {
        let current:()->Bool = {[weak self,weak gameplay] in
            guard let self,let gameplay else{return false}
            return !self.disposed && self.sourceTutorialMeterEpoch==epoch && self.gameplay === gameplay &&
                gameplay.engine.state.generation==generation && gameplay.sourceScope?.current==true
        }
        guard current() else{return}
        var completed=false
        let request=sourceContext.hudStarTextures.prepare(root:root,current:current) {[weak self,weak gameplay] prepared in
            completed=true
            guard let self,let gameplay,current() else{return}
            self.sourceTutorialHUDStarRequest=nil
            guard let prepared,gameplay.configureSourceDirectHUDPresentation(prepared:prepared),current() else {
                gameplay.boardScene?.onSourcePresentationFailure?("source_tutorial_direct_hud_preparation_rejected",generation)
                return
            }
            release()
        }
        if !completed,current(){sourceTutorialHUDStarRequest=request}
        else if !completed,let request{_ = sourceContext.hudStarTextures.cancel(request)}
    }
    /// Actual app audio/transport binding for an already-admitted Source Scene.
    /// The startup/queue/save caller must establish resource and Core authority
    /// first. This capability does not enable whole Source mode on its own.
    @discardableResult
    func configureSourceMeterPresentation(gameplay:NativeGameplayViewController,
        resources:NativeWildMeterDropResources)->Bool {
        guard !disposed,self.gameplay === gameplay,audio != nil,
              let scene=gameplay.boardScene,let scope=gameplay.sourceScope,
              scope.current,gameplay.engine.sourceMathRandom === sourceContext.mathRandom,
              gameplay.engine.sourceStarOrbitCountAtPresentationEnabled,
              let ready=resources.sourceSynchronousPreparationReceipt(),
              resources.sourceSynchronousPreparationIsCurrent(ready) else{return false}
        let generation=gameplay.engine.state.generation
        let current:()->Bool = {[weak self,weak gameplay,weak scene,weak scope] in
            guard let self,let gameplay,let scene,let scope,!self.disposed,
                  self.gameplay === gameplay,gameplay.boardScene === scene,
                  gameplay.sourceScope === scope,scope.current,
                  gameplay.engine.state.generation==generation else{return false}
            return scene.sourceAnimationBindingAdmissionOpen
        }
        let configured=gameplay.configureSourceMeterAndStarPresentation(resources:resources,
            texturesCurrent:{current() && resources.sourceSynchronousPreparationIsCurrent(ready)},
            selectedAudio:{[weak self,weak scene] tile,capture in
                guard let self,let scene,current(),capture.generation==generation,
                      scene.sourceNativeTileNode(tile.id) != nil else{return}
                // Muted/background/interrupted selected preparation is skipped
                // by the existing audio owner, without blocking gameplay.
                _=self.audio?.prepareSelectedSpecial(special:capture.selection,variant:nil,
                    capture:"meter-\(capture.generation)-\(capture.token)-\(tile.id)",generation:generation)
            },carrierAudio:{[weak self] arcade,id,capturedGeneration in
                guard let self,current(),capturedGeneration==generation else{return {}}
                self.audioReceipt &+= 1
                return self.audio?.beginMeterCarrierAudio(arcade:arcade,id:id,
                    receipt:self.audioReceipt,generation:generation) ?? {}
            },landingSound:{[weak self] in
                guard let self,current() else{return}
                self.audioReceipt &+= 1
                self.audio?.specialMoment(variant:"wild",moment:"landing",receipt:self.audioReceipt,generation:generation)
            })
        guard configured,current() else{return false}
        return scene.configureSourceTutorialMeterHUD(scope:scope) && current()
    }
    /// The actual marker/environment owner supplies every Source field. Missing
    /// observations block admission; Core decides allow/block/retry literally.
    @discardableResult
    func configureSourceMeterQueue(gameplay:NativeGameplayViewController,
        observe:@escaping(Bool)->NativeSourceMeterQueueEnvironment?,
        queueInProgress:@escaping(Bool)->Void,shimmer:@escaping()->Void)->Bool {
        guard !disposed,self.gameplay === gameplay,sourceCanonicalGameplaySaveEnabled,
              let scene=gameplay.boardScene,let scope=gameplay.sourceScope,
              scope.current,scene.sourceMicrotaskBoundariesInstalled else{return false}
        let generation=gameplay.engine.state.generation
        let current:()->Bool = {[weak self,weak gameplay,weak scene,weak scope] in
            guard let self,let gameplay,let scene,let scope,!self.disposed,
                  self.gameplay === gameplay,gameplay.boardScene === scene,
                  gameplay.sourceScope === scope,scope.current,
                  gameplay.engine.state.generation==generation else{return false}
            return scene.sourceAnimationBindingAdmissionOpen
        }
        guard current() else{return false}
        return scene.configureSourceMeterQueue(scope:scope,signals:scope.meterQueueSignals,
            permission:{[weak self,weak gameplay] progress in
                guard let self,self.sourceCanonicalSaveBinding?.current==true else{return .block("source-canonical-save-unavailable")}
                guard let gameplay,current(),let observed=observe(progress),current() else{return .block("source-meter-environment-unavailable")}
                let permission=gameplay.engine.meterSourceQueuePermission(environment:observed)
                switch permission.action {
                case .allow:return .allow
                case .block:return .block(permission.reason)
                case .retry:
                    guard let milliseconds=permission.retryDelayMs else{return .block("source-meter-retry-duration-unavailable")}
                    return .retry(permission.reason,milliseconds)
                }
            },continuation:{[weak self,weak gameplay] in
                guard self?.sourceCanonicalSaveBinding?.current==true,let gameplay,current() else{return false}
                return gameplay.engine.state.wildMeter.isFinite && gameplay.engine.state.wildMeter>=1 && !gameplay.engine.flags.busyEnding
            },meterReady:{[weak gameplay] in
                guard let gameplay,current() else{return false}
                return gameplay.engine.state.wildMeter.isFinite && gameplay.engine.state.wildMeter>=1
            },enqueue:{[weak scene] _ in
                // Real Scene installer captures the exact FIFO; reaching this
                // unbound fallback must never synthesize DispatchQueue work.
                if current(){scene?.onSourcePresentationFailure?("source_meter_queue_fifo_unbound",generation)}
            },queueInProgress:queueInProgress,
            shimmer:{if current(){shimmer()}},canonicalSave:{[weak self] milliseconds in
                guard current(),let save=self?.sourceCanonicalSaveBinding,save.current else{return}
                _=save.wildQueueFinallySave(milliseconds:milliseconds)
            },validateInstallation:{
                guard current(),let initial=observe(false),current() else{return false}
                return initial.generation==generation && !initial.queueInProgress
            })
    }
    private func writeSourceCanonicalState(_ state:NativeBoardState,preparedArcadeEntry:Bool=false)->Bool {
        guard !disposed,!attemptCommitted,gameplay?.engine.state==state else{return false}
        if preparedArcadeEntry {
            guard state.mode == .arcade,sourcePreparedArcadeSaveGeneration==state.generation else{return false}
        }
        let previous=envelope,now=Date().timeIntervalSince1970
        envelope.recordPlayableRun(state,now:now)
        envelope.savedAt=now
        do {
            try store.save(envelope)
            if preparedArcadeEntry,sourcePreparedArcadeSaveGeneration==state.generation {sourcePreparedArcadeSaveGeneration=nil}
            return true
        }
        catch {envelope=previous;showError(error.localizedDescription);return false}
    }
    private func readJourneyDie(_ id:String)->Bool {
        guard !disposed else{return false}
        guard envelope.progression.unreadJourneyDice.contains(id) else{return true}
        let previous=envelope
        envelope.progression.readJourneyDie(id);envelope.savedAt=Date().timeIntervalSince1970
        do {try store.save(envelope);gameplay?.boardScene?.refreshBackpackAlert();return true}
        catch {envelope=previous;showError(error.localizedDescription);return false}
    }
    private func record(_ state: NativeBoardState) {
        guard gameplay?.sourcePresentationFailureGeneration != state.generation else{return}
        // Installed Source producers own gameplay snapshot writes. Settings and
        // progression can still flush the last durable envelope independently.
        guard !sourceCanonicalGameplaySaveEnabled else{return}
        guard sourcePreparedArcadeSaveGeneration != state.generation else{return}
        guard !attemptCommitted,state.terminal == nil,NativeSaveEnvelope.isCoherentRun(state) else {return}
        if let engine=gameplay?.engine {
            guard engine.state.generation==state.generation,!engine.hasUnsavableSourceGameplayState else{return}
        }
        let now = Date().timeIntervalSince1970
        envelope.recordPlayableRun(state,now:now)
    }
    private func installTutorial(_ gameplay:NativeGameplayViewController) {
        tutorialOwner?.dispose();tutorialOwner=nil
        guard gameplay.engine.state.tutorial?.active == true else{return}
        tutorialOwner=NativeTutorialOwner(gameplay:gameplay,root:root)
        tutorialOwner?.sourceFirstStepMonitorEnabled=gameplay.sourceTutorialFirstStepMonitorEnabled
        tutorialOwner?.sourceSubsequentPresentationEnabled=gameplay.engine.sourceTutorialSubsequentPresentationEnabled
        gameplay.boardScene?.sourceTutorialSubsequentPresentationEnabled=gameplay.engine.sourceTutorialSubsequentPresentationEnabled
        tutorialOwner?.sourceActivationEnabled=gameplay.sourceTutorialActivationEnabled
        tutorialOwner?.sourceIntroEnabled=sourceTutorialIntroEnabled && gameplay.sourceTutorialActivationEnabled
        tutorialOwner?.onChanged = { [weak self] state in self?.record(state);_ = self?.saveCurrent() }
        tutorialOwner?.onFeedback = { [weak self] in self?.routeFeedback("cta") }
        tutorialOwner?.onSourceCTAContact = { [weak self] in self?.resultMoment("cta",index:0,duration:nil) }
    }
    private func flush() throws {
        // Source lifecycle saves do not finish an in-flight gameplay phase.
        // record's source guard retains its last durable coherent run while
        // preferences/progression can still be written atomically below.
        if let gameplay,!attemptCommitted {
            if sourceCanonicalGameplaySaveEnabled {
                // The real lifecycle boundary writes only a coherent current
                // Source board. An active producer veto retains the prior run.
                if sourceCanonicalSaveBinding?.current==true {_=sourceCanonicalSaveBinding?.notify(.lifecycle)}
            } else {record(gameplay.engine.state)}
        }
        envelope.savedAt = Date().timeIntervalSince1970
        try store.save(envelope)
    }
    private func saveCurrent() -> Bool {
        if let gameplay,gameplay.sourcePresentationFailureGeneration == gameplay.engine.state.generation {return false}
        if sourceCanonicalGameplaySaveEnabled,!attemptCommitted {
            guard let binding=sourceCanonicalSaveBinding else{return false}
            return binding.notify(.lifecycle) == .written
        }
        do { try flush(); return true } catch { showError(error.localizedDescription); return false }
    }
    private func completeSourceBoardTransitionClaim() {
        let captured=sourceBoardTransitionClaim;sourceBoardTransitionClaim=nil
        if let captured {_=captured.scope.completeSourceBoardTransition(captured.claim)}
    }
    private func retireBoardTransition() {
        completeSourceBoardTransitionClaim()
        guard let carrier=boardTransition else{return};boardTransition=nil
        soundtrack?.abortBoardTransition(generation:carrier.generation)
        carrier.willMove(toParent:nil);carrier.dispose();carrier.viewIfLoaded?.removeFromSuperview();carrier.removeFromParent()
    }
    private func mountJourneyTransition(_ gameplay:NativeGameplayViewController,board:Int,sourceContinuation:Bool=false,release:@escaping ()->Void) {
        guard !disposed,self.gameplay === gameplay else{return}
        retireBoardTransition()
        if sourceContinuation {
            guard let scope=gameplay.sourceScope,scope.current,let claim=scope.beginSourceBoardTransition() else {
                gameplay.boardScene?.onSourcePresentationFailure?("source_board_transition_writer_rejected",gameplay.engine.state.generation);return
            }
            sourceBoardTransitionClaim=(scope,claim)
        }
        let generation=gameplay.engine.state.generation
        let theme=NativeBoardTransitionPlan.Theme(board:board)
        let variation=transitionVariation.next(theme:theme,random:{Double.random(in:0..<1)})
        let carrier=NativeThemedBoardTransitionController(root:root,board:board,viewport:gameplay.view.bounds.size,generation:generation,resources:controller?.world?.gameplayTransitionResources,variation:variation)
        boardTransition=carrier
        gameplay.incomingOriginalThemedCoverExpected=true
        carrier.onOriginalOpaqueCover = {[weak self,weak carrier,weak gameplay] receipt in
            guard let self,let carrier,let gameplay,!self.disposed,self.boardTransition === carrier,
                  self.gameplay === gameplay,receipt==generation,gameplay.engine.state.generation==generation else{return}
            gameplay.acceptIncomingOriginalOpaqueCover()
            self.controller?.world?.releaseGameplayTransitionPreparation()
        }
        carrier.onCue = { [weak self,weak gameplay] kind,index in
            guard let self,let gameplay,!self.disposed,self.gameplay === gameplay,gameplay.engine.state.generation==generation else{return}
            self.audioReceipt &+= 1
            self.audio?.transitionMoment(kind,index:index,receipt:self.audioReceipt,generation:generation)
        }
        carrier.onHaptic = { [weak self,weak gameplay] kind in
            guard let self,let gameplay,self.gameplay === gameplay,gameplay.engine.state.generation==generation else{return}
            self.impactFeedback(kind)
        }
        carrier.onMusicPhase = { [weak self,weak gameplay] phase,ratio,duration in
            guard let self,let gameplay,!self.disposed,self.gameplay === gameplay,
                  gameplay.engine.state.generation==generation else{return}
            self.soundtrack?.boardTransitionPhase(phase,ratio:ratio,duration:duration,generation:generation)
        }
        carrier.onAudioCleanup = { [weak self] aborted in
            self?.audio?.finishTransition(generation:generation,aborted:aborted)
            if aborted {self?.soundtrack?.abortBoardTransition(generation:generation)}
        }
        carrier.onAssetFailure = { [weak self,weak carrier,weak gameplay] in
            guard let self,let gameplay,self.boardTransition === carrier,self.gameplay === gameplay,gameplay.engine.state.generation==generation else{return}
            if gameplay.sourcePresentationFailureGeneration==generation {self.presentSourceFailureRecovery(gameplay);return}
            self.completeSourceBoardTransitionClaim()
            self.showError("The stage artwork could not be prepared. Your progress is saved.")
            if gameplay.retainsOutgoingWorldPaint {self.finishGameplayExit()}
        }
        carrier.onSceneExit = { [weak self,weak carrier,weak gameplay] receipt in
            guard let self,let carrier,let gameplay,!self.disposed,self.boardTransition === carrier,
                  self.gameplay === gameplay,receipt==generation,gameplay.engine.state.generation==generation else{return}
            // Original completeBoardTransitionHandoff clears its flag before
            // starting the incoming board; the retained cover may finish later.
            self.completeSourceBoardTransitionClaim()
            gameplay.prepareBoardEntryArtwork { [weak self,weak carrier,weak gameplay] ready in
                guard let self,let carrier,let gameplay,!self.disposed,self.boardTransition === carrier,
                      self.gameplay === gameplay,gameplay.engine.state.generation==generation else{return}
                guard ready else{self.showError("The stage artwork could not be prepared. Your progress is saved.");return}
                release()
                guard self.boardTransition === carrier,gameplay.engine.state.generation==generation else{return}
                gameplay.whenFirstBoardFrameReady { [weak self,weak carrier,weak gameplay] in
                    guard let self,let carrier,let gameplay,!self.disposed,self.boardTransition === carrier,
                          self.gameplay === gameplay,gameplay.engine.state.generation==generation else{return}
                    self.boardTransition=nil;carrier.willMove(toParent:nil);carrier.releaseCover(generation:generation)
                }
            }
        }
        ambient?.beginJourneyTransition(board:board,generation:routeLease)
        gameplay.addChild(carrier);carrier.view.frame=gameplay.view.bounds;carrier.view.autoresizingMask=[.flexibleWidth,.flexibleHeight]
        gameplay.view.addSubview(carrier.view);carrier.didMove(toParent:gameplay);carrier.start()
    }
    private func mountArcadeEntry(_ gameplay:NativeGameplayViewController,onPresented:(()->Void)?=nil,release:@escaping ()->Void) {
        let generation=gameplay.engine.state.generation
        let round=gameplay.engine.state.board
        let cue=NativeArcadeRoundPresentation(resourceRoot:root,clearedRound:max(1,round-1),nextRound:round,continuationOnly:true)
        arcadeEntryCue?.dispose();arcadeEntryCue=cue
        cue.frame=gameplay.view.bounds;cue.autoresizingMask=[.flexibleWidth,.flexibleHeight];gameplay.view.addSubview(cue)
        cue.onNextRoundPresented = { [weak self,weak gameplay] in
            guard let self,let gameplay,!self.disposed,self.gameplay === gameplay,gameplay.engine.state.generation==generation else {throw CancellationError()}
            onPresented?()
        }
        cue.onCue = { [weak self] event in
            guard self?.gameplay?.engine.state.generation==generation else{return}
            if case .digitEntered(let index)=event {self?.resultMoment("arcade-digit",index:index,duration:nil)}
        }
        cue.onFinished = { [weak self,weak cue,weak gameplay] success in
            guard let self,let gameplay,self.arcadeEntryCue === cue,!self.disposed,
                  self.gameplay === gameplay,gameplay.engine.state.generation==generation else{return}
            self.arcadeEntryCue=nil
            if success {release()}
        }
        soundtrack?.setArcadeGameplay()
        arcadeMusic?.enterRound(generation:generation)
        cue.start()
    }
    private func rebuildSourceGameplay(_ previous:NativeGameplayViewController,board:Int?,entry:FreshGameplayEntry,onReplaced:(()->Void)?=nil) {
        guard !disposed,let controller,controller.canReplaceGameplay(previous),let exit=returnAction,
              self.gameplay === previous,let scope=previous.sourceScope,scope.current else{return}
        if entry.consumesPendingArcade,envelope.pendingArcadeRound==nil{return}
        // One exact entry lease owns the future constructor's foundation.
        // Duplicate CTA requests borrow its work; another request retires it.
        if let pending=initialTexturePreparation,pending.freshEntry==entry,pending.board==board,pending.callerCurrent(){return}
        let generation=previous.engine.state.generation,route=routeLease
        let current:()->Bool = {[weak self,weak previous,weak scope,weak controller] in
            guard let self,let previous,let scope,let controller,!self.disposed,
                  self.controller === controller,self.gameplay === previous,self.routeLease==route,
                  previous.engine.state.generation==generation,previous.sourceScope === scope,
                  scope.current,controller.canReplaceGameplay(previous) else{return false}
            return true
        }
        prepareGameplayEntry(board:board,freshEntry:entry,callerCurrent:current){[weak self,weak previous,weak controller] ready in
            guard let self,let previous,let controller,current() else{return}
            guard ready else {
                if previous.sourcePresentationFailureGeneration==generation {
                    self.presentSourceFailureRecovery(previous);return
                }
                self.finishGameplayExit();self.showError("Unable to prepare Native board resources");return
            }
            self.replacePreparedSourceGameplay(previous,controller:controller,board:board,entry:entry,exit:exit,onReplaced:onReplaced)
        }
    }
    private func replacePreparedSourceGameplay(_ previous:NativeGameplayViewController,controller:NativeAppController,
        board:Int?,entry:FreshGameplayEntry,exit:@escaping()->Void,onReplaced:(()->Void)?=nil) {
        do {
            guard let incoming=try makeGameplay(board:board,exit:exit,freshEntry:entry) as? NativeGameplayViewController else{return}
            guard !disposed,self.gameplay === incoming,controller.canReplaceGameplay(previous),
                  incoming.sourceScope?.current==true,controller.replaceGameplay(previous,with:incoming) else {
                incoming.dispose()
                if self.gameplay === incoming {self.gameplay=nil;returnAction=nil}
                return
            }
            if incoming.engine.state.mode == .arcade {
                arcadeMusic?.enterRound(generation:incoming.engine.state.generation,immediate:entry.isRestart)
            } else if boardTransition == nil {soundtrack?.setJourneyGameplay()}
            onReplaced?()
        } catch {
            if previous.sourcePresentationFailureGeneration==previous.engine.state.generation {
                self.gameplay=previous;self.returnAction=exit
                self.presentSourceFailureRecovery(previous);return
            }
            // No Native-raw fallback on a retired Source generation. Preserve
            // the last durable envelope and return through the current route.
            if controller.canReplaceGameplay(previous) {finishGameplayExit()}
            showError(error.localizedDescription)
        }
    }
    private func restart(origin:NativeGameplayRestartOrigin) {
        guard let gameplay else { return }
        if gameplay.sourceInitialConstruction != nil,gameplay.sourceScope?.current==true {
            rebuildSourceGameplay(gameplay,board:gameplay.engine.state.mode == .arcade ? nil:gameplay.engine.state.board,
                entry:.restart(gameplay.engine.state.generation+1,origin))
            return
        }
        controller?.cancelGameplayReturnPreparation()
        let old = gameplay.engine.state
        attemptCommitted = false
        let tutorial = !envelope.progression.firstPlayTutorialComplete
        gameplay.engine.restart(state: fresh(mode: old.mode, board: tutorial || old.mode == .arcade ? 1 : old.board, generation: old.generation + 1,tutorial:tutorial))
        if tutorial {_ = gameplay.engine.startTutorial()};installTutorial(gameplay)
        audio?.beginGeneration(gameplay.engine.state.generation)
        if old.mode == .arcade {arcadeMusic?.enterRound(generation:gameplay.engine.state.generation,immediate:true)}
        else {soundtrack?.setJourneyGameplay()}
        envelope.progression.beginAttempt(mode: old.mode, board: gameplay.engine.state.board,arcadeVariant:envelope.activeArcadeVariant)
        let entry=old.mode == .arcade && !tutorial ? gameplay.prepareNextBoardEntry():nil
        gameplay.setSuspended(false)
        if entry == nil {gameplay.refreshFromEngine()}
        record(gameplay.engine.state)
        guard saveCurrent() else{return}
        if let entry {
            if origin.skipsBoardAnnouncement {entry()}
            else {mountArcadeEntry(gameplay,release:entry)}
        }
    }
    private var sourceNoMovesResultCapture:NativeSourceNoMovesCompletedReceipt?
    private weak var sourceNoMovesResultGameplay:NativeGameplayViewController?
    private var sourceNoMovesShownCue:String?
    private weak var sourceNoMovesShownGameplay:NativeGameplayViewController?
    /// Mandatory Source NoMoves Scene visibleShowCue binding. The constructor
    /// invokes this only after original glyphs mount and BEFORE cloud RNG.
    /// The shared result audio owner retains Settings/interruption/voice policy.
    private func sourceNoMovesVisibleShow(generation:UInt64,planToken:UInt64) {
        guard let gameplay,!disposed,gameplay.engine.state.generation==generation,
            gameplay.engine.stagedSourceNoMoves,
            gameplay.engine.pendingSourceNoMoves?.token==planToken else{return}
        let key="\(generation):\(planToken)"
        // Generation/token are local to a Core run, so independent gameplay
        // instances can legitimately reuse them. Dedup only this live owner.
        guard sourceNoMovesShownGameplay !== gameplay || sourceNoMovesShownCue != key else{return}
        sourceNoMovesShownGameplay=gameplay
        sourceNoMovesShownCue=key
        audioReceipt &+= 1
        audio?.resultMoment("no-moves",receipt:audioReceipt,generation:generation)
    }
    /// Binds ONLY genuine existing APP owners. The caller must supply Source's
    /// exact idle scheduler, marker refresh, hint, guard/recheck queues and lazy
    /// wall-TTL fields. Missing owners never receive guessed/no-op substitutes.
    /// This factory does not enable Core/Scene/VC Source NoMoves flags.
    private func bindSourceNoMovesNativeCallbacks(gameplay:NativeGameplayViewController,
        required:NativeSourceNoMovesSceneBindings,
        stopTileIdle:@escaping()->Void,restartTileIdle:@escaping()->Void)->NativeSourceNoMovesSceneBindings? {
        guard self.gameplay === gameplay,let scope=gameplay.sourceScope,scope.current else{return nil}
        let generation=gameplay.engine.state.generation
        let current:()->Bool = { [weak self,weak gameplay,weak scope] in
            guard let self,let gameplay,let scope,!self.disposed,self.gameplay === gameplay,
                gameplay.engine.state.generation==generation,gameplay.sourceScope === scope,
                scope.current,gameplay.boardScene?.sourceAnimationBindingAdmissionOpen==true else{return false}
            return true
        }
        var result=required
        let externalAdmission=required.admitted
        result.admitted={gen in
            guard gen==generation,current() else{return false}
            let admitted=externalAdmission(gen)
            return admitted && current()
        }
        result.visibleShowCue={ [weak self] gen,token in
            guard current(),gen==generation else{return}
            self?.sourceNoMovesVisibleShow(generation:gen,planToken:token)
        }
        result.stopIdleAndIdleSmoke={ [weak scope] in
            guard current() else{return};stopTileIdle()
            guard current() else{return};scope?.smoke.cleanup(tag:"tile-idle-smoke")
        }
        result.restartIdle={guard current() else{return};restartTileIdle()}
        result.persistStuckState={ [weak self,weak gameplay] in
            guard current(),let self,let gameplay else{return}
            if self.sourceCanonicalGameplaySaveEnabled {
                _=self.sourceCanonicalSaveBinding?.notify(.noMovesPersistStuck)
                return // missing genuine binding refuses; no Raw flush substitute
            }
            self.record(gameplay.engine.state)
            // Literal persist-stuck try/catch does not add a modal on failure.
            do {try self.flush()} catch {}
        }
        return result
    }
    private func terminal(_ resolution: NativeResolution) {
        guard let gameplay, !attemptCommitted,gameplay.sourcePresentationFailureGeneration != gameplay.engine.state.generation,
            resolution.kind == .complete || resolution.kind == .fail else { return }
        let sourceReceipt=gameplay.engine.completedSourceNoMovesReceipt
        if let sourceReceipt {
            guard sourceReceipt.admits(generation:gameplay.engine.state.generation,resolution:resolution),
                gameplay.engine.state.terminal==resolution,
                sourceNoMovesResultGameplay !== gameplay || sourceNoMovesResultCapture != sourceReceipt else{return}
            sourceNoMovesResultGameplay=gameplay
            sourceNoMovesResultCapture=sourceReceipt
        } else if gameplay.engine.stagedSourceNoMoves && resolution.kind == .fail {
            // No implicit generic fallback for unsupported Source caller paths.
            return
        }
        ambient?.cleanResidualFinished(generation:routeLease)
        boardEntryHaptics?.dispose();boardEntryHaptics=nil
        if resolution.kind == .complete,gameplay.engine.state.tutorial?.requiresResultCompletion == true {
            presentTutorialComplete(gameplay);return
        }
        // NativeResultOwner commits rewards and progression atomically before presenting.
        if resolution.kind == .fail,failHapticGeneration != gameplay.engine.state.generation {
            failHapticGeneration=gameplay.engine.state.generation
            impactFeedback(gameplay.engine.state.mode == .arcade && gameplay.engine.state.board>=2 ? "medium":"notification-error")
        }
        resultOwner = NativeResultOwner(gameplay: gameplay, root: root, resolution: resolution,
            commit: { [weak self] score in try self?.commitResult(score: score, clean: resolution.kind == .complete) },
            restart: { [weak self] in self?.restart(origin:resolution.kind == .fail ? .failPlayAgain:.result) },
            continueArcade: { [weak self] in self?.continueArcade() },
            exit: { [weak self] in self?.exitGameplay() },
            interimJourney:interimJourney,rewardScore:envelope.progression.boardStats[gameplay.engine.state.board]?.highScore,
            continueJourney:{[weak self] in self?.continueJourney()},sourceNoMovesReceipt:sourceReceipt,
            previousRewardStars:envelope.progression.journeyStars(board:gameplay.engine.state.board))
        if let sourceReceipt,let endpoint=gameplay.sourceNoMovesTerminalRegistry {
            resultOwner?.onSourceFinalCleanup={ [weak gameplay,weak endpoint] receipt in
                guard receipt==sourceReceipt,let gameplay,let endpoint else{return}
                _=gameplay.sourceConfirmedFailFinalCleanup(receipt:receipt,endpoint:endpoint)
            }
        }
        let resultAmbientGeneration=routeLease
        resultOwner?.onForestAmbience = { [weak self] active,suspended in
            guard let self,self.routeLease==resultAmbientGeneration else{return}
            self.ambient?.setForestResult(active:active,suspended:suspended,generation:resultAmbientGeneration)
        }
        resultOwner?.onMoment = { [weak self] kind,index,duration in self?.resultMoment(kind,index:index,duration:duration) }
        resultOwner?.prepareExit = { [weak self] completion in
            guard let self,!self.disposed,let controller=self.controller else {completion(false);return}
            controller.prepareGameplayReturn { [weak self,weak controller] ready in
                guard let self,!self.disposed,let controller,self.controller === controller else {completion(false);return}
                completion(ready && controller.hideGameplayForPreparedReturn())
            }
        }
        resultOwner?.onError = { [weak self] error in self?.showError(error.localizedDescription) }
        resultOwner?.onHaptic = { [weak self] style in self?.impactFeedback(style) }
        if gameplay.engine.state.mode == .arcade {arcadeMusic?.setResultMix(generation:gameplay.engine.state.generation)}
        resultOwner?.present()
    }
    private func commitResult(score: Int, clean: Bool) throws {
        guard let gameplay, !attemptCommitted else { return }
        guard gameplay.sourcePresentationFailureGeneration != gameplay.engine.state.generation else{return}
        let state = gameplay.engine.state
        var next = envelope
        next.progression.finishAttempt(mode: state.mode, board: state.board, score: score,
            longestCombo: state.longestCombo, cubesCracked: state.cubesCracked, clean: clean,arcadeVariant:state.effectiveArcadeVariant)
        // The existing Flower grant commits with the completed board, independently
        // of card presentation or acknowledgement.
        if clean,interimJourney,state.mode == .journey,state.board == 2 {
            next.progression.unlockedSpecialDice.insert("flower")
        }
        if state.mode == .journey { next.journeyRuns.removeValue(forKey: state.board); next.journeyRunSavedAt.removeValue(forKey: state.board) }
        else {
            next.arcadeRun = nil; next.arcadeRunSavedAt = nil
            if clean { next.pendingArcadeRound = .init(round:state.board+1,score:score,ownerID:"native-\(state.generation)-\(state.revision)",meterProgress:state.effectiveArcadeVariant == .slowBurn ? state.wildMeter:nil,lastSpecialMergeWorld:state.lastSpecialMergeWorld) }
        }
        next.savedAt = Date().timeIntervalSince1970
        try store.save(next); envelope = next; attemptCommitted = true;committedScore=score
    }
    private func presentTutorialComplete(_ gameplay:NativeGameplayViewController) {
        guard tutorialComplete==nil,let controller else{return}
        tutorialOwner?.dispose();tutorialOwner=nil;gameplay.setSuspended(true)
        let generation=gameplay.engine.state.generation,mode=gameplay.engine.state.mode
        let sheet=NativeTutorialCompleteController(resourceRoot:root);tutorialComplete=sheet
        controller.addChild(sheet);sheet.view.frame=controller.view.bounds;sheet.view.autoresizingMask=[.flexibleWidth,.flexibleHeight]
        controller.view.addSubview(sheet.view);sheet.didMove(toParent:controller)
        routeFeedback("modal-open")
        sheet.onMoment = { [weak self] kind,_ in
            if kind == "tutorial-complete-selection" {self?.routeFeedback("cta",includesHaptic:false);self?.selectionFeedback()}
            else {self?.impactFeedback(kind.hasSuffix("medium") ? "medium" : "light")}
        }
        sheet.onContinue = { [weak self,weak sheet] in
            guard let self,let sheet,!self.disposed,self.tutorialComplete === sheet,self.gameplay?.engine.state.generation==generation else{return}
            self.routeFeedback("modal-exit")
            do {
                var next=self.envelope;next.progression.firstPlayTutorialComplete=true
                next.progression.boardStats.removeValue(forKey:gameplay.engine.state.board);next.progression.resetArcadeStats(for:next.activeArcadeVariant)
                next.journeyRuns.removeValue(forKey:gameplay.engine.state.board);next.journeyRunSavedAt.removeValue(forKey:gameplay.engine.state.board)
                next.arcadeRun=nil;next.arcadeRunSavedAt=nil;next.pendingArcadeRound=nil;next.savedAt=Date().timeIntervalSince1970
                try self.store.save(next);self.envelope=next;self.attemptCommitted=true
            } catch {self.showError(error.localizedDescription);return}
            let release:()->Void = { [weak self,weak sheet] in
                guard let self,let sheet,self.tutorialComplete === sheet else{return}
                self.tutorialComplete=nil;sheet.dispose();sheet.willMove(toParent:nil);sheet.view.removeFromSuperview();sheet.removeFromParent()
            }
            if mode == .journey {
                self.endRun?.dispose();self.endRun=nil;self.scoreOwner?.dispose();self.scoreOwner=nil
                self.gameplay=nil;self.returnAction=nil;self.controller?.returnTutorialToHome(onPrepared:release)
            } else {
                if gameplay.sourceInitialConstruction != nil,gameplay.sourceScope?.current==true {
                    self.rebuildSourceGameplay(gameplay,board:nil,entry:.tutorialCompletion(generation+1),onReplaced:release)
                    return
                }
                let state=self.fresh(mode:.arcade,board:1,generation:generation+1)
                gameplay.engine.restart(state:state);self.attemptCommitted=false;self.committedScore=nil
                self.audio?.beginGeneration(state.generation);self.arcadeMusic?.enterRound(generation:state.generation,immediate:true)
                self.envelope.progression.beginAttempt(mode:.arcade,board:1,arcadeVariant:self.envelope.activeArcadeVariant);self.record(state);_ = self.saveCurrent()
                let boardEntry=gameplay.prepareNextBoardEntry()
                if boardEntry == nil {gameplay.refreshFromEngine()}
                self.mountArcadeEntry(gameplay,onPresented:release) {
                    gameplay.setSuspended(false);boardEntry?()
                }
            }
        }
    }
    private func continueArcade() {
        guard let gameplay, let pending = envelope.pendingArcadeRound else { return }
        if gameplay.sourceInitialConstruction != nil,gameplay.sourceScope?.current==true {
            rebuildSourceGameplay(gameplay,board:nil,entry:.arcadeContinuation(gameplay.engine.state.generation+1))
            return
        }
        var state = fresh(mode: .arcade, board: pending.round, generation: gameplay.engine.state.generation + 1)
        state.lastSpecialMergeWorld = pending.lastSpecialMergeWorld
        state.score = pending.score; state.wildMeter = envelope.activeArcadeVariant == .pureDice ? 0 : (pending.meterProgress ?? 0.25)
        gameplay.engine.restart(state: state); attemptCommitted = false
        audio?.beginGeneration(gameplay.engine.state.generation)
        arcadeMusic?.enterRound(generation:gameplay.engine.state.generation)
        envelope.pendingArcadeRound = nil; envelope.progression.beginAttempt(mode:.arcade,board:pending.round,arcadeVariant:envelope.activeArcadeVariant)
        gameplay.setSuspended(false); gameplay.refreshFromEngine(); record(gameplay.engine.state)
        _ = saveCurrent()
    }
    private func continueJourney() {
        guard let gameplay,attemptCommitted,gameplay.engine.state.mode == .journey else{return}
        controller?.cancelGameplayReturnPreparation()
        let old=gameplay.engine.state,next=old.board+1
        guard next<=30,envelope.progression.isPlayable(board:next) else{exitGameplay();return}
        if gameplay.sourceInitialConstruction != nil,gameplay.sourceScope?.current==true {
            rebuildSourceGameplay(gameplay,board:next,entry:.journeyContinuation(old.generation+1,committedScore ?? old.score))
            return
        }
        var state=fresh(mode:.journey,board:next,generation:old.generation+1)
        state.score=committedScore ?? old.score
        gameplay.engine.restart(state:state);attemptCommitted=false;interimJourney = !envelope.progression.completedJourneyBoards.contains(next)
        lastReturnBoard=next;audio?.beginGeneration(state.generation)
        envelope.progression.beginAttempt(mode:.journey,board:next)
        let entry=gameplay.prepareNextBoardEntry()
        gameplay.setSuspended(false)
        if entry == nil {gameplay.refreshFromEngine();soundtrack?.setJourneyGameplay()}
        record(state)
        guard saveCurrent() else{return}
        if let entry {mountJourneyTransition(gameplay,board:next,release:entry)}
    }
    private func exitGameplay() {
        guard saveCurrent() else { return }
        finishGameplayExit()
    }
    private func presentSourceFailureRecovery(_ captured:NativeGameplayViewController) {
        guard !disposed,gameplay === captured,sourceFailureModal == nil else{return}
        // A rejected physical phase is not a navigation instruction. Keep its
        // exact sealed engine and painted board until an explicit user choice.
        // Never serialize this partially committed phase or replay its closures.
        let generation=captured.engine.state.generation
        captured.setSuspended(true)
        endRun?.dispose();endRun=nil;scoreOwner?.dispose();scoreOwner=nil
        resultOwner?.dispose();resultOwner=nil;tutorialOwner?.dispose();tutorialOwner=nil
        guard let model=JimiNativeEndRunModel(["title":"Replay board?",
            "subtitle":"This board could not continue.\nReplay starts this round again.",
            "restartLabel":"Replay Board","exitLabel":"Exit"]) else{return}
        sourceFailureModalEpoch += 1;let epoch=sourceFailureModalEpoch
        let sheet=JimiNativeEndRunModal(id:epoch,model:model,assets:JimiV9Artwork(resourceRoot:root),dismissalAllowed:false)
        sheet.loadViewIfNeeded()
        sheet.buttons[0].isEnabled=controller?.canReplaceGameplay(captured)==true && captured.sourceScope?.current==true && captured.sourceInitialConstruction != nil
        sourceFailureModal=sheet
        sourceFailureObservers=[
            NotificationCenter.default.addObserver(forName:UIApplication.willResignActiveNotification,object:nil,queue:.main){[weak sheet] _ in
                MainActor.assumeIsolated{sheet?.suspend()}
            },
            NotificationCenter.default.addObserver(forName:UIApplication.didBecomeActiveNotification,object:nil,queue:.main){[weak sheet] _ in
                MainActor.assumeIsolated{sheet?.resume()}
            }
        ]
        sheet.onAction={ [weak self,weak captured,weak sheet] action in
            guard let self,let captured,let sheet,!self.disposed,self.gameplay === captured,
                captured.engine.state.generation==generation,self.sourceFailureModalEpoch==epoch,
                self.sourceFailureModal === sheet,["restart","exit"].contains(action),!sheet.closing else{return}
            if action == "restart" {
                guard self.controller?.canReplaceGameplay(captured)==true,captured.sourceScope?.current==true,
                    captured.sourceInitialConstruction != nil else{sheet.buttons[0].isEnabled=false;sheet.actionRejected();return}
            }
            self.routeFeedback(action == "restart" ? "cta":"back")
            self.routeFeedback("modal-exit")
            sheet.onClosed={ [weak self,weak captured,weak sheet] in
                guard let self,let captured,let sheet,!self.disposed,self.gameplay === captured,
                    captured.engine.state.generation==generation,self.sourceFailureModalEpoch==epoch,
                    self.sourceFailureModal === sheet else{return}
                self.retireSourceFailureRecovery()
                if action == "restart" {self.restart(origin:.exitMenu)}
                else {self.finishGameplayExit()}
            }
            sheet.closeFromOwner()
        }
        // The incoming Scene may fail before its first-frame replacement
        // receipt. Present above the mounted host, not its still-covered child.
        let presenter=host ?? captured
        if let presented=presenter.presentedViewController ?? captured.presentedViewController {
            presented.dismiss(animated:false){[weak self,weak captured,weak sheet] in
                guard let self,let captured,let sheet,!self.disposed,self.gameplay === captured,
                    self.sourceFailureModal === sheet,captured.engine.state.generation==generation else{return}
                self.routeFeedback("modal-open")
                (self.host ?? captured).present(sheet,animated:false)
            }
        } else {routeFeedback("modal-open");presenter.present(sheet,animated:false)}
    }
    private func retireSourceFailureRecovery() {
        sourceFailureModalEpoch += 1
        for observer in sourceFailureObservers {NotificationCenter.default.removeObserver(observer)}
        sourceFailureObservers.removeAll()
        let sheet=sourceFailureModal;sourceFailureModal=nil
        sheet?.dispose();sheet?.dismiss(animated:false)
    }
    private func finishGameplayExit() {
        retireSourceFailureRecovery()
        haptics.cancelSequences()
        cancelGameplayEntryPreparation()
        retireSourceTutorialMeterRequest()
        endRun?.dispose();endRun=nil;scoreOwner?.dispose();scoreOwner=nil;tutorialOwner?.dispose();tutorialOwner=nil;resultOwner?.dispose();resultOwner=nil
        boardEntryHaptics?.dispose();boardEntryHaptics=nil
        tutorialComplete?.dispose();tutorialComplete?.view.removeFromSuperview();tutorialComplete?.removeFromParent();tutorialComplete=nil
        arcadeEntryCue?.dispose();arcadeEntryCue=nil
        retireBoardTransition()
        gameplay = nil; let action = returnAction; returnAction = nil; action?()
    }
    private func routeFeedback(_ kind:String,haptic:String?=nil,includesHaptic:Bool=true) {
        audioReceipt &+= 1
        if kind != "home-haptic-enter" {audio?.routeFeedback(kind == "tab-swipe" ? "tab":kind,receipt:audioReceipt,generation:audio?.generation ?? 1)}
        if kind == "modal-open" || kind == "modal-exit" {return}
        guard includesHaptic else{return}
        if let haptic {impactFeedback(haptic == "selection" || haptic.hasPrefix("protected-") ? haptic:"protected-\(haptic)")}
        else if kind == "home-haptic-enter",let controller {
            let capturedRoute=routeLease
            haptics.play(NativeHapticPatterns.home,in:controller.view) {[weak self,weak controller] in
                self?.disposed==false && self?.routeLease==capturedRoute && self?.controller === controller && controller?.route == .home
            }
        } else if ["cta","tab","back","modal-close","card-tap","card-manual-flip","hud-modal-open","exit-modal"].contains(kind) {
            // Accepted navigation is a human contact, not a decorative burst.
            // Home enter/merge beats must not exhaust later World/Back/Close taps.
            if kind == "cta",case .world = controller?.route {impactFeedback("protected-medium")}
            else {impactFeedback("protected-light")}
        }
    }
    private func resultMoment(_ kind:String,index:Int,duration:Double?) {
        audioReceipt &+= 1
        if ["cta","back","modal-open","modal-exit","modal-close"].contains(kind) {
            audio?.routeFeedback(kind,receipt:audioReceipt,generation:audio?.generation ?? 1);return
        }
        if ["clean-star","clean-hero","clean-cta"].contains(kind) {impactFeedback("medium")}
        var release:(()->Void)?
        if kind == "clean-sax" || kind == "fail-sax" {
            if let state=gameplay?.engine.state,state.mode == .arcade {release=arcadeMusic?.beginResultHook(generation:state.generation)}
            else {release=soundtrack?.beginResultHook()}
        }
        audio?.resultMoment(kind,index:index,receipt:audioReceipt,generation:audio?.generation ?? 1,duration:duration,onFinished:release)
    }
    private func selectionFeedback() {haptics.emit("selection")}
    private func impactFeedback(_ style:String) {
        let protected=style.hasPrefix("protected-")
        haptics.emit(protected ? String(style.dropFirst("protected-".count)):style,protected:protected)
    }
    private func gameplayHaptic(_ event:NativeGameplayEvent,source:NativeTile?,destination:NativeTile?,generation:UInt64) {
        guard let gameplay,!disposed,gameplay.engine.state.generation==generation,
              gameplay.sourcePresentationFailureGeneration != generation else{return}
        if event.kind == .specialReserved,let id=event.reason {
            specialHapticTargetCounts[id]=event.tileIDs.count
        }
        if event.kind == .ordinarySixReserved {
            ordinarySixHapticContact=event.reason;impactFeedback("protected-medium");return
        }
        if event.kind == .merged,let value=event.value,(1..<6).contains(value) {
            impactFeedback("stack-contact");return
        }
        if event.kind == .merged,event.value==6 {
            if let id=ordinarySixHapticContact,id==event.reason {ordinarySixHapticContact=nil;return}
            playGameplayHaptics(NativeHapticPatterns.mergeSix(source:source,destination:destination,event:event),gameplay:gameplay,generation:generation)
        } else if event.kind == .specialBoardCommitted,let id=event.reason {
            let count=specialHapticTargetCounts.removeValue(forKey:id) ?? 0
            if event.archetype == .magnet {playGameplayHaptics(NativeHapticPatterns.magnetPull(count:count),gameplay:gameplay,generation:generation)}
        }
    }
    private func playGameplayHaptics(_ beats:[NativeHapticRuntime.Beat],gameplay:NativeGameplayViewController,generation:UInt64) {
        haptics.play(beats,in:gameplay.view) {[weak self,weak gameplay] in
            guard let self,let gameplay else{return false}
            return !self.disposed && self.gameplay === gameplay && gameplay.engine.state.generation==generation &&
                gameplay.sourcePresentationFailureGeneration != generation && self.controller?.route == .gameplay
        }
    }
    private func showError(_ text: String) {
        #if DEBUG
        NSLog("[NativeBootstrap] admission failed: %@",text)
        #endif
        guard let host else { return }
        errorLabel.text = text; errorLabel.numberOfLines = 0; errorLabel.textAlignment = .center
        errorLabel.textColor = .systemRed; errorLabel.backgroundColor = host.view.backgroundColor
        errorLabel.frame = host.view.bounds.insetBy(dx:24,dy:80)
        errorLabel.autoresizingMask = [.flexibleWidth,.flexibleHeight]
        errorLabel.accessibilityIdentifier = "native.profile.error"
        host.view.addSubview(errorLabel)
    }
    func launchDeveloperBoard(_ board: Int) { controller?.launchDeveloperBoard(board) }

    private func openDeveloperAction(_ action: NativeDeveloperAction, presenter: UIViewController) throws {
        guard !disposed, let app = presenter as? NativeAppController,
              app.route == .settings, app.settingsView.developerPanelVisible else { return }
        let epoch = app.settingsView.presentationEpoch
        let current: () -> Bool = { [weak self, weak app] in
            guard let self, let app else { return false }
            return !self.disposed && app.admitsDeveloperAction(epoch: epoch)
        }
        let board = max(1,min(30,envelope.progression.lastOpenedJourneyBoard ?? 1))
        switch action {
        case .show, .hide, .legendary, .reset:
            var choices = (1...30).map { NativeDeveloperPicker.Choice(title: "\(["Forest","Beach","Area 55"][($0-1)/10]) \(String(format: "%02d",($0-1)%10+1))",value: String($0)) }
            if action == .reset { choices.append(.init(title: "Arcade",value: "arcade")) }
            let picker = NativeDeveloperPicker(root: root,title: action.title,choices: choices,multiple: action != .legendary)
            picker.onSelect = { [weak self, weak presenter] values in
                guard let self, let presenter, current() else { return }
                do {
                    if action == .legendary, let selected = values.compactMap(Int.init).first {
                        self.presentDeveloperReward(board: selected, score: 10000, presenter: presenter)
                    } else { try self.applyDeveloperProgress(action, values: values) }
                } catch { self.showError(error.localizedDescription) }
            }
            picker.onCloseRequested = {[weak self] in self?.routeFeedback("modal-close")}
            routeFeedback("modal-open");presenter.present(picker,animated: false)
        case .newCard:
            presentDeveloperReward(board: board,score: envelope.progression.boardStats[board]?.highScore ?? 0,presenter: presenter)
        case .clean:
            let state = NativeBoardState(tiles: [],board: board,stage: board,score: 2500)
            let preview = NativeResultController(root: root,state: state,clean: true,combo: 0,efficiency: 500,finalScore: 3000)
            preview.onCommit = {} // Authored result presentation, no attempt commit.
            let host = NativeDeveloperPreviewHost(preview: preview,release: { [weak preview] in preview?.dispose() })
            preview.onAction = { [weak host] _ in host?.finish() }
            presenter.present(host,animated: false)
        case .lastMerge:
            let cores = NativeWildArchetype.allCases.map { NativeDeveloperPicker.Choice(title: String(describing: $0).capitalized,value: $0.rawValue) }
            let variants = NativeSpecialDiceRegistry.variants.values.sorted { $0.id < $1.id }.map { NativeDeveloperPicker.Choice(title: $0.id,value: $0.id) }
            let picker = NativeDeveloperPicker(root: root,title: "Last Merge",choices: cores+variants,multiple: false)
            picker.onSelect = { [weak self, weak presenter] values in
                guard let self, let presenter, current(), let choice = values.first else { return }
                do { presenter.present(try self.makeDeveloperLastMerge(board: board,choice: choice),animated: false) }
                catch { self.showError(error.localizedDescription) }
            }
            picker.onCloseRequested = {[weak self] in self?.routeFeedback("modal-close")}
            routeFeedback("modal-open");presenter.present(picker,animated: false)
        }
    }
    private func presentDeveloperReward(board: Int, score: Int, presenter: UIViewController) {
        let stars=envelope.progression.completedJourneyBoards.contains(board) ? envelope.progression.journeyStars(board:board):NativeJourneyContent.earnedStars(score:score,board:board)
        let preview = NativeJourneyRewardController(root: root,board: board,score: score,generation: routeLease,awardedStars:stars)
        // DEV previews use the same semantic audio/settings owner as real rewards.
        preview.onSoundMoment = { [weak self] kind,index,_ in
            guard let self,!self.disposed else{return}
            self.resultMoment(kind,index:index,duration:nil)
        }
        let host = NativeDeveloperPreviewHost(preview: preview,release: { [weak self,weak preview] in
            preview?.dispose(notify:false)
            self?.audio?.stopRewardPreviewSounds()
        })
        preview.onFinish = { [weak host] _ in host?.finish() }
        presenter.present(host,animated: false)
    }
    /// Selected DEV mutations commit one complete document before publishing it.
    func applyDeveloperProgress(_ action: NativeDeveloperAction, values: Set<String>) throws {
        guard [.show,.hide,.reset].contains(action), !disposed else { return }
        var next = envelope
        for board in values.compactMap(Int.init) where (1...30).contains(board) {
            switch action {
            case .show:
                next.progression.completedJourneyBoards.insert(board)
                // Explicit DEV reveal also exposes this Unit's collection reward.
                if let id=NativeJourneyContent.introductionID(board:board) {
                    next.progression.announceJourneyDie(id,board:board)
                }
            case .hide:
                next.progression.resetDeveloperJourneyDieAnnouncement(board:board)
                next.progression.completedJourneyBoards.remove(board); next.progression.viewedJourneyBoards.remove(board)
                next.progression.boardStats.removeValue(forKey: board)
                if next.progression.lastOpenedJourneyBoard == board {next.progression.lastOpenedJourneyBoard=nil}
                if board == 3 {next.progression.unlockedSpecialDice.remove("flower")}
                if board == 11 {next.progression.unlockedSpecialDice.remove("juice")}
            case .reset:
                next.progression.boardStats.removeValue(forKey: board); next.journeyRuns.removeValue(forKey: board)
                next.journeyRunSavedAt.removeValue(forKey: board)
            default: break
            }
        }
        if action == .reset, values.contains("arcade") {
            next.arcadeRun = nil; next.pendingArcadeRound = nil; next.arcadeRunSavedAt = nil; next.progression.resetArcadeStats(for:next.activeArcadeVariant)
        }
        next.progression.highestUnlockedJourneyBoard = max(1,next.progression.completedJourneyBoards.max() ?? 1)
        if action == .hide,values.compactMap(Int.init).contains(where:{(1...10).contains($0)}) {
            next.progression.reconcileDeveloperWildStarUnlock()
        }
        next.savedAt = Date().timeIntervalSince1970
        try store.save(next); envelope = next
    }
    func makeDeveloperLastMerge(board: Int, choice: String) throws -> UIViewController {
        let variant = NativeSpecialDiceRegistry.variants[choice]
        guard let archetype = variant?.archetype ?? NativeWildArchetype(rawValue: choice) else { throw NativeSaveError.invalidState(["developer-wild-choice"]) }
        // This synthetic final pair represents an already-played run.
        // Preserve it through the normal untouched-layout admission policy.
        let state = NativeBoardState(tiles: [
            NativeTile(id: "dev-regular",cell: .init(column: 2,row: 4),value: 5),
            NativeTile(id: "dev-wild",cell: .init(column: 3,row: 4),value: 6,archetype: archetype,variant: variant?.id)
        ],board: board,stage: board,moves:49)
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("stacktosix-dev-\(UUID().uuidString)",isDirectory: true)
        let previewStore = NativeSaveStore(directory: directory)
        do {
            var profile = NativeSaveEnvelope(settings: envelope.settings,journeyRuns: [board: state])
            profile.settings.musicEnabled = false
            profile.progression.firstPlayTutorialComplete = true
            profile.progression.completedJourneyBoards = Set(1..<board)
            profile.progression.lastOpenedJourneyBoard = board
            try previewStore.save(profile)
            let child = try NativeBootstrap(root: root,store: previewStore,showStudioIntro: false,sourceContext: sourceContext,ownsSourceContext: false)
            child.completeNativeGameplayEnabled = completeNativeGameplayEnabled
            child.sourceCanonicalGameplaySaveEnabled = sourceCanonicalGameplaySaveEnabled
            child.sourceInitialRegularResumeEnabled = sourceInitialRegularResumeEnabled
            child.sourceInitialWildResumeEnabled = sourceInitialWildResumeEnabled
            child.sourceRestoredOrdinaryPresentationEnabled = sourceRestoredOrdinaryPresentationEnabled
            child.sourceFreshOrdinaryPresentationEnabled = sourceFreshOrdinaryPresentationEnabled
            child.sourceInitialFreshStartupEnabled = sourceInitialFreshStartupEnabled
            child.sourceBoardEntryEnabled = sourceBoardEntryEnabled
            child.sourceLogicalMathRandomEnabled = sourceLogicalMathRandomEnabled
            child.sourceOrdinaryPresentationEnabled = sourceOrdinaryPresentationEnabled
            child.sourceDirectPresentationEnabled = sourceDirectPresentationEnabled
            child.sourceMagnetPresentationEnabled = sourceMagnetPresentationEnabled
            child.sourceTntPresentationEnabled = sourceTntPresentationEnabled
            child.sourceOrdinaryEndgamePresentationEnabled = sourceOrdinaryEndgamePresentationEnabled
            child.sourceSpecialIdlePresentationEnabled = sourceSpecialIdlePresentationEnabled
            child.sourceWildShimmerPresentationEnabled = sourceWildShimmerPresentationEnabled
            return NativeDeveloperGameplayHost(bootstrap: child,directory: directory,board: board)
        } catch { try? FileManager.default.removeItem(at: directory); throw error }
    }

    func dispose() {
        guard !disposed else{return};disposed = true
        retireSourceFailureRecovery()
        haptics.dispose()
        cancelGameplayEntryPreparation()
        retireSourceTutorialMeterRequest();sourceTutorialMeterResources?.dispose();sourceTutorialMeterResources=nil
        sourceCanonicalSaveEpoch &+= 1;let save=sourceCanonicalSaveBinding;sourceCanonicalSaveBinding=nil;save?.retire()
        exporter?.cancel();exporter = nil;endRun?.dispose();endRun = nil
        scoreOwner?.dispose();scoreOwner=nil;tutorialOwner?.dispose();tutorialOwner=nil
        boardEntryHaptics?.dispose();boardEntryHaptics=nil
        tutorialComplete?.dispose();tutorialComplete?.view.removeFromSuperview();tutorialComplete?.removeFromParent();tutorialComplete=nil
        arcadeEntryCue?.dispose();arcadeEntryCue=nil
        retireBoardTransition()
        resultOwner?.dispose();resultOwner = nil;gameplay?.dispose();gameplay = nil
        if ownsSourceContext { sourceContext.dispose() }
        audio?.dispose();ambient?.dispose();arcadeMusic?.dispose();soundtrack?.dispose()
        controller?.dispose();controller?.willMove(toParent:nil)
        controller?.view.removeFromSuperview();controller?.removeFromParent();controller = nil
        errorLabel.removeFromSuperview();returnAction = nil;host = nil
    }
}
