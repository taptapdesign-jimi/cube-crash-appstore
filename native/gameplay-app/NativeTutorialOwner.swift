import UIKit
import SpriteKit
import StackToSixGameplay

/// Connects the pure tutorial policy to one native sheet/pointer lease.
/// Run completion is committed by the result owner, never by this overlay.
@MainActor
final class NativeTutorialOwner {
    private weak var gameplay:NativeGameplayViewController?
    private let overlay:NativeTutorialOverlay
    enum ThirdDismissPhase:Equatable{case ready,exitingCTA,exitingSheet,countingActions,specialBar,waitingForWild,finished,retired}
    private(set) var sourceThirdDismissPhase=ThirdDismissPhase.ready
    var onSourceCTAContact:(()->Void)?
    private let sourceReservationOwnerID=UUID().uuidString
    var sourceActivationEnabled=false
    var sourceIntroEnabled=false
    var sourceSubsequentPresentationEnabled=false
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
    private var specialBarLock:String{"tutorial-special-bar:\(sourceReservationOwnerID):\(generation)"}
    private var secondRepairFrame:NativeSourceAnimationClockService.SourceFrameLease?
    var sourceFirstMonitorPhase:NativeSourceTutorialFirstStepMonitor.Phase?{sourceFirstMonitor?.phase}
    var sourceDisplayedStep:NativeTutorialState.Step?{displayedStep}
    private weak var sourceGuidedDragNode:NativeDiceNode?
    private var sourceGuidedDragStep:NativeTutorialState.Step?
    private var displayedStep:NativeTutorialState.Step?
    private var disposed=false,generation:UInt64
    private var observers:[NSObjectProtocol]=[]
    var onChanged:((NativeBoardState)->Void)?
    var onFeedback:(()->Void)?
    init(gameplay:NativeGameplayViewController,root:URL) {
        self.gameplay=gameplay;generation=gameplay.engine.state.generation;overlay=NativeTutorialOverlay(resourceRoot:root)
        overlay.onGotIt = { [weak self] in self?.dismissFreePlay() }
        overlay.onSpecialBarContinue = { [weak self] in self?.continueSpecialBar() }
        for (name,suspended) in [(UIApplication.willResignActiveNotification,true),(UIApplication.didBecomeActiveNotification,false)] {
            observers.append(NotificationCenter.default.addObserver(forName:name,object:nil,queue:.main) {[weak self] _ in MainActor.assumeIsolated {self?.overlay.setSuspended(suspended)}})
        }
    }
    func refresh(_ state:NativeBoardState) {
        guard !disposed,state.generation==generation,let gameplay else{return}
        guard let tutorial=state.tutorial,tutorial.active,state.terminal==nil else {gameplay.boardScene?.onTutorialSpecialDropStarted=nil;gameplay.boardScene?.onTutorialSpecialBarInteraction=nil;gameplay.boardScene?.onTutorialSpecialBarSettled=nil;gameplay.boardScene?.restoreTutorialSpecialBarFocus();gameplay.restoreTutorialSpecialBarSiblings();gameplay.engine.setInputLock(specialBarLock,active:false);overlay.dispose();displayedStep=nil;return}
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
        if sourceActivationEnabled,state.tutorial?.step == .stack,!scene.sourceTutorialPreparationReady{return}
        if sourceFirstStepMonitorEnabled,displayedStep==nil,tutorial.step == .stack,sourceFirstMonitor==nil {
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
        if tutorial.waitingForWild {overlay.isHidden=true;return}
        if displayedStep != tutorial.step {
            if sourceIntroEnabled,displayedStep==nil,tutorial.step == .stack {
                guard let scope=gameplay.sourceScope,scope.current,scene.sourceTutorialPreparationReady,
                    overlay.showSourceIntro(from:from,to:to,service:scope.service,timeouts:scene.sourceTutorialIntroTimeouts,
                        boardGeneration:generation,immediateSheet:true,current:{[weak self,weak gameplay,weak scene,weak scope] in
                            guard let self,let gameplay,let scene,let scope else{return false}
                            return !self.disposed && scope.current && gameplay.sourceScope === scope && gameplay.boardScene === scene &&
                                gameplay.engine.state.generation==self.generation && gameplay.engine.state.tutorial?.active==true && (self.sourceFirstStepMonitorEnabled || gameplay.engine.state.tutorial?.step == .stack) && scene.sourceTutorialPreparationReady
                        }) else{return}
            } else {overlay.show(step:tutorial.step.rawValue,from:from,to:to,initial:displayedStep==nil,moves:moves)}
            displayedStep=tutorial.step
        }
        else {overlay.updateTargets(from:from,to:to)}
    }
    private func installSourceFirstMonitor(gameplay:NativeGameplayViewController,scene:NativeBoardScene)->Bool {
        guard let scope=gameplay.sourceScope,scope.current,let targets=scene.sourceTutorialFirstStepTargets() else{return false}
        let monitor=NativeSourceTutorialFirstStepMonitor(service:scope.service,timeouts:scene.sourceTutorialIntroTimeouts,generation:generation,targets:targets,parent:scene.sourceTutorialCapturedParent,
            current:{[weak self,weak gameplay,weak scene,weak scope] in
                guard let self,let gameplay,let scene,let scope else{return false}
                return !self.disposed && gameplay.engine.state.generation==self.generation && gameplay.engine.state.tutorial?.active==true &&
                    scope.current && gameplay.sourceScope === scope && gameplay.boardScene === scene && scene.sourceTutorialFirstStepPresentationActive
            },targetCurrent:{[weak scene] in scene?.sourceTutorialTargetCurrent($0)==true},
            pointerExit:{[weak self] callback in self?.overlay.sourceIntroOwner?.popOutPointer(completed:callback)==true},
            sheetExit:{[weak self] callback in self?.overlay.sourceIntroOwner?.exitSheet(completed:callback)==true},
            activate:{[weak self,weak gameplay,weak scene,weak scope] merged in
                guard let self,let gameplay,let scene,let scope,!self.disposed,scope.current,gameplay.sourceScope === scope,
                    gameplay.engine.state.generation==self.generation,scene.prepareSourceTutorialSecondStep(merged),let geometry=scene.boardGeometry,
                    let tutorial=gameplay.engine.state.tutorial else{return false}
                let points=tutorial.guidedPair.compactMap{id -> CGPoint? in guard let tile=gameplay.engine.state.tiles.first(where:{$0.id==id}) else{return nil};let p=geometry.center(row:tile.cell.row,column:tile.cell.column);return CGPoint(x:p.x,y:scene.size.height-p.y)}
                guard points.count==2 else{return false}
                self.displayedStep = .mergeSix
                if self.sourceSubsequentPresentationEnabled,!self.installSourceSecondMonitor(gameplay:gameplay,scene:scene){return false}
                // Pointer400 is a real independent wall timer, armed before the
                // second exit/enter sheet graph, exactly like Source.
                self.overlay.scheduleSourceSecondStepPointer()
                return self.overlay.transitionSourceSheetToSecondStep(from:points[0],to:points[1],entered:{[weak self,weak scene,weak scope] in
                    guard let self,let scene,let scope,!self.disposed,scope.current,scene.sourceTutorialSecondPreparationReady else{return}
                    self.secondRepairFrame=scope.service.requestSourceAnimationFrame(ownerID:"tutorial-second-sheet-repair:\(self.generation)",generation:self.generation,callback:{[weak self,weak scene] in
                        guard let self,!self.disposed else{return};self.secondRepairFrame=nil
                        if scene?.repairSourceTutorialSecondStep()==true{self.overlay.updateTargets(from:points[0],to:points[1])}
                    },onCancelled:{[weak self] in self?.secondRepairFrame=nil})
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
            },hasUnlockedSix:{[weak scene] in scene?.sourceTutorialHasUnlockedSix==true},nodeCurrent:{[weak scene] in scene?.sourceTutorialTargetCurrent($0)==true},
            pointerExit:{[weak self] callback in self?.overlay.sourceIntroOwner?.popOutPointer(completed:callback)==true},
            sheetExit:{[weak self] callback in self?.overlay.sourceIntroOwner?.exitSheet(completed:callback)==true},
            activate:{[weak self,weak gameplay,weak scene,weak scope] in
                guard let self,let gameplay,let scene,let scope,!self.disposed,scope.current,gameplay.sourceScope === scope,scene.prepareSourceTutorialThirdStep() else{return false}
                self.sourceGuidedDragNode=nil;self.sourceGuidedDragStep=nil;self.displayedStep = .freePlay
                self.sourceThirdDismissPhase = .countingActions
                self.scheduleSpecialBarIfReady()
                return true
            })
        guard let monitor else{return false};sourceSecondMonitor=monitor
        if !monitor.start(){sourceSecondMonitor=nil;monitor.dispose();return false};return true
    }
    @discardableResult private func showSourceClearStage(gameplay:NativeGameplayViewController,scene:NativeBoardScene)->Bool {
        guard let scope=gameplay.sourceScope,scope.current,scene.sourceTutorialThirdPresentationActive else{return false}
        guard self.overlay.installSourceCTA(service:scope.service,current:{[weak self,weak gameplay,weak scene,weak scope] in
            guard let self,let gameplay,let scene,let scope else{return false}
            return !self.disposed && scope.current && gameplay.sourceScope === scope && gameplay.boardScene === scene && gameplay.engine.state.generation==self.generation && gameplay.engine.state.tutorial?.active==true && scene.sourceTutorialThirdPresentationActive
        },contact:{[weak self] in self?.onSourceCTAContact?()},activate:{[weak self] in self?.dismissSourceThirdStep()}) else{return false}
        // Sheet completion owns the original independent hint260 wall
        // boundary; CTA/fourth-Wild admission remains separate.
        return self.overlay.transitionSourceSheetToThirdStep(entered:{[weak self,weak gameplay,weak scene,weak scope] in
            guard let self,let gameplay,let scene,let scope,!self.disposed,scope.current,scene.sourceTutorialThirdPresentationActive,self.sourceThirdDismissPhase == .ready else{return}
            self.sourceThirdHintTimeouts=scene.sourceTutorialIntroTimeouts
            self.sourceThirdHintTimer=scene.sourceTutorialIntroTimeouts.schedule(sourceID:"tutorial-third-hint260",generation:self.generation,delayMilliseconds:260,elapsed:{[weak self,weak gameplay,weak scene,weak scope] in
                guard let self else{return};self.sourceThirdHintTimer=nil
                guard let gameplay,let scene,let scope,!self.disposed,scope.current,gameplay.sourceScope === scope,gameplay.engine.state.generation==self.generation,scene.sourceTutorialThirdPresentationActive,self.sourceThirdDismissPhase == .ready,
                    let plan=scene.sourceTutorialFreePlayPlan(),!plan.moves.isEmpty else{return}
                let key="step3:\(Int64(Date().timeIntervalSince1970*1000)):\(scope.mathRandom.next())"
                _=self.overlay.startSourceFreePlayHint(plan:plan,service:scope.service,key:key,current:{[weak self,weak gameplay,weak scene,weak scope] in
                    guard let self,let gameplay,let scene,let scope else{return false};return !self.disposed && scope.current && gameplay.sourceScope === scope && gameplay.engine.state.generation==self.generation && scene.sourceTutorialThirdPresentationActive && gameplay.engine.state.tutorial?.active==true && gameplay.engine.state.tutorial?.step == .freePlay
                })
            })
        })
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
            gameplay.sourceScope?.current==true,gameplay.boardScene?.sourceTutorialTargetCurrent(node)==true else{return}
        sourceGuidedDragNode=nil;sourceGuidedDragStep=nil;overlay.restorePointer()
    }
    private func dismissSourceThirdStep(){
        guard !disposed,sourceSubsequentPresentationEnabled,sourceThirdDismissPhase == .ready,
            let gameplay,let scene=gameplay.boardScene,let scope=gameplay.sourceScope,scope.current,
            gameplay.engine.state.generation==generation,gameplay.engine.state.tutorial?.active==true,
            gameplay.engine.state.tutorial?.step == .freePlay,gameplay.engine.state.tutorial?.waitingForWild==false,
            scene.sourceTutorialThirdPresentationActive else{return}
        sourceThirdDismissPhase = .exitingCTA
        _=overlay.exitSourceCTA{[weak self,weak gameplay,weak scene,weak scope] success in
            guard let self,let gameplay,let scene,let scope,success,!self.disposed,self.sourceThirdDismissPhase == .exitingCTA,
                scope.current,gameplay.sourceScope === scope,gameplay.boardScene === scene,gameplay.engine.state.generation==self.generation,
                gameplay.engine.state.tutorial?.active==true,scene.sourceTutorialThirdPresentationActive else{return}
            self.overlay.stopSourceFreePlayHintAndPopOutPointer()
            guard scene.restoreSourceTutorialAfterThirdDismiss() else{return}
            // Clear Stage retains the original forced-Star reservation owner.
            let result=gameplay.engine.dismissTutorialFreePlayGuide(sourceReservationOwnerID:self.sourceReservationOwnerID)
            guard result.accepted else{return};self.onChanged?(result.state)
            guard !self.disposed,scope.current,gameplay.sourceScope === scope,gameplay.boardScene === scene,gameplay.engine.state.generation==self.generation else{return}
            self.sourceGuidedDragNode=nil;self.sourceGuidedDragStep=nil;self.sourceThirdDismissPhase = .exitingSheet
            self.sourceFirstMonitor?.dispose();self.sourceSecondMonitor?.dispose()
            _=self.overlay.exitSourceThirdSheetForWild(completed:{[weak self,weak gameplay,weak scene,weak scope] in
                guard let self,let gameplay,let scene,let scope,!self.disposed,scope.current,gameplay.sourceScope === scope,gameplay.boardScene === scene,
                    gameplay.engine.state.generation==self.generation,self.sourceThirdDismissPhase == .exitingSheet else{return}
                self.overlay.isHidden=true;self.sourceThirdDismissPhase = .waitingForWild
                if !self.installSourceFourthMonitor(gameplay:gameplay,scene:scene){scene.failSourceTutorialFourthPresentation("source_tutorial_fourth_monitor_rejected",generation:self.generation)}
                scene.requestSourceMeterQueueAfterSaveMounted()
            })
        }
    }
    /// Installed only after the actual third sheet exits. Discovery and drop
    /// state belong to the captured Scene/meter caller, never a synthetic tile.
    @discardableResult private func installSourceFourthMonitor(gameplay:NativeGameplayViewController,scene:NativeBoardScene)->Bool {
        guard !disposed,sourceSubsequentPresentationEnabled,sourceFourthMonitor==nil,
            sourceThirdDismissPhase == .waitingForWild,let scope=gameplay.sourceScope,scope.current,
            gameplay.boardScene === scene,scene.sourceTutorialThirdPresentationActive else{return false}
        let current:()->Bool = {[weak self,weak gameplay,weak scene,weak scope] in
            guard let self,let gameplay,let scene,let scope else{return false}
            return !self.disposed && self.sourceThirdDismissPhase == .waitingForWild && scope.current &&
                gameplay.sourceScope === scope && gameplay.boardScene === scene &&
                gameplay.engine.state.generation==self.generation && gameplay.engine.state.tutorial?.active==true &&
                scene.sourceTutorialThirdPresentationActive
        }
        let monitor=NativeSourceTutorialFourthStepMonitor(service:scope.service,timeouts:scene.sourceTutorialIntroTimeouts,generation:generation,
            current:current,findWild:{[weak scene] in scene?.sourceTutorialFourthDroppingWild()},
            nodeCurrent:{[weak scene] in scene?.sourceTutorialTargetCurrent($0)==true},
            dropping:{[weak scene] in scene?.sourceTutorialWildIsDropping($0)==true},
            activate:{[weak self,weak scene] _ in
                guard let self,let scene,current() else{return false};self.sourceGuidedDragNode=nil;self.sourceGuidedDragStep=nil
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
                self.displayedStep = .special;self.onChanged?(gameplay.engine.state)
                return current()
            },sheetDelayMilliseconds:0)
        guard let monitor else{return false};sourceFourthMonitor=monitor
        guard monitor.start(),current() else{if sourceFourthMonitor === monitor{sourceFourthMonitor=nil};monitor.dispose();return false}
        scene.onTutorialSpecialDropStarted = {[weak monitor] wild in _=monitor?.activateDroppingWild(wild)}
        return true
    }
    private func installSourceFourthCompletion(gameplay:NativeGameplayViewController,scene:NativeBoardScene,wild:NativeDiceNode,current:@escaping()->Bool)->Bool {
        guard sourceFourthCompletion==nil,let scope=gameplay.sourceScope,scope.current,current() else{return false}
        let owner=NativeSourceTutorialFourthCompletionMonitor(service:scope.service,timeouts:scene.sourceTutorialIntroTimeouts,generation:generation,
            current:current,isComplete:{[weak scene,weak wild] in guard let scene,let wild else{return false};return scene.sourceTutorialFourthStepIsComplete(wild)},
            complete:{[weak self,weak gameplay,weak scene,weak scope] in
                guard let self,let gameplay,let scene,let scope,current(),!self.sourceFourthCompleting else{return}
                self.sourceFourthCompleting=true;scene.sourceTutorialSetMeterSmokeFrozen(true)
                let exitStarted=self.overlay.exitSourceFourthStep(beforeSheet:{[weak self,weak scene] in
                    guard let self,let scene,current() else{return false}
                    let admitted=scene.beginSourceTutorialFourthExitFade(ownerID:self.sourceReservationOwnerID)
                    if !admitted,current(){scene.failSourceTutorialFourthPresentation("source_tutorial_fourth_fade_rejected",generation:self.generation)}
                    return admitted
                }){[weak self,weak gameplay,weak scene,weak scope] in
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
                    self.overlay.dispose();self.onChanged?(result.state)
                }
                if !exitStarted,current(){scene.failSourceTutorialFourthPresentation("source_tutorial_fourth_exit_rejected",generation:self.generation)}
            })
        guard let owner else{return false};sourceFourthCompletion=owner
        guard owner.start(),current() else{if sourceFourthCompletion === owner{sourceFourthCompletion=nil};owner.dispose();return false};return true
    }
    private func dismissFreePlay() {
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
            if !self.overlay.showSpecialBar(entered:{}){scene.onTutorialSpecialBarInteraction=nil;gameplay.restoreTutorialSpecialBarSiblings();scene.restoreTutorialSpecialBarFocus();gameplay.engine.setInputLock(self.specialBarLock,active:false);self.sourceThirdDismissPhase = .countingActions;scene.failSourceTutorialFourthPresentation("tutorial_special_bar_sheet_rejected",generation:self.generation)}
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
        if forInteraction {
            let result=gameplay.engine.acknowledgeTutorialSpecialBar(sourceReservationOwnerID:sourceSubsequentPresentationEnabled ? sourceReservationOwnerID:nil)
            guard result.accepted else{specialBarExiting=false;gameplay.boardScene?.onTutorialSpecialBarInteraction = {[weak self] tile in guard let self,self.gameplay?.engine.canBeginDrag(tileID:tile.id,ignoringInputLock:self.specialBarLock)==true else{return false};return self.dismissSpecialBar(forInteraction:true)};return false}
            // The same physical down may acquire its genuine pickup now;
            // captured dim paint fades with the sheet before final restoration.
            gameplay.engine.setInputLock(specialBarLock,active:false)
        }
        gameplay.boardScene?.beginTutorialSpecialBarFocusExit()
        let started=overlay.hideSpecialBar(completed:{[weak self,weak gameplay] in
            guard let self,let gameplay,!self.disposed,gameplay.engine.state.generation==self.generation,
                self.sourceThirdDismissPhase == .specialBar else{return}
            if !forInteraction {
                let result=gameplay.engine.acknowledgeTutorialSpecialBar(sourceReservationOwnerID:self.sourceSubsequentPresentationEnabled ? self.sourceReservationOwnerID:nil)
                guard result.accepted else{self.restoreSpecialBarFocus(gameplay);self.specialBarExiting=false;self.sourceThirdDismissPhase = .countingActions;self.scheduleSpecialBarIfReady();return}
            }
            self.restoreSpecialBarFocus(gameplay)
            self.specialBarExiting=false;self.sourceThirdDismissPhase = .ready
            self.onChanged?(gameplay.engine.state);gameplay.refreshFromEngine()
            if self.sourceSubsequentPresentationEnabled,let scene=gameplay.boardScene,scene.sourceTutorialThirdPresentationActive,!self.showSourceClearStage(gameplay:gameplay,scene:scene){scene.failSourceTutorialFourthPresentation("source_tutorial_clear_sheet_rejected",generation:self.generation)}
        })
        if !started{specialBarExiting=false;restoreSpecialBarFocus(gameplay);gameplay.boardScene?.failSourceTutorialFourthPresentation("tutorial_special_bar_exit_rejected",generation:generation)}
        return started
    }
    func dispose() {guard !disposed else{return};gameplay?.boardScene?.onTutorialSpecialDropStarted=nil;gameplay?.restoreTutorialSpecialBarSiblings();gameplay?.boardScene?.onTutorialSpecialBarInteraction=nil;gameplay?.boardScene?.onTutorialSpecialBarSettled=nil;gameplay?.boardScene?.restoreTutorialSpecialBarFocus();gameplay?.engine.setInputLock(specialBarLock,active:false);disposed=true;sourceFourthCompletion?.dispose();sourceFourthCompletion=nil;sourceFourthMonitor?.dispose();sourceFourthMonitor=nil;_=gameplay?.engine.retireSourceTutorialWildReservation(ownerID:sourceReservationOwnerID,generation:generation);sourceThirdDismissPhase = .retired;sourceGuidedDragNode=nil;sourceGuidedDragStep=nil;if let timer=sourceThirdHintTimer{_=sourceThirdHintTimeouts?.cancel(timer)};sourceThirdHintTimer=nil;sourceThirdHintTimeouts=nil;sourceFirstMonitor?.dispose();sourceFirstMonitor=nil;sourceSecondMonitor?.dispose();sourceSecondMonitor=nil;secondRepairFrame?.cancel();secondRepairFrame=nil;overlay.dispose();for token in observers {NotificationCenter.default.removeObserver(token)};observers.removeAll();onChanged=nil;onFeedback=nil;onSourceCTAContact=nil;gameplay=nil}
}
