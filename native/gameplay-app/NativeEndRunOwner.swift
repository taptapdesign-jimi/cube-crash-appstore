import UIKit
import StackToSixGameplay

/// Native pause/save/action owner. The existing authored modal remains presentation-only.
@MainActor
final class NativeEndRunOwner {
    private weak var gameplay:NativeGameplayViewController?
    private let assets:JimiV9Artwork
    private let save:()->Bool
    private let restart:()->Void
    private let exit:()->Void
    private var modal:JimiNativeEndRunModal?
    private var generation = 0
    private var observers:[NSObjectProtocol] = []
    var onFeedback:((String)->Void)?
    init(gameplay:NativeGameplayViewController,resourceRoot:URL,save:@escaping ()->Bool,
         restart:@escaping ()->Void,exit:@escaping ()->Void) {
        self.gameplay = gameplay;assets = JimiV9Artwork(resourceRoot:resourceRoot)
        self.save = save;self.restart = restart;self.exit = exit
        gameplay.onExit = { [weak self] in self?.present() }
        observers.append(NotificationCenter.default.addObserver(forName:UIApplication.willResignActiveNotification,object:nil,queue:.main) { [weak self] _ in
            MainActor.assumeIsolated {self?.modal?.suspend()}
        })
        observers.append(NotificationCenter.default.addObserver(forName:UIApplication.didBecomeActiveNotification,object:nil,queue:.main) { [weak self] _ in
            MainActor.assumeIsolated {self?.modal?.resume()}
        })
    }
    private func present() {
        guard let gameplay,modal == nil,gameplay.presentedViewController == nil,
              gameplay.boardScene?.navigationLocked != true,gameplay.engine.state.terminal == nil,
              UIApplication.shared.applicationState == .active else{return}
        gameplay.setSuspended(true)
        guard save() else {gameplay.setSuspended(false);return}
        generation += 1;let owner = generation
        let state = gameplay.engine.state,arcade = state.mode == .arcade
        let progress = arcade ? String(format:"Round %02d",state.stage) : "Stage \((state.board-1)%10+1)"
        guard let model = JimiNativeEndRunModel(["title":arcade ? "Exit Game?" : "Exit Stage?",
            "subtitle":"Come back anytime.\n\(progress) progress saved.",
            "restartLabel":arcade ? "New Game" : "Restart","exitLabel":arcade ? "Exit Game" : "Exit Stage"]) else {gameplay.setSuspended(false);return}
        let sheet = JimiNativeEndRunModal(id:owner,model:model,assets:assets);modal = sheet
        onFeedback?("exit-modal")
        sheet.onAction = { [weak self,weak sheet] action in
            guard let self,let sheet,self.generation == owner,self.modal === sheet else{return}
            guard ["close","restart","exit"].contains(action) else{return}
            self.onFeedback?(action == "close" ? "back" : "cta")
            sheet.onClosed = { [weak self] in
                guard let self,self.generation == owner else{return}
                self.modal = nil
                switch action {
                case "close":self.gameplay?.setSuspended(false)
                case "restart":self.restart()
                case "exit":if self.save(){self.exit()} else {self.gameplay?.setSuspended(false)}
                default:break
                }
            }
            sheet.closeFromOwner()
        }
        gameplay.present(sheet,animated:false)
    }
    func dispose() {
        generation += 1;modal?.dispose();modal?.dismiss(animated:false);modal = nil
        for observer in observers {NotificationCenter.default.removeObserver(observer)};observers.removeAll()
        gameplay?.onExit = nil;gameplay = nil
    }
}
