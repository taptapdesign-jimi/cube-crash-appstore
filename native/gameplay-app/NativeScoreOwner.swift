import UIKit
import StackToSixGameplay
import StackToSixNativeState

@MainActor
final class NativeScoreOwner {
    private weak var gameplay:NativeGameplayViewController?
    private let root:URL,progression:()->NativeProgressionState
    private var sheet:NativeScoreModal?,lease=0
    private var observers:[NSObjectProtocol]=[]
    var onFeedback:((String)->Void)?
    init(gameplay:NativeGameplayViewController,root:URL,progression:@escaping ()->NativeProgressionState) {
        self.gameplay=gameplay;self.root=root;self.progression=progression
        gameplay.onHelp = { [weak self] in self?.present(combo:false) }
        gameplay.onScore = { [weak self] in self?.present(combo:false) }
        gameplay.onCombo = { [weak self] in self?.present(combo:true) }
        for (name,suspended) in [(UIApplication.willResignActiveNotification,true),(UIApplication.didBecomeActiveNotification,false)] {
            observers.append(NotificationCenter.default.addObserver(forName:name,object:nil,queue:.main) {[weak self] _ in MainActor.assumeIsolated {self?.sheet?.setSuspended(suspended)}})
        }
    }
    func present(combo:Bool) {
        guard let gameplay,sheet==nil,gameplay.presentedViewController==nil,
            gameplay.boardScene?.navigationLocked != true,gameplay.engine.state.terminal==nil,
            gameplay.engine.state.tutorial?.shouldLockHUD != true,
            UIApplication.shared.applicationState == .active else{return}
        gameplay.setSuspended(true);lease += 1;let token=lease
        let modal=NativeScoreModal(model:.init(state:gameplay.engine.state,progression:progression(),combo:combo),root:root)
        sheet=modal;onFeedback?("hud-modal-open")
        modal.onClosed = { [weak self] in guard let self,self.lease==token else{return};self.sheet=nil;self.onFeedback?("back");self.gameplay?.setSuspended(false) }
        gameplay.present(modal,animated:false)
    }
    func dispose() {lease += 1;sheet?.dispose();sheet?.dismiss(animated:false);sheet=nil;for token in observers {NotificationCenter.default.removeObserver(token)};observers.removeAll();gameplay?.onHelp=nil;gameplay?.onScore=nil;gameplay?.onCombo=nil;gameplay=nil;onFeedback=nil}
}
