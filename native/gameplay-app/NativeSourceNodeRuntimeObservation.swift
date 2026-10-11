import SpriteKit
import StackToSixGameplay

/// The actual Scene supplies Source grid identity (not the tweened position).
/// Retained hidden nodes and pending RAF depth are read from the same object.
@MainActor final class NativeSourceNodeRuntimeObservation {
    private weak var node:NativeDiceNode?,canvas:SKNode?
    private let generation:UInt64,lookup:(String)->NativeDiceNode?,current:()->Bool,sourceCell:()->NativeCell?
    private var retired=false
    convenience init(node:NativeDiceNode,canvas:SKNode,generation:UInt64,
         lookup:@escaping(String)->NativeDiceNode?,current:@escaping()->Bool) {
        self.init(node:node,canvas:canvas,generation:generation,lookup:lookup,current:current,
                  sourceCell:{[weak node] in node?.sourceGridCell})
    }
    init(node:NativeDiceNode,canvas:SKNode,generation:UInt64,
         lookup:@escaping(String)->NativeDiceNode?,current:@escaping()->Bool,
         sourceCell:@escaping()->NativeCell?) {
        self.node=node;self.canvas=canvas;self.generation=generation
        self.lookup=lookup;self.current=current;self.sourceCell=sourceCell
    }
    func retire(){retired=true}
    private func valid(_ node:NativeDiceNode,_ canvas:SKNode)->Bool {
        guard !retired,node.sourceContactNodeAlive,node.sourceGeneration==generation,node.parent === canvas else{return false}
        let accepted=current()
        guard accepted,!retired,node.sourceContactNodeAlive,node.sourceGeneration==generation,node.parent === canvas else{return false}
        let installed=lookup(node.tileID)
        return installed === node && !retired && node.sourceContactNodeAlive && node.sourceGeneration==generation && node.parent === canvas
    }
    func read(_ model:NativeTile)->NativeSourcePhysicalTileObservation? {
        guard let node,let canvas,model.id==node.tileID,valid(node,canvas) else{return nil}
        let cell=sourceCell();guard valid(node,canvas),let cell else{return nil}
        let kind:NativeWildArchetype?
        if node.kind=="regular" {kind=nil}
        else {guard let actual=NativeWildArchetype(rawValue:node.kind) else{return nil};kind=actual}
        var observed=model
        observed.cell=cell;observed.value=node.sourceValue;observed.stackDepth=node.sourceStackDepth
        observed.archetype=kind;observed.variant=node.variant;observed.locked=node.locked
        observed.sourceWildStateCleared=node.sourceWildStateCleared
        observed.sourceResidualWildPresence=node.sourceResidualWildPresence
        observed.merge6CleanupOwned=node.sourceMergeSixCleanupToken != nil
        observed.nonFinalMerge6=node.sourceNonFinalMergeSix
        observed.visible = !node.isHidden;observed.alpha=node.sourceAlpha
        let eventMode=node.sourceEventMode,frames=node.sourcePendingStackFrameCount
        guard valid(node,canvas) else{return nil}
        return .init(tile:observed,eventMode:eventMode,pendingStackFrames:frames)
    }
}
