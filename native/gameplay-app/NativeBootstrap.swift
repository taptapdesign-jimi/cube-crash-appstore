import UIKit
import StackToSixGameplay
import StackToSixNativeState

/// Owns the native profile and connects Swift services to the native surfaces.
/// The migration exporter is retired before any gameplay route is admitted.
@MainActor
final class NativeBootstrap {
    private let root: URL
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
    private var endRun: NativeEndRunOwner?
    private var scoreOwner:NativeScoreOwner?
    private var tutorialOwner:NativeTutorialOwner?
    private weak var gameplay: NativeGameplayViewController?
    private weak var host: UIViewController?
    private var controller: NativeAppController?
    private var returnAction: (() -> Void)?
    private var resultOwner: NativeResultOwner?
    private var lastReturnBoard: Int?
    private var attemptCommitted = false
    private var interimJourney=false
    private var committedScore:Int?
    private var specialUnlock:NativeSpecialDiceUnlockController?
    private var boardEntryHaptics:NativeBoardEntryHaptics?
    private var tutorialComplete:NativeTutorialCompleteController?
    private var arcadeEntryCue:NativeArcadeRoundPresentation?
    private var boardTransition:NativeThemedBoardTransitionController?
    private let transitionVariation=NativeThemedTransitionVariationOwner()
    private let errorLabel = UILabel()
    private var disposed = false

    init(root: URL, store: NativeSaveStore? = nil) throws {
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
            let exporter = NativeHybridExport(); self.exporter = exporter
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
        services.ambient = { [weak self] world, viewport, ids in
            self?.layouts.nextAmbient(world: world, top: viewport.minY, bottom: viewport.maxY, ids: ids)
        }
        services.bees = { [weak self] ids in self?.layouts.nextBees(ids: ids) }
        services.requiresTutorial = { [weak self] in self?.envelope.progression.firstPlayTutorialComplete == false }
        let controller = NativeAppController(resourceRoot: root, services: services)
        self.controller = controller
        let transport = JimiNativeMusic(root:root)
        soundtrack = NativeSoundtrackRouteOwner(root: root,transport:transport)
        arcadeMusic = NativeArcadeMusicOwner(transport:transport)
        audio = NativeGameplayAudioOwner(root:root,enabled:envelope.settings.gameSoundsEnabled)
        ambient = NativeJourneyAmbientOwner(root:root,enabled:envelope.settings.gameSoundsEnabled)
        soundtrack?.onError = { [weak self] detail in self?.showError(detail) }
        soundtrack?.apply(enabled: envelope.settings.musicEnabled)
        arcadeMusic?.apply(enabled:envelope.settings.musicEnabled)
        controller.onRoute = { [weak self] route in
            guard let self else { return }
            self.routeLease &+= 1
            let ambientRoute:NativeJourneyAmbientOwner.Route
            switch route {
            case .hub:ambientRoute = .hub
            case .world(let id):ambientRoute = .world(id)
            case .gameplay:
                if let state=self.gameplay?.engine.state {ambientRoute = .gameplay(state.mode,state.board)} else {ambientRoute = .none}
            default:ambientRoute = .none
            }
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
        let previous = envelope.settings
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
        ambient?.setEnabled(envelope.settings.gameSoundsEnabled)
        selectionFeedback()
    }
    private func makeGameplay(board: Int?, exit: @escaping () -> Void) throws -> UIViewController {
        let mode: NativeRunMode = board == nil ? .arcade : .journey
        let needsTutorial = !envelope.progression.firstPlayTutorialComplete
        let number = needsTutorial ? 1 : board ?? envelope.pendingArcadeRound?.round ?? envelope.arcadeRun?.board ?? 1
        guard mode == .arcade || envelope.progression.isPlayable(board: number) else {
            throw NativeSaveError.invalidState(["journey-board-locked"])
        }
        retireBoardTransition()
        endRun?.dispose();scoreOwner?.dispose();tutorialOwner?.dispose();resultOwner?.dispose();resultOwner = nil
        var state = envelope.resumedRun(mode: mode, board: number)
        if needsTutorial,state?.tutorial == nil {state=nil}
        let consumedPending = !needsTutorial && mode == .arcade && envelope.pendingArcadeRound != nil
        if consumedPending, let pending = envelope.pendingArcadeRound {
            state = fresh(mode: mode, board: pending.round, generation: (envelope.arcadeRun?.generation ?? 0) + 1)
            state?.score = pending.score
            state?.wildMeter = 0.25
            envelope.pendingArcadeRound = nil
        }
        let resumed = state != nil
        var initial = state ?? fresh(mode: mode, board: number, generation: 1,tutorial:needsTutorial)
        initial.bestScore = mode == .arcade ? envelope.progression.arcadeStats.highScore : envelope.progression.boardStats[number]?.highScore ?? 0
        let engine = NativeGameplayEngine(state: initial, rewardPicker: { state, roll, nextRoll in
            NativeWildRewardPolicy.choose(state:state,roll:roll,nextRoll:nextRoll)
        })
        if needsTutorial,engine.state.tutorial == nil {
            guard engine.startTutorial().accepted else {throw NativeSaveError.invalidState(["tutorial-canonical-cells-unavailable"])}
        }
        let gameplay = NativeGameplayViewController(engine: engine, resourceRoot: root)
        self.gameplay = gameplay; returnAction = exit; attemptCommitted = false
        if mode == .arcade,!resumed,!needsTutorial {
            gameplay.beforeInitialBoardEntry = { [weak self,weak gameplay] release in
                guard let self,let gameplay,!self.disposed,self.gameplay === gameplay else{return}
                self.mountArcadeEntry(gameplay,release:release)
            }
        } else if mode == .journey,NativeJourneyTransitionAdmission.requiresTransition(entry:.worldCard,tutorial:needsTutorial) {
            gameplay.beforeInitialBoardEntry = { [weak self,weak gameplay] release in
                guard let self,let gameplay,!self.disposed,self.gameplay === gameplay else{return}
                self.mountJourneyTransition(gameplay,board:number,release:release)
            }
        }
        committedScore=nil
        interimJourney = mode == .journey && !envelope.progression.completedJourneyBoards.contains(number)
        audio?.stop();audio?.beginGeneration(initial.generation)
        lastReturnBoard = mode == .journey ? number : nil
        if !resumed || consumedPending { envelope.progression.beginAttempt(mode: mode, board: number) }
        gameplay.onStateChange = { [weak self] state in self?.record(state);self?.tutorialOwner?.refresh(state) }
        gameplay.onGameplayEvent = { [weak self] event in self?.tutorialOwner?.gameplayEvent(event) }
        gameplay.onHaptic = { [weak self] kind in self?.impactFeedback(kind) }
        gameplay.onPointerState = { [weak self] dragging in self?.tutorialOwner?.pointerState(dragging) }
        gameplay.onTerminal = { [weak self] result in self?.terminal(result) }
        gameplay.onGameplayReceipt = { [weak self] event,source,destination,generation in
            guard let self else{return};self.audioReceipt &+= 1
            self.audio?.onGameplayEvent(event,source:source,destination:destination,generation:generation,receipt:self.audioReceipt)
            if event.kind == .noMovesCandidate {self.resultMoment("no-moves",index:0,duration:nil)}
            if event.kind == .merged,event.value == 6,initial.mode == .arcade {self.arcadeMusic?.committedMerge6(generation:generation)}
        }
        gameplay.onSpecialFadeCapture = { [weak self] variant,generation in
            self?.audio?.captureSpecialFade(variant:variant,generation:generation)
        }
        gameplay.onSpecialMoment = { [weak self] variant,moment,index in
            guard let self,let state=self.gameplay?.engine.state else{return};self.audioReceipt &+= 1
            self.audio?.specialMoment(variant:variant ?? "tnt",moment:moment,index:index,receipt:self.audioReceipt,generation:state.generation)
        }
        gameplay.onBoardEntry = { [weak self] duration,beats in
            guard let self,let state=self.gameplay?.engine.state else{return};self.audioReceipt &+= 1
            self.audio?.routeFeedback("board-enter",receipt:self.audioReceipt,generation:state.generation,duration:duration)
            self.tutorialOwner?.refresh(state)
            self.boardEntryHaptics?.dispose()
            let pulse=NativeBoardEntryHaptics(duration:duration,beats:beats);self.boardEntryHaptics=pulse
            pulse.onImpact = { [weak self] in guard self?.gameplay?.engine.state.generation==state.generation else{return};self?.impactFeedback("light") }
            self.gameplay?.view.addSubview(pulse);pulse.start()
        }
        endRun = NativeEndRunOwner(gameplay: gameplay, resourceRoot: root,
            save: { [weak self] in self?.saveCurrent() ?? false },
            restart: { [weak self] in self?.restart() },
            exit: { [weak self] in self?.exitGameplay() })
        endRun?.onFeedback = { [weak self] kind in self?.routeFeedback(kind) }
        scoreOwner=NativeScoreOwner(gameplay:gameplay,root:root,progression:{[weak self] in self?.envelope.progression ?? NativeProgressionState()})
        scoreOwner?.onFeedback = { [weak self] kind in self?.routeFeedback(kind) }
        installTutorial(gameplay)
        record(engine.state); try flush()
        return gameplay
    }
    private func fresh(mode: NativeRunMode, board: Int, generation: UInt64,tutorial:Bool=false) -> NativeBoardState {
        var state=NativeBoardFactory.make(mode: mode, board: board,
            columns: UIDevice.current.userInterfaceIdiom == .pad ? 7 : 5,
            generation: generation, seed: UInt64.random(in: 1...UInt64.max),tutorial:tutorial)
        state.bestScore = mode == .arcade ? envelope.progression.arcadeStats.highScore : envelope.progression.boardStats[board]?.highScore ?? 0
        return state
    }
    private func record(_ state: NativeBoardState) {
        guard !attemptCommitted,state.terminal == nil,NativeSaveEnvelope.isCoherentRun(state) else {return}
        let now = Date().timeIntervalSince1970
        if state.mode == .journey {
            envelope.journeyRuns[state.board] = state; envelope.journeyRunSavedAt[state.board] = now
        } else { envelope.arcadeRun = state; envelope.arcadeRunSavedAt = now }
    }
    private func installTutorial(_ gameplay:NativeGameplayViewController) {
        tutorialOwner?.dispose();tutorialOwner=nil
        guard gameplay.engine.state.tutorial?.active == true else{return}
        tutorialOwner=NativeTutorialOwner(gameplay:gameplay,root:root)
        tutorialOwner?.onChanged = { [weak self] state in self?.record(state);_ = self?.saveCurrent() }
        tutorialOwner?.onFeedback = { [weak self] in self?.routeFeedback("cta") }
    }
    private func flush() throws {
        if UIApplication.shared.applicationState != .active {gameplay?.engine.cancelForBackground()}
        if let gameplay, !attemptCommitted { record(gameplay.engine.state) }
        envelope.savedAt = Date().timeIntervalSince1970
        try store.save(envelope)
    }
    private func saveCurrent() -> Bool {
        do { try flush(); return true } catch { showError(error.localizedDescription); return false }
    }
    private func retireBoardTransition() {
        guard let carrier=boardTransition else{return};boardTransition=nil
        soundtrack?.abortBoardTransition(generation:carrier.generation)
        carrier.willMove(toParent:nil);carrier.dispose();carrier.viewIfLoaded?.removeFromSuperview();carrier.removeFromParent()
    }
    private func mountJourneyTransition(_ gameplay:NativeGameplayViewController,board:Int,release:@escaping ()->Void) {
        guard !disposed,self.gameplay === gameplay else{return}
        retireBoardTransition()
        let generation=gameplay.engine.state.generation
        let theme=NativeBoardTransitionPlan.Theme(board:board)
        let variation=transitionVariation.next(theme:theme,random:{Double.random(in:0..<1)})
        let carrier=NativeThemedBoardTransitionController(root:root,board:board,viewport:gameplay.view.bounds.size,generation:generation,variation:variation)
        boardTransition=carrier
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
        carrier.onAssetFailure = { [weak self,weak carrier] in
            guard let self,self.boardTransition === carrier else{return}
            self.showError("The stage artwork could not be prepared. Your progress is saved.")
        }
        carrier.onSceneExit = { [weak self,weak carrier,weak gameplay] receipt in
            guard let self,let carrier,let gameplay,!self.disposed,self.boardTransition === carrier,
                  self.gameplay === gameplay,receipt==generation,gameplay.engine.state.generation==generation else{return}
            release()
            guard self.boardTransition === carrier,gameplay.engine.state.generation==generation else{return}
            self.boardTransition=nil;carrier.willMove(toParent:nil);carrier.releaseCover(generation:generation)
        }
        gameplay.addChild(carrier);carrier.view.frame=gameplay.view.bounds;carrier.view.autoresizingMask=[.flexibleWidth,.flexibleHeight]
        gameplay.view.addSubview(carrier.view);carrier.didMove(toParent:gameplay);carrier.start()
    }
    private func mountArcadeEntry(_ gameplay:NativeGameplayViewController,onPresented:(()->Void)?=nil,release:@escaping ()->Void) {
        let generation=gameplay.engine.state.generation
        let cue=NativeArcadeRoundPresentation(resourceRoot:root,clearedRound:1,nextRound:1,continuationOnly:true)
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
        cue.start()
    }
    private func restart() {
        guard let gameplay else { return }
        controller?.cancelGameplayReturnPreparation()
        let old = gameplay.engine.state
        attemptCommitted = false
        let tutorial = !envelope.progression.firstPlayTutorialComplete
        gameplay.engine.restart(state: fresh(mode: old.mode, board: tutorial || old.mode == .arcade ? 1 : old.board, generation: old.generation + 1,tutorial:tutorial))
        if tutorial {_ = gameplay.engine.startTutorial()};installTutorial(gameplay)
        audio?.beginGeneration(gameplay.engine.state.generation)
        if old.mode == .arcade {arcadeMusic?.enterRound(generation:gameplay.engine.state.generation,immediate:true)}
        else {soundtrack?.setJourneyGameplay()}
        envelope.progression.beginAttempt(mode: old.mode, board: gameplay.engine.state.board)
        let entry=old.mode == .arcade && !tutorial ? gameplay.prepareNextBoardEntry():nil
        gameplay.setSuspended(false)
        if entry == nil {gameplay.refreshFromEngine()}
        record(gameplay.engine.state)
        guard saveCurrent() else{return}
        if let entry {mountArcadeEntry(gameplay,release:entry)}
    }
    private func terminal(_ resolution: NativeResolution) {
        guard let gameplay, !attemptCommitted, resolution.kind == .complete || resolution.kind == .fail else { return }
        ambient?.cleanResidualFinished(generation:routeLease)
        boardEntryHaptics?.dispose();boardEntryHaptics=nil
        if resolution.kind == .complete,gameplay.engine.state.tutorial?.requiresResultCompletion == true {
            presentTutorialComplete(gameplay);return
        }
        // NativeResultOwner commits rewards and progression atomically before presenting.
        resultOwner = NativeResultOwner(gameplay: gameplay, root: root, resolution: resolution,
            commit: { [weak self] score in try self?.commitResult(score: score, clean: resolution.kind == .complete) },
            restart: { [weak self] in self?.restart() },
            continueArcade: { [weak self] in self?.continueArcade() },
            exit: { [weak self] in self?.exitGameplay() },
            interimJourney:interimJourney,rewardScore:envelope.progression.boardStats[gameplay.engine.state.board]?.highScore,
            continueJourney:{[weak self] in self?.continueJourney()})
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
        if interimJourney,gameplay.engine.state.mode == .journey,gameplay.engine.state.board==2,
            !envelope.progression.unlockedSpecialDice.contains("flower") {
            resultOwner?.afterReward = { [weak self] next in self?.presentFlowerUnlock(next:next) }
        }
        if gameplay.engine.state.mode == .arcade {arcadeMusic?.setResultMix(generation:gameplay.engine.state.generation)}
        resultOwner?.present()
    }
    private func commitResult(score: Int, clean: Bool) throws {
        guard let gameplay, !attemptCommitted else { return }
        let state = gameplay.engine.state
        var next = envelope
        next.progression.finishAttempt(mode: state.mode, board: state.board, score: score,
            longestCombo: state.longestCombo, cubesCracked: state.cubesCracked, clean: clean)
        if state.mode == .journey { next.journeyRuns.removeValue(forKey: state.board); next.journeyRunSavedAt.removeValue(forKey: state.board) }
        else {
            next.arcadeRun = nil; next.arcadeRunSavedAt = nil
            if clean { next.pendingArcadeRound = .init(round:state.board+1,score:score,ownerID:"native-\(state.generation)-\(state.revision)") }
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
        sheet.onMoment = { [weak self] kind,_ in
            if kind == "tutorial-complete-selection" {self?.selectionFeedback()}
            else {self?.impactFeedback(kind.hasSuffix("medium") ? "medium" : "light")}
        }
        sheet.onContinue = { [weak self,weak sheet] in
            guard let self,let sheet,!self.disposed,self.tutorialComplete === sheet,self.gameplay?.engine.state.generation==generation else{return}
            do {
                var next=self.envelope;next.progression.firstPlayTutorialComplete=true
                next.progression.boardStats.removeValue(forKey:gameplay.engine.state.board);next.progression.arcadeStats=NativeArcadeStats()
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
                let state=self.fresh(mode:.arcade,board:1,generation:generation+1)
                gameplay.engine.restart(state:state);self.attemptCommitted=false;self.committedScore=nil
                self.audio?.beginGeneration(state.generation);self.arcadeMusic?.enterRound(generation:state.generation,immediate:true)
                self.envelope.progression.beginAttempt(mode:.arcade,board:1);self.record(state);_ = self.saveCurrent()
                let boardEntry=gameplay.prepareNextBoardEntry()
                if boardEntry == nil {gameplay.refreshFromEngine()}
                self.mountArcadeEntry(gameplay,onPresented:release) {
                    gameplay.setSuspended(false);boardEntry?()
                }
            }
        }
    }
    private func presentFlowerUnlock(next:@escaping ()->Void) {
        guard !disposed,let gameplay,gameplay.presentedViewController==nil else{return}
        let generation=gameplay.engine.state.generation
        let sheet=NativeSpecialDiceUnlockController(root:root,diceType:.flower,generation:generation)
        specialUnlock=sheet
        sheet.onUnlock = { [weak self] kind in
            guard let self,!self.disposed,self.gameplay?.engine.state.generation==generation else{throw CancellationError()}
            var value=self.envelope;value.progression.unlockedSpecialDice.insert(kind);value.savedAt=Date().timeIntervalSince1970
            try self.store.save(value);self.envelope=value
        }
        sheet.onHaptic = { [weak self] kind in self?.impactFeedback(kind) }
        sheet.onFeedback = { [weak self] kind in self?.routeFeedback(kind) }
        sheet.onFinish = { [weak self,weak sheet] action in
            guard let self,let sheet,!self.disposed,self.specialUnlock === sheet,self.gameplay?.engine.state.generation==generation else{return}
            self.specialUnlock=nil;sheet.dismiss(animated:false) {if action == .continue {next()}}
        }
        gameplay.present(sheet,animated:false)
    }
    private func continueArcade() {
        guard let gameplay, let pending = envelope.pendingArcadeRound else { return }
        var state = fresh(mode: .arcade, board: pending.round, generation: gameplay.engine.state.generation + 1)
        state.score = pending.score; state.wildMeter = 0.25
        gameplay.engine.restart(state: state); attemptCommitted = false
        audio?.beginGeneration(gameplay.engine.state.generation)
        arcadeMusic?.enterRound(generation:gameplay.engine.state.generation)
        envelope.pendingArcadeRound = nil; envelope.progression.beginAttempt(mode:.arcade,board:pending.round)
        gameplay.setSuspended(false); gameplay.refreshFromEngine(); record(gameplay.engine.state)
        _ = saveCurrent()
    }
    private func continueJourney() {
        guard let gameplay,attemptCommitted,gameplay.engine.state.mode == .journey else{return}
        controller?.cancelGameplayReturnPreparation()
        let old=gameplay.engine.state,next=old.board+1
        guard next<=30,envelope.progression.isPlayable(board:next) else{exitGameplay();return}
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
        endRun?.dispose();endRun=nil;scoreOwner?.dispose();scoreOwner=nil;tutorialOwner?.dispose();tutorialOwner=nil;resultOwner?.dispose();resultOwner=nil
        specialUnlock?.dispose();specialUnlock?.dismiss(animated:false);specialUnlock=nil
        boardEntryHaptics?.dispose();boardEntryHaptics=nil
        tutorialComplete?.dispose();tutorialComplete?.view.removeFromSuperview();tutorialComplete?.removeFromParent();tutorialComplete=nil
        arcadeEntryCue?.dispose();arcadeEntryCue=nil
        retireBoardTransition()
        gameplay = nil; let action = returnAction; returnAction = nil; action?()
    }
    private func routeFeedback(_ kind:String) {
        audioReceipt &+= 1
        audio?.routeFeedback(kind,receipt:audioReceipt,generation:audio?.generation ?? 1)
        selectionFeedback()
    }
    private func resultMoment(_ kind:String,index:Int,duration:Double?) {
        audioReceipt &+= 1
        if kind == "cta" {
            audio?.routeFeedback(kind,receipt:audioReceipt,generation:audio?.generation ?? 1);return
        }
        if kind == "clean-star" {impactFeedback("medium")}
        var release:(()->Void)?
        if kind == "clean-sax" || kind == "fail-sax" {
            if let state=gameplay?.engine.state,state.mode == .arcade {release=arcadeMusic?.beginResultHook(generation:state.generation)}
            else {release=soundtrack?.beginResultHook()}
        }
        audio?.resultMoment(kind,index:index,receipt:audioReceipt,generation:audio?.generation ?? 1,duration:duration,onFinished:release)
    }
    private func selectionFeedback() {
        guard envelope.settings.hapticsEnabled, UIApplication.shared.applicationState == .active else { return }
        UISelectionFeedbackGenerator().selectionChanged()
    }
    private func impactFeedback(_ style:String) {
        guard envelope.settings.hapticsEnabled,UIApplication.shared.applicationState == .active else{return}
        let kind:UIImpactFeedbackGenerator.FeedbackStyle = style == "heavy" ? .heavy : style == "medium" ? .medium : .light
        UIImpactFeedbackGenerator(style:kind).impactOccurred()
    }
    private func showError(_ text: String) {
        guard let host else { return }
        errorLabel.text = text; errorLabel.numberOfLines = 0; errorLabel.textAlignment = .center
        errorLabel.textColor = .systemRed; errorLabel.backgroundColor = host.view.backgroundColor
        errorLabel.frame = host.view.bounds.insetBy(dx:24,dy:80)
        errorLabel.autoresizingMask = [.flexibleWidth,.flexibleHeight]
        errorLabel.accessibilityIdentifier = "native.profile.error"
        host.view.addSubview(errorLabel)
    }
    func dispose() {
        guard !disposed else{return};disposed = true
        exporter?.cancel();exporter = nil;endRun?.dispose();endRun = nil
        scoreOwner?.dispose();scoreOwner=nil;tutorialOwner?.dispose();tutorialOwner=nil
        specialUnlock?.dispose();specialUnlock?.dismiss(animated:false);specialUnlock=nil
        boardEntryHaptics?.dispose();boardEntryHaptics=nil
        tutorialComplete?.dispose();tutorialComplete?.view.removeFromSuperview();tutorialComplete?.removeFromParent();tutorialComplete=nil
        arcadeEntryCue?.dispose();arcadeEntryCue=nil
        retireBoardTransition()
        resultOwner?.dispose();resultOwner = nil;gameplay?.dispose();gameplay = nil
        audio?.dispose();ambient?.dispose();arcadeMusic?.dispose();soundtrack?.dispose()
        controller?.dispose();controller?.willMove(toParent:nil)
        controller?.view.removeFromSuperview();controller?.removeFromParent();controller = nil
        errorLabel.removeFromSuperview();returnAction = nil;host = nil
    }
}
