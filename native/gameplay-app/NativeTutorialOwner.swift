import UIKit
import SpriteKit
import StackToSixGameplay

/// Connects the pure tutorial policy to one native sheet/pointer lease.
/// Run completion is committed by the result owner, never by this overlay.
@MainActor
final class NativeTutorialOwner {
    private weak var gameplay:NativeGameplayViewController?
    private let overlay:NativeTutorialOverlay
    private var displayedStep:NativeTutorialState.Step?
    private var disposed=false,generation:UInt64
    private var observers:[NSObjectProtocol]=[]
    var onChanged:((NativeBoardState)->Void)?
    var onFeedback:(()->Void)?
    init(gameplay:NativeGameplayViewController,root:URL) {
        self.gameplay=gameplay;generation=gameplay.engine.state.generation;overlay=NativeTutorialOverlay(resourceRoot:root)
        overlay.onGotIt = { [weak self] in self?.dismissFreePlay() }
        for (name,suspended) in [(UIApplication.willResignActiveNotification,true),(UIApplication.didBecomeActiveNotification,false)] {
            observers.append(NotificationCenter.default.addObserver(forName:name,object:nil,queue:.main) {[weak self] _ in MainActor.assumeIsolated {self?.overlay.setSuspended(suspended)}})
        }
    }
    func refresh(_ state:NativeBoardState) {
        guard !disposed,state.generation==generation,let gameplay else{return}
        guard let tutorial=state.tutorial,tutorial.active,state.terminal==nil else {overlay.dispose();displayedStep=nil;return}
        guard let scene=gameplay.boardScene,let geometry=scene.boardGeometry else{return}
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
        if displayedStep != tutorial.step {overlay.show(step:tutorial.step.rawValue,from:from,to:to,initial:displayedStep==nil,moves:moves);displayedStep=tutorial.step}
        else {overlay.updateTargets(from:from,to:to)}
    }
    func gameplayEvent(_ event:NativeGameplayEvent) {
        guard !disposed else{return}
        if event.kind == .dragBegan {overlay.hidePointer()}
        else if event.kind == .blocked || event.kind == .dragCancelled {overlay.restorePointer()}
    }
    func pointerState(_ dragging:Bool) {guard !disposed else{return};if dragging {overlay.hidePointer()} else {overlay.restorePointer()}}
    private func dismissFreePlay() {
        guard !disposed,let gameplay,gameplay.engine.state.generation==generation,
            gameplay.engine.state.tutorial?.step == .freePlay,gameplay.engine.state.tutorial?.waitingForWild == false else{return}
        onFeedback?()
        overlay.hide { [weak self] in
            guard let self,!self.disposed,let gameplay=self.gameplay,gameplay.engine.state.generation==self.generation else{return}
            let result=gameplay.engine.dismissTutorialFreePlayGuide()
            if result.accepted {self.onChanged?(result.state);gameplay.refreshFromEngine()}
        }
    }
    func dispose() {guard !disposed else{return};disposed=true;overlay.dispose();for token in observers {NotificationCenter.default.removeObserver(token)};observers.removeAll();onChanged=nil;onFeedback=nil;gameplay=nil}
}
