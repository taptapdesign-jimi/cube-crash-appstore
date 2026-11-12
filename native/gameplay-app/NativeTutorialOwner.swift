import UIKit
import SpriteKit
import StackToSixGameplay

/// Connects the pure tutorial policy to one native sheet/pointer lease.
/// Run completion is committed by the result owner, never by this overlay.
@MainActor
final class NativeTutorialOwner {
    private weak var boundScene:NativeBoardScene?
    private weak var gameplay:NativeGameplayViewController?
    private let overlay:NativeTutorialOverlay
    enum ThirdDismissPhase:Equatable{case ready,waitingForCarrierArrival,backpackPrompt,exitingCTA,exitingSheet,countingActions,specialBar,waitingForWild,finished,retired}
    private(set) var sourceThirdDismissPhase=ThirdDismissPhase.ready
    var onSourceCTAContact:(()->Void)?
    private let sourceReservationOwnerID=UUID().uuidString
    var sourceActivationEnabled=false
    var sourceIntroEnabled=false
    var sourceSubsequentPresentationEnabled=false
    private var backpackDelay:NativeSourceAppTimeoutOwner.Receipt?
    private weak var backpackDelayOwner:NativeSourceAppTimeoutOwner?
    private var sourceThirdHintTimer:NativeSourceAppTimeoutOwner.Receipt?
    private weak var sourceThirdHintTimeouts:NativeSourceAppTimeoutOwner?
    private var sourceSecondMonitor:NativeSourceTutorialSecondStepMonitor?
    private var sourceFourthMonitor:NativeSourceTutorialFourthStepMonitor?
    private var sourceFourthCompletion:NativeSourceTutorialFourthCompletionMonitor?
    private var sourceFourthCompleting=false
    var sourceFourthMonitorPhase:NativeSourceTutorialFourthStepMonitor.Phase?{sourceFourthMonitor?.phase}
    var sourceSecondMonitorPhase:NativeSourceTutorialSecondStepMonitor.Phase?{sourceSecondMonitor?.phase}
    var sourceFirstStepMonitorEnabled=false
    private var sourceFirstMonitor:NativeSourceTutorialFirstStepMonitor?
    private var specialBarExiting=false
    private var objectiveTransitioning=false,comboSheetVisible=false,comboSheetExiting=false
    private var completionSheetVisible=false,completionSheetExiting=false
    private var collectionSheetVisible=false,collectionSheetExiting=false,collectionVisitPending=false
    private var collectionLock:String{"tutorial-collection:\(sourceReservationOwnerID):\(generation)"}
    private var objectiveLock:String{"tutorial-objective:\(sourceReservationOwnerID):\(generation)"}
    private var completionLock:String{"tutorial-completion:\(sourceReservationOwnerID):\(generation)"}
    private var comboLock:String{"tutorial-combo:\(sourceReservationOwnerID):\(generation)"}
    private var arrivalLock:String{"tutorial-special-arrival:\(sourceReservationOwnerID):\(generation)"}
    private var specialBarLock:String{"tutorial-special-bar:\(sourceReservationOwnerID):\(generation)"}
    var sourceFirstMonitorPhase:NativeSourceTutorialFirstStepMonitor.Phase?{sourceFirstMonitor?.phase}
    var sourceDisplayedStep:NativeTutorialState.Step?{displayedStep}
    private weak var sourceGuidedDragNode:NativeDiceNode?
    private var sourceGuidedDragStep:NativeTutorialState.Step?
    private var displayedStep:NativeTutorialState.Step?
    private var entrySheetAwaitingTargets=false
    private var restoredSpecialPointerStarted=false
    private var restoredSpecialTargetCycle=NativeTutorialTargetCycle()
    private(set) var disposed=false
    private var specialVisualExitStarted=false,contactSheetVisible=false,contactSheetEntered=false,contactLanded=false
    private var generation:UInt64
    private var observers:[NSObjectProtocol]=[]
    isolated deinit{dispose()}
    var onChanged:((NativeBoardState)->Void)?
    var onFeedback:(()->Void)?
    var onSpeechEvent:((String)->Void)?
    init(gameplay:NativeGameplayViewController,root:URL) {
        self.gameplay=gameplay;generation=gameplay.engine.state.generation;overlay=NativeTutorialOverlay(resourceRoot:root,arcade:gameplay.engine.state.mode == .arcade)
        if gameplay.engine.state.tutorial?.active == true && gameplay.engine.state.tutorial?.objectiveAcknowledged == false {
            gameplay.engine.setInputLock(objectiveLock,active:true)
        }
        overlay.onSpeechEvent = {[weak self] event in self?.onSpeechEvent?(event)}
        overlay.onPresentationChanged = { [weak gameplay] in gameplay?.tutorialSheetPresentationChanged() }
        overlay.onGotIt = { [weak self] in
            guard let self else{return}
            if self.collectionSheetVisible {
                if self.gameplay?.engine.state.mode == .journey {self.openCollectionBackpack()}
                else {self.dismissCollectionSheet(openBackpack:false,feedback:true)}
                return
            }
            if self.completionSheetVisible {self.dismissCompletionSheet();return}
            if self.comboSheetVisible {self.dismissComboSheet();return}
            if let step=self.displayedStep ?? self.gameplay?.engine.state.tutorial?.step,step == .stack || step == .mergeSix {
                guard self.guidedStepAcceptsInteraction(step) else{return}
                if self.overlay.dismissGuidedSheet(){self.onFeedback?()}
            } else if self.gameplay?.engine.state.tutorial?.step == .special {
                if self.overlay.dismissSpecialSheet(){self.onFeedback?()}
            } else {self.dismissFreePlay()}
        }
        overlay.onObjectiveGotIt = { [weak self] in self?.dismissObjective() }
        overlay.onCollectionBackpackOpen = {[weak self] in self?.openCollectionBackpack()}
        gameplay.onTutorialBackpackVisitClosed = {[weak self] in self?.completeCollectionVisit()}
        overlay.onSpecialBarContinue = { [weak self] in self?.continueSpecialBar() }
        bindSceneCallbacks()
        for (name,suspended) in [(UIApplication.willResignActiveNotification,true),(UIApplication.didBecomeActiveNotification,false)] {
            observers.append(NotificationCenter.default.addObserver(forName:name,object:nil,queue:.main) {[weak self] _ in MainActor.assumeIsolated {guard let self else{return};self.overlay.setSuspended(suspended || (self.collectionVisitPending && !self.collectionSheetExiting))}})
        }
    }
    private func bindSceneCallbacks(){
        guard let scene=gameplay?.boardScene,boundScene !== scene else{return};boundScene=scene
        scene.onTutorialBackpackPaint = {[weak self,weak scene] carrier in
            guard let self,let scene,!self.disposed else{return}
            self.overlay.paintBackpack(carrier,scene:scene)
        }
        scene.onTutorialWildAnimationProgress = {[weak self] fraction in self?.tutorialAnimationProgress(fraction)}
        scene.onTutorialSpecialDropContact = {[weak self] node in self?.tutorialDropContact(node)}
        scene.onTutorialSpecialDropLanded = {[weak self] _ in
            guard let self,!self.sourceSubsequentPresentationEnabled else{return};self.contactLanded=true
            if let game=self.gameplay{self.refresh(game.engine.state)}
        }
    }
    private func guidedStepAcceptsInteraction(_ step:NativeTutorialState.Step)->Bool {
        if step == .stack,sourceFirstStepMonitorEnabled{return sourceFirstMonitor?.phase == .polling}
        if step == .mergeSix,sourceSubsequentPresentationEnabled{return sourceSecondMonitor?.phase == .polling}
        return true
    }
    private func tutorialDropContact(_ node:NativeDiceNode){
        guard !disposed,!sourceSubsequentPresentationEnabled,!contactSheetVisible,let game=gameplay,
            game.engine.state.generation==generation,game.tutorialVisualPresentationAllowed,
            let tutorial=game.engine.state.tutorial,tutorial.active,(tutorial.waitingForWild || tutorial.step == .special) else{return}
        contactSheetVisible=true;game.engine.setInputLock(arrivalLock,active:true)
        displayedStep = .special;overlay.frame=game.view.bounds;overlay.autoresizingMask=[.flexibleWidth,.flexibleHeight]
        if overlay.superview==nil{game.view.addSubview(overlay)}
        overlay.show(step:4,from:nil,to:nil,initial:true,entered:{[weak self,weak game] in
            guard let self,let game,!self.disposed else{return};self.contactSheetEntered=true;self.refresh(game.engine.state)
        })
    }
    private func tutorialAnimationProgress(_ fraction:Double){
        guard !disposed,let game=gameplay,game.engine.state.generation==generation,game.tutorialVisualPresentationAllowed,
            let tutorial=game.engine.state.tutorial,tutorial.active || tutorial.needsEncouragement,
            tutorial.step == .special || tutorial.needsEncouragement else{return}
        if !specialVisualExitStarted {
            specialVisualExitStarted=true;game.boardScene?.setTutorialBoardFocus(nil)
            if sourceSubsequentPresentationEnabled,tutorial.active {
                _=game.boardScene?.beginSourceTutorialFourthExitFade(ownerID:sourceReservationOwnerID)
            }
            _=overlay.exitSpecialVisuals(completed:{})
        }
        if fraction>=0.5,tutorial.collectionLessonAcknowledged != true,!collectionSheetVisible {
            game.boardScene?.setTutorialCollectionPreviewHUD(true)
            presentCollectionSheet(game)
        }
        // Canonical guide completion still belongs to genuine Special settlement.
    }
    private func finishGuideHandoff(_ game:NativeGameplayViewController){
        guard !disposed,game.engine.state.tutorial?.needsEncouragement==true,
            game.tutorialEncouragementPresentationReady else{return}
        game.boardScene?.onTutorialEncouragementSettled=nil
        if !collectionSheetVisible {overlay.isHidden=true}
        game.engine.acknowledgeTutorialEncouragement()
        game.boardScene?.setTutorialCollectionPreviewHUD(false)
        game.boardScene?.revealTutorialScoreComboBackpack()
        if collectionSheetVisible {
            game.engine.setTutorialComboPaused(true,now:CACurrentMediaTime())
            overlay.setCollectionInteractionReady(true)
        }
        onChanged?(game.engine.state)
        refresh(game.engine.state)
    }
    private func presentCollectionSheet(_ game:NativeGameplayViewController){
        guard !disposed,!collectionSheetVisible,!collectionSheetExiting else{return}
        collectionSheetVisible=true
        overlay.setCollectionInteractionReady(game.engine.state.tutorial?.active != true && game.engine.state.tutorial?.encouragementAcknowledged == true)
        game.engine.setInputLock(collectionLock,active:true)
        game.engine.setTutorialComboPaused(true,now:CACurrentMediaTime())
        overlay.frame=game.view.bounds;overlay.autoresizingMask=[.flexibleWidth,.flexibleHeight]
        if overlay.superview==nil{game.view.addSubview(overlay)}
        overlay.collectionTargetFrame = {[weak game] in game?.boardScene?.tutorialBackpackTargetScreen}
        overlay.comboTarget = {[weak game] in
            guard let rect=game?.boardScene?.tutorialBackpackTargetScreen else{return nil}
            return CGPoint(x:rect.midX,y:rect.midY)
        }
        overlay.show(step:8,from:nil,to:nil,initial:true)
    }
    private func openCollectionBackpack(){
        guard !disposed,collectionSheetVisible,!collectionSheetExiting,!collectionVisitPending,
              let game=gameplay,game.engine.state.generation==generation,game.presentedViewController==nil,
              game.engine.state.tutorial?.active != true,game.engine.state.tutorial?.encouragementAcknowledged == true else{return}
        guard game.engine.state.mode == .journey else{dismissCollectionSheet(openBackpack:true,feedback:true);return}
        guard game.onHelp != nil else{return}
        collectionVisitPending=true;collectionSheetExiting=true;onFeedback?()
        overlay.hide{[weak self,weak game] in
            guard let self,let game,!self.disposed,game.engine.state.generation==self.generation else{return}
            self.collectionSheetExiting=false
            game.onHelp?()
            guard game.presentedViewController is NativeGameplayBackpackController else{
                self.collectionVisitPending=false
                self.overlay.show(step:8,from:nil,to:nil,initial:true)
                return
            }
            // The reading sheet has exited before the existing collection is presented.
            self.overlay.setSuspended(true)
        }
    }
    private func completeCollectionVisit(){
        guard !disposed,collectionVisitPending,collectionSheetVisible,!collectionSheetExiting,
              let game=gameplay,game.engine.state.generation==generation else{return}
        collectionVisitPending=false;overlay.setSuspended(false)
        dismissCollectionSheet(openBackpack:false)
    }
    private func dismissCollectionSheet(openBackpack:Bool,feedback:Bool=false){
        guard !disposed,collectionSheetVisible,!collectionSheetExiting,let game=gameplay,
              game.engine.state.generation==generation else{return}
        collectionSheetExiting=true
        if feedback{onFeedback?()}
        let finish={ [weak self,weak game] in
            guard let self,let game,!self.disposed,game.engine.state.generation==self.generation else{return}
            let result=game.engine.acknowledgeTutorialCollectionLesson()
            let acknowledged=game.engine.state.tutorial?.collectionLessonAcknowledged==true
            game.engine.setTutorialComboPaused(false,now:CACurrentMediaTime())
            game.engine.setInputLock(self.collectionLock,active:false)
            self.collectionSheetVisible=false;self.collectionSheetExiting=false
            if result.accepted {self.onChanged?(game.engine.state)}
            game.refreshFromEngine()
            if openBackpack,acknowledged {game.onHelp?()}
        }
        if overlay.isHidden {finish()}else{overlay.hide(completion:finish)}
    }
    private func presentComboSheet(_ game:NativeGameplayViewController){
        guard !disposed,!comboSheetVisible,!comboSheetExiting else{return}
        comboSheetVisible=true;game.engine.setInputLock(comboLock,active:true)
        game.engine.setTutorialComboPaused(true,now:CACurrentMediaTime())
        overlay.frame=game.view.bounds;overlay.autoresizingMask=[.flexibleWidth,.flexibleHeight]
        if overlay.superview==nil{game.view.addSubview(overlay)}
        overlay.comboTarget = {[weak game] in game?.boardScene?.tutorialComboTargetScreen}
        overlay.show(step:7,from:nil,to:nil,initial:true)
    }
    private func dismissComboSheet(){
        guard !disposed,comboSheetVisible,!comboSheetExiting,let game=gameplay,
              game.engine.state.generation==generation else{return}
        comboSheetExiting=true;onFeedback?()
        overlay.hide{[weak self,weak game] in
            guard let self,let game,!self.disposed,game.engine.state.generation==self.generation else{return}
            game.engine.acknowledgeTutorialComboLesson()
            self.comboSheetVisible=false;self.comboSheetExiting=false
            if game.engine.state.tutorial?.completionLessonAcknowledged == false {
                self.presentCompletionSheet(game)
                game.engine.setInputLock(self.comboLock,active:false)
                self.onChanged?(game.engine.state);game.refreshFromEngine()
            }else{
                game.engine.setTutorialComboPaused(false,now:CACurrentMediaTime())
                game.engine.setInputLock(self.comboLock,active:false)
                self.onChanged?(game.engine.state);self.dispose();game.refreshFromEngine()
            }
        }
    }
    private func presentCompletionSheet(_ game:NativeGameplayViewController){
        guard !disposed,!completionSheetVisible,!completionSheetExiting else{return}
        completionSheetVisible=true;game.engine.setInputLock(completionLock,active:true)
        game.engine.setTutorialComboPaused(true,now:CACurrentMediaTime())
        overlay.frame=game.view.bounds;overlay.autoresizingMask=[.flexibleWidth,.flexibleHeight]
        if overlay.superview==nil{game.view.addSubview(overlay)}
        overlay.comboTarget=nil;overlay.collectionTargetFrame=nil
        overlay.show(step:9,from:nil,to:nil,initial:true)
    }
    private func dismissCompletionSheet(){
        guard !disposed,completionSheetVisible,!completionSheetExiting,let game=gameplay,
              game.engine.state.generation==generation else{return}
        completionSheetExiting=true;onFeedback?()
        overlay.hide{[weak self,weak game] in
            guard let self,let game,!self.disposed,game.engine.state.generation==self.generation else{return}
            let result=game.engine.acknowledgeTutorialCompletionLesson()
            guard result.accepted else{return}
            game.engine.setTutorialComboPaused(false,now:CACurrentMediaTime())
            game.engine.setInputLock(self.completionLock,active:false)
            self.completionSheetVisible=false;self.completionSheetExiting=false
            self.onChanged?(game.engine.state);self.dispose();game.refreshFromEngine()
        }
    }
    private func updateBoardFocus(_ state:NativeBoardState){
        guard let scene=gameplay?.boardScene,let tutorial=state.tutorial else{return}
        if specialVisualExitStarted || !tutorial.active{scene.setTutorialBoardFocus(nil);return}
        switch tutorial.step {
        case .stack,.mergeSix:scene.setTutorialBoardFocus(overlay.objectiveSheetVisible ? []:Set(tutorial.guidedPair))
        case .special:scene.setTutorialBoardFocus(Set(state.tiles.map(\.id)))
        case .freePlay:scene.setTutorialBoardFocus(tutorial.specialBarReady && tutorial.specialBarAcknowledged != true ? []:nil)
        }
    }
    func showSourceEntrySheet() {
        guard !disposed,sourceIntroEnabled,displayedStep==nil,let gameplay,
            gameplay.engine.state.generation==generation,gameplay.engine.state.tutorial?.active==true,
            gameplay.engine.state.tutorial?.step == .stack,let scene=gameplay.boardScene,
            scene.sourceTutorialEntryFullyVisible,let scope=gameplay.sourceScope,scope.current else{return}
        overlay.frame=gameplay.view.bounds;overlay.autoresizingMask=[.flexibleWidth,.flexibleHeight]
        if overlay.superview==nil{gameplay.view.addSubview(overlay)}
        let objectiveFirst=gameplay.engine.state.tutorial?.objectiveAcknowledged == false
        if objectiveFirst {gameplay.engine.setInputLock(objectiveLock,active:true)}
        guard overlay.showSourceIntro(from:nil,to:nil,service:scope.service,timeouts:scene.sourceTutorialIntroTimeouts,
            boardGeneration:generation,immediateSheet:true,deferInitialPointer:true,objectiveFirst:objectiveFirst,current:{[weak self,weak gameplay,weak scene,weak scope] in
                guard let self,let gameplay,let scene,let scope else{return false}
                return !self.disposed && scope.current && gameplay.sourceScope === scope && gameplay.boardScene === scene &&
                    gameplay.engine.state.generation==self.generation && gameplay.engine.state.tutorial?.active==true &&
                    (scene.sourceTutorialEntryFullyVisible || scene.sourceTutorialPreparationReady)
            }) else{gameplay.engine.setInputLock(objectiveLock,active:false);return}
        displayedStep = .stack;entrySheetAwaitingTargets=true
    }
    private func dismissObjective(){
        guard !disposed,!objectiveTransitioning,overlay.objectiveSheetVisible,let gameplay,
              gameplay.engine.state.generation==generation,
              gameplay.engine.state.tutorial?.objectiveAcknowledged == false else{return}
        objectiveTransitioning=true
        guard overlay.transitionObjectiveToStack(revealing:{[weak self,weak gameplay] in
            guard let self,let gameplay,!self.disposed,gameplay.engine.state.generation==self.generation else{return}
            self.updateBoardFocus(gameplay.engine.state)
        },entered:{[weak self,weak gameplay] in
            guard let self,let gameplay,!self.disposed,gameplay.engine.state.generation==self.generation else{return}
            gameplay.boardScene?.revealTutorialPreloadMeter()
            gameplay.engine.setInputLock(self.objectiveLock,active:false)
            self.objectiveTransitioning=false
            self.refresh(gameplay.engine.state)
        }) else{objectiveTransitioning=false;return}
        let result=gameplay.engine.acknowledgeTutorialObjective()
        if result.accepted{onFeedback?();onChanged?(result.state)}
    }
    func refresh(_ state:NativeBoardState) {
        guard !disposed else{return}
        guard state.generation==generation,let gameplay else{dispose();return}
        guard let tutorial=state.tutorial,state.terminal==nil else {dispose();displayedStep=nil;return}
        bindSceneCallbacks()
        updateBoardFocus(state)
        if contactSheetVisible,tutorial.active {
            if tutorial.waitingForWild{return}
            if contactSheetEntered && contactLanded{gameplay.engine.setInputLock(arrivalLock,active:false)}
        }
        if collectionSheetVisible && tutorial.active{return}
        if !tutorial.active {
            if tutorial.needsEncouragement {
                guard gameplay.tutorialEncouragementPresentationReady else {
                    if gameplay.boardScene?.onTutorialEncouragementSettled==nil {
                        gameplay.boardScene?.onTutorialEncouragementSettled = {[weak self,weak gameplay] in
                            guard let self,let gameplay,!self.disposed,gameplay.engine.state.generation==self.generation else{return}
                            self.refresh(gameplay.engine.state)
                        }
                    }
                    return
                }
                gameplay.boardScene?.onTutorialEncouragementSettled=nil
                finishGuideHandoff(gameplay)
            } else if tutorial.collectionLessonAcknowledged == false {
                guard gameplay.tutorialEncouragementPresentationReady else {
                    if gameplay.boardScene?.onTutorialEncouragementSettled==nil {
                        gameplay.boardScene?.onTutorialEncouragementSettled = {[weak self,weak gameplay] in
                            guard let self,let gameplay,!self.disposed else{return};self.refresh(gameplay.engine.state)
                        }
                    }
                    return
                }
                gameplay.boardScene?.onTutorialEncouragementSettled=nil
                presentCollectionSheet(gameplay)
            } else if tutorial.comboLessonAcknowledged == false {
                if tutorial.comboHUDRevealed == true {presentComboSheet(gameplay)}
                else if tutorial.comboLessonReady(in:gameplay.engine.state.mode) {
                    let result=gameplay.engine.beginTutorialComboLesson()
                    if result.accepted {onChanged?(result.state);presentComboSheet(gameplay)}
                }
            } else if tutorial.completionLessonAcknowledged == false {
                presentCompletionSheet(gameplay)
            } else {dispose()}
            return
        }
        if sourceSubsequentPresentationEnabled,tutorial.waitingForWild,state.wildMeter>=1-0.000001 {
            gameplay.engine.setInputLock(arrivalLock,active:true)
            if gameplay.engine.isDragging {gameplay.boardScene?.cancelDrag()}
            guard !disposed,gameplay.engine.state.generation==generation else{return}
        }
        if specialBarExiting{return}
        guard let scene=gameplay.boardScene,let geometry=scene.boardGeometry else{return}
        if tutorial.step == .stack,tutorial.specialBarSuccessfulActions == nil {
            let result=gameplay.engine.beginTutorialSpecialBarInterval()
            guard result.accepted else{return}
            onChanged?(result.state)
        }
        if tutorial.specialBarSuccessfulActions != nil && tutorial.specialBarAcknowledged != true && tutorial.step == .freePlay {
            if sourceThirdDismissPhase == .ready,(displayedStep==nil || !sourceSubsequentPresentationEnabled) {sourceThirdDismissPhase = .countingActions;overlay.isHidden=true}
            if sourceThirdDismissPhase == .countingActions{scheduleSpecialBarIfReady()}
            if sourceThirdDismissPhase == .countingActions || sourceThirdDismissPhase == .specialBar || sourceThirdDismissPhase == .exitingSheet{return}
        }
        if sourceSubsequentPresentationEnabled,tutorial.step == .freePlay,
           tutorial.specialBarAcknowledged == true,sourceThirdDismissPhase == .ready,
           state.wildMeter>=1-0.000001 {
            if !beginSourceBackpackDelivery(gameplay:gameplay,scene:scene) {
                scene.failSourceTutorialFourthPresentation("source_tutorial_backpack_delivery_rejected",generation:generation)
            }
            return
        }
        // Restored runs have no fresh demo/third-step monitor. They still wait
        // for a full meter and use the real carrier instead of the old step-3 sheet.
        if !sourceSubsequentPresentationEnabled,tutorial.step == .freePlay,
           tutorial.specialBarSuccessfulActions != nil,tutorial.specialBarAcknowledged==true {
            if sourceThirdDismissPhase == .ready {
                overlay.isHidden=true
                if state.wildMeter>=1-0.000001,!tutorial.waitingForWild {
                    beginRestoredBackpackDelivery(gameplay:gameplay,scene:scene)
                }
            }
            return
        }
        if sourceActivationEnabled,state.tutorial?.step == .stack,!scene.sourceTutorialPreparationReady{return}
        if sourceFirstStepMonitorEnabled,tutorial.step == .stack,sourceFirstMonitor==nil {
            guard installSourceFirstMonitor(gameplay:gameplay,scene:scene) else{return}
        }
        if sourceFirstMonitor != nil,scene.sourceTutorialFirstStepPresentationActive,tutorial.step == .mergeSix{return}
        if sourceSubsequentPresentationEnabled,(scene.sourceTutorialSecondPresentationActive && tutorial.step == .freePlay) || scene.sourceTutorialThirdPresentationActive{return}
        if overlay.superview==nil {overlay.frame=gameplay.view.bounds;overlay.autoresizingMask=[.flexibleWidth,.flexibleHeight];gameplay.view.addSubview(overlay)}
        let pair:[NativeTile]
        var moves:[(CGPoint,CGPoint)]=[]
        func point(_ tile:NativeTile)->CGPoint {let p=geometry.center(row:tile.cell.row,column:tile.cell.column);return CGPoint(x:p.x,y:scene.size.height-p.y)}
        switch tutorial.step {
        case .stack,.mergeSix:pair=tutorial.guidedPair.compactMap{id in state.tiles.first{$0.id==id}}
        case .special:
            let star=state.activeTiles.first{$0.id==tutorial.wildTileID} ?? state.activeTiles.first{$0.gameplayArchetype == .star}
            let target=state.activeTiles.filter{NativeTutorialRules.isSpecialTarget($0,rows:state.rows)}.sorted{$0.cell.row != $1.cell.row ? $0.cell.row < $1.cell.row : $0.cell.column < $1.cell.column}.first
            pair=[star,target].compactMap{$0}
        case .freePlay:
            let candidates=state.activeTiles.filter{$0.gameplayArchetype==nil && $0.value>0 && !$0.locked && $0.cell.row<=min(state.rows-1,4)}
            var directions:[Int:[(CGPoint,CGPoint)]]=[:]
            for from in candidates {for to in candidates where from.id != to.id {
                let dx=to.cell.column-from.cell.column,dy=to.cell.row-from.cell.row
                let direction=abs(dx)>=abs(dy) ? (dx>0 ? 0 : 1) : (dy>0 ? 2 : 3)
                directions[direction,default:[]].append((point(from),point(to)))
            }}
            moves=(0...3).shuffled().compactMap {directions[$0]?.randomElement()}.shuffled()
            if moves.count<2 {
                let cells=[(max(0,state.columns/2-1),1),(min(state.columns-1,state.columns/2+1),1),(min(state.columns-1,state.columns/2+1),3),(max(0,state.columns/2-1),3)]
                let points=cells.map{column,row -> CGPoint in let p=geometry.center(row:min(state.rows-1,row),column:column);return CGPoint(x:p.x,y:scene.size.height-p.y)}
                moves=[(points[0],points[1]),(points[1],points[2]),(points[3],points[2])].shuffled()
            }
            pair=[]
        }
        let points=pair.map {tile -> CGPoint in let p=geometry.center(row:tile.cell.row,column:tile.cell.column);return CGPoint(x:p.x,y:scene.size.height-p.y)}
        let from=points.first ?? moves.first?.0,to=points.count>1 ? points[1] : moves.first?.1
        if tutorial.waitingForWild {
            if sourceThirdDismissPhase != .backpackPrompt && sourceThirdDismissPhase != .exitingCTA {overlay.isHidden=true}
            return
        }
        if displayedStep != tutorial.step {
            if sourceIntroEnabled,displayedStep==nil,tutorial.step == .stack {
                guard let scope=gameplay.sourceScope,scope.current,scene.sourceTutorialPreparationReady,
                    overlay.showSourceIntro(from:from,to:to,service:scope.service,timeouts:scene.sourceTutorialIntroTimeouts,
                        boardGeneration:generation,immediateSheet:true,deferInitialPointer:tutorial.objectiveAcknowledged == false,objectiveFirst:tutorial.objectiveAcknowledged == false,current:{[weak self,weak gameplay,weak scene,weak scope] in
                            guard let self,let gameplay,let scene,let scope else{return false}
                            return !self.disposed && scope.current && gameplay.sourceScope === scope && gameplay.boardScene === scene &&
                                gameplay.engine.state.generation==self.generation && gameplay.engine.state.tutorial?.active==true && (self.sourceFirstStepMonitorEnabled || gameplay.engine.state.tutorial?.step == .stack) && scene.sourceTutorialPreparationReady
                        }) else{return}
            } else {overlay.show(step:tutorial.step.rawValue,from:from,to:to,initial:displayedStep==nil,moves:moves,objectiveFirst:tutorial.step == .stack && tutorial.objectiveAcknowledged == false)}
            displayedStep=tutorial.step
            if overlay.objectiveSheetVisible {updateBoardFocus(state)}
        }
        else {
            overlay.updateTargets(from:from,to:to)
            if entrySheetAwaitingTargets,!overlay.objectiveSheetVisible,scene.sourceTutorialPreparationReady,points.count==2 {
                entrySheetAwaitingTargets=false;overlay.restorePointer()
            }
        }
        if tutorial.step == .special,!sourceSubsequentPresentationEnabled,!restoredSpecialPointerStarted {
            startRestoredSpecialPointer(gameplay:gameplay,scene:scene)
        }
    }
    private func startRestoredSpecialPointer(gameplay:NativeGameplayViewController,scene:NativeBoardScene) {
        guard let scope=gameplay.sourceScope,scope.current else{return}
        let current:()->Bool = {[weak self,weak gameplay,weak scene,weak scope] in
            guard let self,let gameplay,let scene,let scope else{return false}
            return !self.disposed && scope.current && gameplay.sourceScope === scope && gameplay.boardScene === scene &&
                gameplay.engine.state.generation==self.generation && gameplay.engine.state.tutorial?.active==true &&
                gameplay.engine.state.tutorial?.step == .special
        }
        restoredSpecialPointerStarted=overlay.startSourceFourthPointer(service:scope.service,timeouts:scene.sourceTutorialIntroTimeouts,
            boardGeneration:generation,current:current,select:{[weak self,weak gameplay,weak scene] in
                guard let self,let gameplay,let scene,current() else{return nil}
                let state=gameplay.engine.state
                guard let wild=state.activeTiles.first(where:{$0.id==state.tutorial?.wildTileID}) ?? state.activeTiles.first(where:{$0.gameplayArchetype == .star}) else{return nil}
                let targets=state.activeTiles.filter{NativeTutorialRules.isSpecialTarget($0,rows:state.rows)}
                guard let id=self.restoredSpecialTargetCycle.select(targets.map(\.id)) else{return nil}
                @MainActor func rect(_ id:String)->CGRect? {
                    guard current(),let node=scene.sourceNativeTileNode(id),let parent=node.parent else{return nil}
                    let bounds=node.calculateAccumulatedFrame(),center=scene.convert(CGPoint(x:bounds.midX,y:bounds.midY),from:parent)
                    let width=max(52,bounds.width),height=max(52,bounds.height)
                    return CGRect(x:center.x-width/2,y:scene.size.height-center.y-height/2,width:width,height:height)
                }
                guard let from=rect(wild.id),let to=rect(id),current() else{return nil}
                return .init(from:from,to:to)
            })
    }
    private func installSourceFirstMonitor(gameplay:NativeGameplayViewController,scene:NativeBoardScene)->Bool {
        guard let scope=gameplay.sourceScope,scope.current,let targets=scene.sourceTutorialFirstStepTargets() else{return false}
        let monitor=NativeSourceTutorialFirstStepMonitor(service:scope.service,timeouts:scene.sourceTutorialIntroTimeouts,generation:generation,targets:targets,parent:scene.sourceTutorialCapturedParent,
            current:{[weak self,weak gameplay,weak scene,weak scope] in
                guard let self,let gameplay,let scene,let scope else{return false}
                return !self.disposed && gameplay.engine.state.generation==self.generation && gameplay.engine.state.tutorial?.active==true &&
                    scope.current && gameplay.sourceScope === scope && gameplay.boardScene === scene && scene.sourceTutorialFirstStepPresentationActive
            },targetCurrent:{[weak scene] in scene?.sourceTutorialTargetCurrent($0)==true},
            pointerExit:{[weak self] callback in
                guard self?.overlay.sourceIntroOwner?.popOutPointer(completed:{})==true else{return false};callback();return true
            },
            sheetExit:{[weak self] callback in self?.overlay.sourceIntroOwner?.exitSheet(completed:callback)==true},
            activate:{[weak self,weak gameplay,weak scene,weak scope] merged in
                guard let self,let gameplay,let scene,let scope,!self.disposed,scope.current,gameplay.sourceScope === scope,
                    gameplay.engine.state.generation==self.generation,scene.prepareSourceTutorialSecondStep(merged),let geometry=scene.boardGeometry,
                    let tutorial=gameplay.engine.state.tutorial else{return false}
                let points=tutorial.guidedPair.compactMap{id -> CGPoint? in guard let tile=gameplay.engine.state.tiles.first(where:{$0.id==id}) else{return nil};let p=geometry.center(row:tile.cell.row,column:tile.cell.column);return CGPoint(x:p.x,y:scene.size.height-p.y)}
                guard points.count==2 else{return false}
                self.displayedStep = .mergeSix
                if self.sourceSubsequentPresentationEnabled,!self.installSourceSecondMonitor(gameplay:gameplay,scene:scene){return false}
                self.overlay.updateTargets(from:points[0],to:points[1])
                self.overlay.scheduleSourceSecondStepPointer()
                self.overlay.admitSourceSecondStepInteraction()
                return true
            },readyToExit:{[weak scene] merged in scene?.sourceTutorialSecondStepTransitionReady(merged)==true},
            presentAfterExit:{[weak self,weak scene] _ in
                guard let self,let scene,!self.disposed else{return false}
                return self.overlay.transitionSourceSheetToSecondStep(from:nil,to:nil,preparationReady:false,entered:{[weak self,weak scene] in
                    guard let self,let scene,!self.disposed,scene.sourceTutorialSecondPreparationReady else{return}
                    _=scene.repairSourceTutorialSecondStep()
                })
            })
        guard let monitor else{return false};sourceFirstMonitor=monitor
        if !monitor.start(){sourceFirstMonitor=nil;monitor.dispose();return false};return true
    }
    private func installSourceSecondMonitor(gameplay:NativeGameplayViewController,scene:NativeBoardScene)->Bool {
        guard sourceSecondMonitor==nil,let scope=gameplay.sourceScope,scope.current,let targets=scene.sourceTutorialSecondTargets() else{return false}
        let monitor=NativeSourceTutorialSecondStepMonitor(service:scope.service,timeouts:scene.sourceTutorialIntroTimeouts,generation:generation,five:targets[0],one:targets[1],parent:scene.sourceTutorialCapturedParent,
            current:{[weak self,weak gameplay,weak scene,weak scope] in
                guard let self,let gameplay,let scene,let scope else{return false};return !self.disposed && scope.current && gameplay.sourceScope === scope && gameplay.boardScene === scene && gameplay.engine.state.generation==self.generation && scene.sourceTutorialSecondPresentationActive
            },hasUnlockedSix:{[weak gameplay] in gameplay?.engine.pendingSourceTutorialPresentationBarrier?.phase == .secondMerge},nodeCurrent:{[weak scene] in scene?.sourceTutorialTargetCurrent($0)==true},
            pointerExit:{[weak self] callback in
                guard self?.overlay.sourceIntroOwner?.popOutPointer(completed:{})==true else{return false};callback();return true
            },
            sheetExit:{[weak self] callback in self?.overlay.sourceIntroOwner?.exitSheet(completed:callback)==true},
            activate:{[weak self,weak gameplay,weak scene,weak scope] in
                guard let self,let gameplay,let scene,let scope,!self.disposed,scope.current,gameplay.sourceScope === scope,scene.prepareSourceTutorialThirdStep(immediateSpecialBar:true) else{return false}
                self.sourceGuidedDragNode=nil;self.sourceGuidedDragStep=nil;self.displayedStep = .freePlay
                self.sourceThirdDismissPhase = .countingActions
                self.scheduleSpecialBarIfReady()
                return true
            },readyToExit:{[weak scene] in scene?.tutorialSpecialBarSettled==true},activationDelayMilliseconds:0,
            presentAfterExit:{[weak self] in
                guard let self,!self.disposed else{return false}
                return self.overlay.showSpecialBar(interactionReady:false,entered:{})
            })
        guard let monitor else{return false};sourceSecondMonitor=monitor
        if !monitor.start(){sourceSecondMonitor=nil;monitor.dispose();return false};return true
    }
    @discardableResult private func showSourceClearStage(gameplay:NativeGameplayViewController,scene:NativeBoardScene,alreadyVisible:Bool=false,entering:@escaping()->Void={},entered:@escaping()->Void={})->Bool {
        guard let scope=gameplay.sourceScope,scope.current,scene.sourceTutorialThirdPresentationActive,
              sourceThirdDismissPhase == .backpackPrompt || sourceThirdDismissPhase == .waitingForCarrierArrival else{return false}
        overlay.presentBackpackPrompt(arcade:gameplay.engine.state.mode == .arcade)
        // Capture the anchor after the actual localized Backpack copy is laid out.
        scene.placeTutorialCarrier(frame:overlay.tutorialCarrierFrame(arcade:gameplay.engine.state.mode == .arcade),in:overlay)
        guard self.overlay.installSourceCTA(service:scope.service,current:{[weak self,weak gameplay,weak scene,weak scope] in
            guard let self,let gameplay,let scene,let scope else{return false}
            return !self.disposed && scope.current && gameplay.sourceScope === scope && gameplay.boardScene === scene && gameplay.engine.state.generation==self.generation && gameplay.engine.state.tutorial?.active==true && scene.sourceTutorialThirdPresentationActive
        },contact:{[weak self] in self?.onSourceCTAContact?()},activate:{[weak self] in self?.dismissSourceThirdStep()}) else{return false}
        if alreadyVisible{overlay.revealSourceClearCTA();entering();entered();return true}
        return overlay.transitionSourceSheetToThirdStep(entering:entering,entered:entered)
    }
    func gameplayEvent(_ event:NativeGameplayEvent) {
        guard !disposed else{return}
        if event.kind == .dragBegan {
            if sourceSubsequentPresentationEnabled,gameplay?.boardScene?.sourceTutorialThirdPresentationActive==true {
                if let id=event.tileIDs.first,let node=gameplay?.boardScene?.sourceNativeTileNode(id),!node.sourceLocked,node.sourceValue>0{dismissSourceThirdStep()}
                return
            }
            if let id=event.tileIDs.first,let node=gameplay?.boardScene?.sourceNativeTileNode(id) {
                sourceFirstMonitor?.pointerDown(node);sourceSecondMonitor?.pointerDown(node)
                if sourceIntroEnabled{sourceGuidedDragNode=node;sourceGuidedDragStep=displayedStep}
            }
            overlay.hidePointer()
        } else if event.kind == .blocked || event.kind == .dragCancelled {
            if !sourceIntroEnabled{overlay.restorePointer()}
        }
    }
    func pointerState(_ dragging:Bool) {
        guard !disposed else{return}
        if sourceSubsequentPresentationEnabled,gameplay?.boardScene?.sourceTutorialThirdPresentationActive==true{return}
        if dragging{overlay.hidePointer()}else if !sourceIntroEnabled{overlay.restorePointer()}
    }
    func sourceSnapBackCompleted(_ node:NativeDiceNode) {
        guard !disposed,sourceIntroEnabled,sourceGuidedDragNode === node,sourceGuidedDragStep==displayedStep,
            let gameplay,gameplay.engine.state.generation==generation,gameplay.engine.state.tutorial?.active==true,
            gameplay.sourceScope?.current==true,gameplay.boardScene?.sourceTutorialTargetCurrent(node)==true,
            let displayedStep,guidedStepAcceptsInteraction(displayedStep) else{return}
        sourceGuidedDragNode=nil;sourceGuidedDragStep=nil;overlay.restorePointer()
    }
    private func dismissSourceThirdStep(){
        guard !disposed,sourceSubsequentPresentationEnabled,sourceThirdDismissPhase == .backpackPrompt,
            let gameplay,let scene=gameplay.boardScene,let scope=gameplay.sourceScope,scope.current,
            gameplay.engine.state.generation==generation,gameplay.engine.state.tutorial?.active==true,
            gameplay.engine.state.tutorial?.step == .freePlay,gameplay.engine.state.tutorial?.waitingForWild==true,
            scene.sourceTutorialThirdPresentationActive else{return}
        sourceThirdDismissPhase = .exitingCTA
        _=overlay.exitSourceCTA{[weak self,weak gameplay,weak scene,weak scope] success in
            guard let self,let gameplay,let scene,let scope,success,!self.disposed,self.sourceThirdDismissPhase == .exitingCTA,
                scope.current,gameplay.sourceScope === scope,gameplay.boardScene === scene,gameplay.engine.state.generation==self.generation,
                gameplay.engine.state.tutorial?.active==true,scene.sourceTutorialThirdPresentationActive else{return}
            self.sourceGuidedDragNode=nil;self.sourceGuidedDragStep=nil;self.sourceThirdDismissPhase = .exitingSheet
            // The existing carrier root owns the full jump/rebound before opening.
            // Its original opening frames remain held until emphasis finishes.
            guard scene.resumeTutorialBackpackCarrier() else {
                scene.failSourceTutorialFourthPresentation("source_tutorial_backpack_resume_rejected",generation:self.generation);return
            }
            _=self.overlay.exitSourceThirdSheetForWild(completed:{[weak self,weak gameplay,weak scene,weak scope] in
                guard let self,let gameplay,let scene,let scope,!self.disposed,scope.current,gameplay.sourceScope === scope,gameplay.boardScene === scene,
                    gameplay.engine.state.generation==self.generation,self.sourceThirdDismissPhase == .exitingSheet else{return}
                self.overlay.retireBackpackPrompt()
                self.overlay.isHidden=true;self.sourceThirdDismissPhase = .waitingForWild
                scene.onTutorialBackpackArrived=nil
            })
        }
    }
    private func beginRestoredBackpackDelivery(gameplay:NativeGameplayViewController,scene:NativeBoardScene) {
        guard gameplay.tutorialVisualPresentationAllowed,scene.isBoardEntryComplete,
              let scope=gameplay.sourceScope,scope.current else{return}
        sourceThirdDismissPhase = .waitingForCarrierArrival
        gameplay.engine.setInputLock(arrivalLock,active:true)
        displayedStep = .freePlay
        overlay.frame=gameplay.view.bounds;overlay.autoresizingMask=[.flexibleWidth,.flexibleHeight]
        if overlay.superview==nil{gameplay.view.addSubview(overlay)}
        overlay.presentBackpackPrompt(arcade:gameplay.engine.state.mode == .arcade)
        scene.placeTutorialCarrier(frame:overlay.tutorialCarrierFrame(arcade:gameplay.engine.state.mode == .arcade),in:overlay)
        scene.onTutorialBackpackArrived = {[weak self,weak gameplay] in
            guard let self,let gameplay,!self.disposed,gameplay.engine.state.generation==self.generation,
                  self.sourceThirdDismissPhase == .waitingForCarrierArrival else{return}
            self.sourceThirdDismissPhase = .backpackPrompt;self.overlay.setBackpackReady(service:gameplay.sourceScope?.service)
        }
        overlay.show(step:3,from:nil,to:nil,initial:true,entering:{[weak self,weak gameplay,weak scene,weak scope] in
            guard let self,let gameplay,let scene,let scope,!self.disposed,scope.current,
                  gameplay.engine.state.generation==self.generation,self.sourceThirdDismissPhase == .waitingForCarrierArrival else{return}
            self.backpackDelayOwner=scene.sourceTutorialIntroTimeouts
            // Reveal the real carrier at80percent of the existing sheet entrance.
            self.backpackDelay=scene.sourceTutorialIntroTimeouts.schedule(sourceID:"tutorial-backpack-during-sheet",generation:self.generation,delayMilliseconds:NativeTutorialSheetMotion.carrierRevealDelayMilliseconds,elapsed:{[weak self,weak gameplay,weak scene,weak scope] in
                guard let self,let gameplay,let scene,let scope,!self.disposed,scope.current,
                      gameplay.engine.state.generation==self.generation,self.sourceThirdDismissPhase == .waitingForCarrierArrival else{return}
                self.backpackDelay=nil
                let result=gameplay.engine.dismissTutorialFreePlayGuide()
                guard result.accepted else{return}
                self.onChanged?(result.state)
                scene.requestSourceMeterQueueAfterSaveMounted()
            })
        })
    }

    private func beginSourceBackpackDelivery(gameplay:NativeGameplayViewController,scene:NativeBoardScene)->Bool {
        guard !disposed,sourceSubsequentPresentationEnabled,sourceThirdDismissPhase == .ready,
              gameplay.engine.state.generation==generation,gameplay.engine.state.tutorial?.specialBarAcknowledged==true,
              gameplay.engine.state.wildMeter>=1-0.000001,
              let scope=gameplay.sourceScope,scope.current,scene.sourceTutorialThirdPresentationActive else{return false}
        overlay.frame=gameplay.view.bounds
        overlay.setNeedsLayout();overlay.layoutIfNeeded()
        sourceThirdDismissPhase = .waitingForCarrierArrival
        gameplay.engine.setInputLock(arrivalLock,active:true)
        scene.onTutorialBackpackArrived = {[weak self,weak gameplay,weak scene,weak scope] in
            guard let self,let gameplay,let scene,let scope,!self.disposed,scope.current,
                  gameplay.sourceScope === scope,gameplay.boardScene === scene,
                  gameplay.engine.state.generation==self.generation,
                  self.sourceThirdDismissPhase == .waitingForCarrierArrival else{return}
            self.sourceThirdDismissPhase = .backpackPrompt
            self.overlay.setBackpackReady(service:gameplay.sourceScope?.service)
        }
        return showSourceClearStage(gameplay:gameplay,scene:scene,entering:{[weak self,weak gameplay,weak scene,weak scope] in
            guard let self,let gameplay,let scene,let scope,!self.disposed,scope.current,
                  gameplay.engine.state.generation==self.generation,self.sourceThirdDismissPhase == .waitingForCarrierArrival else{return}
            self.backpackDelayOwner=scene.sourceTutorialIntroTimeouts
            // Reveal the real carrier at80percent of the existing sheet entrance.
            self.backpackDelay=scene.sourceTutorialIntroTimeouts.schedule(sourceID:"tutorial-backpack-during-sheet",generation:self.generation,delayMilliseconds:NativeTutorialSheetMotion.carrierRevealDelayMilliseconds,elapsed:{[weak self,weak gameplay,weak scene,weak scope] in
                guard let self,let gameplay,let scene,let scope,!self.disposed,scope.current,
                      gameplay.engine.state.generation==self.generation,self.sourceThirdDismissPhase == .waitingForCarrierArrival else{return}
                self.backpackDelay=nil
                guard scene.restoreSourceTutorialAfterThirdDismiss() else{return}
                let result=gameplay.engine.dismissTutorialFreePlayGuide(sourceReservationOwnerID:self.sourceReservationOwnerID)
                guard result.accepted else{return}
                self.onChanged?(result.state)
                self.sourceFirstMonitor?.dispose();self.sourceSecondMonitor?.dispose()
                guard self.installSourceFourthMonitor(gameplay:gameplay,scene:scene) else{return}
                scene.requestSourceMeterQueueAfterSaveMounted()
            })
        })
    }

    @discardableResult private func installSourceFourthMonitor(gameplay:NativeGameplayViewController,scene:NativeBoardScene)->Bool {
        guard !disposed,sourceSubsequentPresentationEnabled,sourceFourthMonitor==nil,
            sourceThirdDismissPhase == .waitingForCarrierArrival,let scope=gameplay.sourceScope,scope.current,
            gameplay.boardScene === scene,scene.sourceTutorialThirdPresentationActive else{return false}
        let current:()->Bool = {[weak self,weak gameplay,weak scene,weak scope] in
            guard let self,let gameplay,let scene,let scope else{return false}
            let deliveryPhase:[ThirdDismissPhase] = [.waitingForCarrierArrival,.backpackPrompt,.exitingCTA,.exitingSheet,.waitingForWild]
            return !self.disposed && deliveryPhase.contains(self.sourceThirdDismissPhase) && scope.current &&
                gameplay.sourceScope === scope && gameplay.boardScene === scene &&
                gameplay.engine.state.generation==self.generation && gameplay.engine.state.tutorial?.active==true &&
                scene.sourceTutorialThirdPresentationActive
        }
        let monitor=NativeSourceTutorialFourthStepMonitor(service:scope.service,timeouts:scene.sourceTutorialIntroTimeouts,generation:generation,
            current:current,findWild:{[weak scene] in scene?.sourceTutorialFourthDroppingWild()},
            nodeCurrent:{[weak scene] in scene?.sourceTutorialTargetCurrent($0)==true},
            dropping:{[weak scene] in scene?.sourceTutorialWildIsDropping($0)==true},
            activate:{[weak self,weak scene] _ in
                guard let self,let scene,current(),let gameplay=self.gameplay else{return false}
                gameplay.engine.setInputLock(self.arrivalLock,active:true)
                scene.cancelDrag()
                guard current() else{return false}
                self.sourceGuidedDragNode=nil;self.sourceGuidedDragStep=nil
                let accepted=self.overlay.activateSourceFourthStepDim()
                if !accepted,current(){scene.failSourceTutorialFourthPresentation("source_tutorial_fourth_dim_rejected",generation:self.generation)}
                return accepted
            },
            transitionSheet:{[weak self,weak scene] callback in
                guard let self,let scene,current() else{return false}
                let accepted=self.overlay.transitionSourceSheetToFourthStep(entered:callback)
                if !accepted,current(){scene.failSourceTutorialFourthPresentation("source_tutorial_fourth_sheet_rejected",generation:self.generation)}
                return accepted
            },
            prepare:{[weak self,weak scene,weak gameplay] wild in
                guard let self,let scene,let gameplay,current() else{return false}
                guard scene.prepareSourceTutorialFourthStep(wild,ownerID:self.sourceReservationOwnerID),current() else{
                    if current(){scene.failSourceTutorialFourthPresentation("source_tutorial_fourth_prepare_rejected",generation:self.generation)};return false
                }
                guard self.overlay.startSourceFourthPointer(service:scope.service,timeouts:scene.sourceTutorialIntroTimeouts,
                    boardGeneration:self.generation,current:current,select:{[weak scene,weak wild] in
                        guard let scene,let wild,current() else{return nil};return scene.sourceTutorialFourthPointerPlan(wild)
                    }) else{
                        if current(){scene.failSourceTutorialFourthPresentation("source_tutorial_fourth_pointer_rejected",generation:self.generation)};return false
                    }
                guard self.installSourceFourthCompletion(gameplay:gameplay,scene:scene,wild:wild,current:current) else{
                    if current(){scene.failSourceTutorialFourthPresentation("source_tutorial_fourth_completion_monitor_rejected",generation:self.generation)};return false
                }
                gameplay.engine.setInputLock(self.arrivalLock,active:false)
                self.displayedStep = .special;self.onChanged?(gameplay.engine.state)
                return current()
            },sheetDelayMilliseconds:0,waitForLandingBeforeSheet:true)
        guard let monitor else{return false};sourceFourthMonitor=monitor
        guard monitor.start(),current() else{if sourceFourthMonitor === monitor{sourceFourthMonitor=nil};monitor.dispose();return false}
        scene.onTutorialSpecialDropStarted = {[weak monitor] wild in _=monitor?.activateDroppingWild(wild)}
        scene.onTutorialSpecialDropContact = {[weak monitor] wild in _=monitor?.contactWild(wild)}
        scene.onTutorialSpecialDropLanded = {[weak monitor] wild in _=monitor?.landedWild(wild)}
        return true
    }
    private func installSourceFourthCompletion(gameplay:NativeGameplayViewController,scene:NativeBoardScene,wild:NativeDiceNode,current:@escaping()->Bool)->Bool {
        guard sourceFourthCompletion==nil,let scope=gameplay.sourceScope,scope.current,current() else{return false}
        let owner=NativeSourceTutorialFourthCompletionMonitor(service:scope.service,timeouts:scene.sourceTutorialIntroTimeouts,generation:generation,
            current:current,isComplete:{[weak scene,weak wild] in guard let scene,let wild else{return false};return scene.sourceTutorialFourthStepIsComplete(wild) && scene.tutorialEncouragementMilestoneReached},
            complete:{[weak self,weak gameplay,weak scene,weak scope] in
                guard let self,let gameplay,let scene,let scope,current(),!self.sourceFourthCompleting else{return}
                self.sourceFourthCompleting=true;scene.sourceTutorialSetMeterSmokeFrozen(true)
                let finish:()->Void = { [weak self,weak gameplay,weak scene,weak scope] in
                    guard let self,let gameplay,let scene,let scope,current(),self.sourceFourthCompleting,
                        gameplay.sourceScope === scope,gameplay.boardScene === scene else{return}
                    guard scene.restoreSourceTutorialAfterFourthExit(ownerID:self.sourceReservationOwnerID),current() else{
                        if current(){scene.failSourceTutorialFourthPresentation("source_tutorial_fourth_restore_rejected",generation:self.generation)};return
                    }
                    let result=gameplay.engine.completeSourceTutorialFourthStep(ownerID:self.sourceReservationOwnerID,generation:self.generation)
                    guard result.accepted else{scene.failSourceTutorialFourthPresentation("source_tutorial_fourth_commit_rejected",generation:self.generation);return}
                    scene.finishSourceTutorialPresentation()
                    self.sourceFourthCompletion?.dispose();self.sourceFourthCompletion=nil
                    self.sourceFourthMonitor?.dispose();self.sourceFourthMonitor=nil
                    self.sourceThirdDismissPhase = .finished;self.sourceGuidedDragNode=nil;self.sourceGuidedDragStep=nil
                    let changed=self.onChanged
                    changed?(result.state)
                }
                if self.specialVisualExitStarted {finish();return}
                let exitStarted=self.overlay.exitSourceFourthStep(beforeSheet:{[weak self,weak scene] in
                    guard let self,let scene,current() else{return false}
                    return scene.beginSourceTutorialFourthExitFade(ownerID:self.sourceReservationOwnerID)
                },completed:finish)
                if !exitStarted,current(){scene.failSourceTutorialFourthPresentation("source_tutorial_fourth_exit_rejected",generation:self.generation)}
            })
        guard let owner else{return false};sourceFourthCompletion=owner
        guard owner.start(),current() else{if sourceFourthCompletion === owner{sourceFourthCompletion=nil};owner.dispose();return false};return true
    }
    private func dismissFreePlay() {
        if !sourceSubsequentPresentationEnabled,sourceThirdDismissPhase == .backpackPrompt,
           let gameplay,gameplay.engine.state.generation==generation {
            if overlay.sourceCTAState==nil{onFeedback?()}
            sourceThirdDismissPhase = .exitingSheet
            _=gameplay.boardScene?.resumeTutorialBackpackCarrier()
            overlay.hide{[weak self,weak gameplay] in
                guard let self,let gameplay,!self.disposed,gameplay.engine.state.generation==self.generation else{return}
                self.overlay.retireBackpackPrompt();self.sourceThirdDismissPhase = .waitingForWild
                gameplay.boardScene?.onTutorialBackpackArrived=nil
            }
            return
        }
        guard !disposed,let gameplay,gameplay.engine.state.generation==generation,
            gameplay.engine.state.tutorial?.step == .freePlay,gameplay.engine.state.tutorial?.waitingForWild == false else{return}
        if sourceSubsequentPresentationEnabled,gameplay.boardScene?.sourceTutorialThirdPresentationActive==true{dismissSourceThirdStep();return}
        onFeedback?()
        overlay.hide { [weak self] in
            guard let self,!self.disposed,let gameplay=self.gameplay,gameplay.engine.state.generation==self.generation else{return}
            let result=gameplay.engine.dismissTutorialFreePlayGuide()
            if result.accepted {self.sourceThirdDismissPhase = .waitingForWild;self.onChanged?(result.state);gameplay.refreshFromEngine()}
        }
    }
    private func scheduleSpecialBarIfReady() {
        guard !disposed,sourceThirdDismissPhase == .countingActions,
            let gameplay,gameplay.engine.state.generation==generation,gameplay.engine.state.tutorial?.specialBarReady==true,
            let scene=gameplay.boardScene else{return}
        let scope=gameplay.sourceScope
        guard scope == nil || scope?.current==true else{return}
        guard scene.onTutorialSpecialBarSettled==nil else{return}
        scene.onTutorialSpecialBarSettled = {[weak self,weak gameplay,weak scene,weak scope] in
            guard let self else{return}
            guard let gameplay,let scene,!self.disposed,(scope == nil || scope?.current==true),gameplay.sourceScope === scope,gameplay.boardScene === scene,
                gameplay.engine.state.generation==self.generation,gameplay.engine.state.terminal==nil,
                gameplay.engine.state.tutorial?.specialBarReady==true,self.sourceThirdDismissPhase == .countingActions else{return}
            guard scene.tutorialSpecialBarSettled else{return}
            scene.onTutorialSpecialBarSettled=nil
            gameplay.engine.setInputLock(self.specialBarLock,active:true)
            guard scene.showTutorialSpecialBarFocus() else{gameplay.engine.setInputLock(self.specialBarLock,active:false);self.scheduleSpecialBarIfReady();return}
            self.sourceThirdDismissPhase = .specialBar
            if self.overlay.superview==nil{self.overlay.frame=gameplay.view.bounds;self.overlay.autoresizingMask=[.flexibleWidth,.flexibleHeight];gameplay.view.addSubview(self.overlay)}
            scene.onTutorialSpecialBarInteraction = {[weak self] tile in guard let self,self.gameplay?.engine.canBeginDrag(tileID:tile.id,ignoringInputLock:self.specialBarLock)==true else{return false};return self.dismissSpecialBar(forInteraction:true)}
            gameplay.focusTutorialSpecialBarSiblings(excluding:self.overlay)
            if self.overlay.specialBarVisible {self.overlay.admitSpecialBarInteraction()}
            else if !self.overlay.showSpecialBar(entered:{}){scene.onTutorialSpecialBarInteraction=nil;gameplay.restoreTutorialSpecialBarSiblings();scene.restoreTutorialSpecialBarFocus();gameplay.engine.setInputLock(self.specialBarLock,active:false);self.sourceThirdDismissPhase = .countingActions;scene.failSourceTutorialFourthPresentation("tutorial_special_bar_sheet_rejected",generation:self.generation)}
        }
        if scene.tutorialSpecialBarSettled{scene.onTutorialSpecialBarSettled?()}
    }
    private func restoreSpecialBarFocus(_ gameplay:NativeGameplayViewController) {
        gameplay.boardScene?.onTutorialSpecialBarInteraction=nil
        gameplay.restoreTutorialSpecialBarSiblings();gameplay.boardScene?.restoreTutorialSpecialBarFocus()
        gameplay.engine.setInputLock(specialBarLock,active:false)
    }
    private func continueSpecialBar(){_=dismissSpecialBar(forInteraction:false)}
    @discardableResult private func dismissSpecialBar(forInteraction:Bool)->Bool {
        guard !disposed,!specialBarExiting,sourceThirdDismissPhase == .specialBar,let gameplay,
            gameplay.engine.state.generation==generation,gameplay.engine.state.tutorial?.specialBarReady==true else{return false}
        specialBarExiting=true;gameplay.boardScene?.onTutorialSpecialBarInteraction=nil
        if !forInteraction{onFeedback?()}
        if forInteraction {
            let result=gameplay.engine.acknowledgeTutorialSpecialBar(sourceReservationOwnerID:sourceSubsequentPresentationEnabled ? sourceReservationOwnerID:nil)
            guard result.accepted else{specialBarExiting=false;gameplay.boardScene?.onTutorialSpecialBarInteraction = {[weak self] tile in guard let self,self.gameplay?.engine.canBeginDrag(tileID:tile.id,ignoringInputLock:self.specialBarLock)==true else{return false};return self.dismissSpecialBar(forInteraction:true)};return false}
            // The same physical down may acquire its genuine pickup now;
            // captured dim paint fades with the sheet before final restoration.
            gameplay.engine.setInputLock(specialBarLock,active:false)
        }
        gameplay.boardScene?.beginTutorialSpecialBarFocusExit()
        let completed:()->Void = {[weak self,weak gameplay] in
            guard let self,let gameplay,!self.disposed,gameplay.engine.state.generation==self.generation,
                self.sourceThirdDismissPhase == .specialBar else{return}
            if !forInteraction {
                let result=gameplay.engine.acknowledgeTutorialSpecialBar(sourceReservationOwnerID:self.sourceSubsequentPresentationEnabled ? self.sourceReservationOwnerID:nil)
                guard result.accepted else{self.restoreSpecialBarFocus(gameplay);self.specialBarExiting=false;self.sourceThirdDismissPhase = .countingActions;self.scheduleSpecialBarIfReady();return}
            }
            self.restoreSpecialBarFocus(gameplay)
            let reveal:()->Void = {[weak self,weak gameplay] in
                guard let self,let gameplay,!self.disposed,gameplay.engine.state.generation==self.generation else{return}
                self.specialBarExiting=false;self.sourceThirdDismissPhase = .ready
                self.onChanged?(gameplay.engine.state);gameplay.refreshFromEngine()
            }
            gameplay.boardScene?.onTutorialBoardFocusSettled=nil
            gameplay.boardScene?.setTutorialBoardFocus(nil)
            // The previous exit is the handoff. Dice opacity restores in
            // parallel with Clear's entry on the same existing paint owner.
            reveal()
        }
        let started=overlay.hideSpecialBar(completed:completed)
        if !started{specialBarExiting=false;restoreSpecialBarFocus(gameplay);gameplay.boardScene?.failSourceTutorialFourthPresentation("tutorial_special_bar_exit_rejected",generation:generation)}
        return started
    }
    func dispose() {
        guard !disposed else{return}
        disposed=true
        if let delay=backpackDelay{_=backpackDelayOwner?.cancel(delay)}
        backpackDelay=nil;backpackDelayOwner=nil
        let gameplay=self.gameplay
        gameplay?.onTutorialBackpackVisitClosed=nil;collectionVisitPending=false
        gameplay?.boardScene?.setTutorialBoardFocus(nil)
        gameplay?.boardScene?.onTutorialBoardFocusSettled=nil
        gameplay?.boardScene?.onTutorialWildAnimationProgress=nil
        gameplay?.boardScene?.onTutorialSpecialDropStarted=nil
        gameplay?.boardScene?.onTutorialBackpackArrived=nil
        gameplay?.boardScene?.onTutorialBackpackPaint=nil
        gameplay?.boardScene?.onTutorialSpecialDropContact=nil
        gameplay?.boardScene?.onTutorialSpecialDropLanded=nil
        gameplay?.boardScene?.onTutorialEncouragementSettled=nil
        if gameplay?.engine.state.generation==generation {gameplay?.boardScene?.setTutorialCollectionPreviewHUD(false)}
        gameplay?.boardScene?.onTutorialSpecialBarInteraction=nil
        gameplay?.boardScene?.onTutorialSpecialBarSettled=nil
        gameplay?.restoreTutorialSpecialBarSiblings()
        gameplay?.boardScene?.restoreTutorialSpecialBarFocus()
        gameplay?.engine.setInputLock(arrivalLock,active:false)
        gameplay?.engine.setInputLock(specialBarLock,active:false)
        gameplay?.engine.setInputLock(objectiveLock,active:false)
        if gameplay?.engine.state.generation==generation {gameplay?.engine.setTutorialComboPaused(false,now:CACurrentMediaTime())}
        gameplay?.engine.setInputLock(completionLock,active:false)
        gameplay?.engine.setInputLock(comboLock,active:false)
        gameplay?.engine.setInputLock(collectionLock,active:false)
        sourceFourthCompletion?.dispose();sourceFourthCompletion=nil
        sourceFourthMonitor?.dispose();sourceFourthMonitor=nil
        _=gameplay?.engine.retireSourceTutorialWildReservation(ownerID:sourceReservationOwnerID,generation:generation)
        sourceThirdDismissPhase = .retired;sourceGuidedDragNode=nil;sourceGuidedDragStep=nil
        if let timer=sourceThirdHintTimer{_=sourceThirdHintTimeouts?.cancel(timer)}
        sourceThirdHintTimer=nil;sourceThirdHintTimeouts=nil
        sourceFirstMonitor?.dispose();sourceFirstMonitor=nil
        sourceSecondMonitor?.dispose();sourceSecondMonitor=nil
        overlay.dispose()
        for token in observers {NotificationCenter.default.removeObserver(token)}
        observers.removeAll();onChanged=nil;onFeedback=nil;onSpeechEvent=nil;onSourceCTAContact=nil
        self.gameplay=nil
    }
}
