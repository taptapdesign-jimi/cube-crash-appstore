import Foundation
import SpriteKit
import StackToSixGameplay

/// Genuine demo objects only. This owner implements the literal synchronous
/// prepare prefix plus the two independently owned raw RAF repair callbacks.
/// Sheet/pointer/monitor admission is deliberately a separate caller owner.
@MainActor final class NativeSourceTutorialStepOnePreparation {
    private let engine:NativeGameplayEngine,receipt:NativeSourceTutorialDemoActivationReceipt
    private let service:NativeSourceAnimationClockService,focus:NativeSourceTutorialFocusOwner
    private let tiles:[NativeTile],nodes:[String:NativeDiceNode],parent:SKNode
    private var positions:[String:CGPoint]
    private let current:()->Bool,layoutBoard:()->Void,updateFocus:()->Void
    private var frames:[UUID:NativeSourceAnimationClockService.SourceFrameLease]=[:]
    private var disposed=false,preparing=false
    private(set) var prepared=false
    var pendingRepairCount:Int{frames.count}
    var activeFocusRootCount:Int{focus.activeRootCount}
    var orderedSurvivingNodes:[NativeDiceNode]{tiles.compactMap{tile in guard let node=nodes[tile.id],owns(node) else{return nil};return node}}
    init?(engine:NativeGameplayEngine,receipt:NativeSourceTutorialDemoActivationReceipt,
        service:NativeSourceAnimationClockService,random:@escaping()->Double,
        nodes:[String:NativeDiceNode],parent:SKNode,positions:[String:CGPoint],
        current:@escaping()->Bool,layoutBoard:@escaping()->Void,updateFocus:@escaping()->Void) {
        let tiles=engine.state.tiles
        guard service.sourceFrameTransportAdmissionOpen,engine.pendingSourceTutorialDemoActivation==receipt,
            Set(nodes.keys)==Set(tiles.map(\.id)),positions.count==tiles.count,
            tiles.allSatisfy({tile in guard let node=nodes[tile.id],positions[tile.id] != nil else{return false};return node.sourceContactNodeAlive && node.sourceGeneration==receipt.generation && node.parent === parent && node.value==tile.value && node.locked==tile.locked && node.kind=="regular" && node.variant==nil && !node.sourceRegularFramePending}),current(),engine.pendingSourceTutorialDemoActivation==receipt,engine.state.generation==receipt.generation,
            nodes.values.allSatisfy({$0.sourceContactNodeAlive && $0.sourceGeneration==receipt.generation && $0.parent === parent}) else{return nil}
        self.engine=engine;self.receipt=receipt;self.service=service;self.nodes=nodes;self.tiles=tiles;self.parent=parent;self.positions=positions;self.current=current;self.layoutBoard=layoutBoard;self.updateFocus=updateFocus
        focus=NativeSourceTutorialFocusOwner(service:service,random:random,current:current)
    }
    private var bound:Bool {
        !disposed && engine.state.generation==receipt.generation
    }
    private func captured(_ node:NativeDiceNode)->Bool {node.sourceContactNodeAlive && node.sourceGeneration==receipt.generation && node.parent === parent}
    private func admitted()->Bool{guard bound else{return false};let result=current();return result && bound}
    func owns(_ node:NativeDiceNode)->Bool {prepared && !disposed && nodes[node.tileID] === node && engine.state.tiles.contains{$0.id==node.tileID} && bound && captured(node)}
    @discardableResult func prepare()->Bool {
        guard !preparing,!prepared,admitted(),engine.pendingSourceTutorialDemoActivation==receipt else{return false}
        preparing=true;defer{preparing=false}
        let ordered=tiles.sorted{$0.cell.row != $1.cell.row ? $0.cell.row < $1.cell.row:$0.cell.column < $1.cell.column}
        for tile in ordered {guard let node=nodes[tile.id],node.normalizeSourceTutorialInitialTile(),admitted() else{dispose();return false}}
        // Genuine logical writer, before any focus Math or RAF delivery. Node
        // Graphics field writes themselves have no observable async boundary.
        let result=engine.commitSourceTutorialDemoPreparation(receiptID:receipt.id,generation:receipt.generation)
        guard result.accepted,admitted(),placeAndForceTargets(setFields:true) else{dispose();return false}
        layoutBoard()
        guard admitted(),placeAndForceTargets(normalize:true,setFields:true) else{dispose();return false}
        guard enqueueRepair(first:true) else{dispose();return false}
        // STATE order, not sorted-normalization order, owns these Math draws.
        for tile in tiles {
            guard admitted(),let node=nodes[tile.id],focus.focus(node,focused:tile.id==receipt.threeID || tile.id==receipt.twoID),admitted() else{dispose();return false}
        }
        guard let one=nodes[receipt.oneID],one.forceSourceTutorialInitialValue(1),focus.focus(one,focused:false),admitted() else{dispose();return false}
        prepared=true;return true
    }
    private func placeAndForceTargets(normalize:Bool=false,setFields:Bool=false)->Bool {
        for (id,value) in [(receipt.threeID,3),(receipt.twoID,2),(receipt.oneID,1)] {
            guard admitted(),let node=nodes[id],let position=positions[id] else{return false}
            if !captured(node) {if prepared{continue};return false}
            node.position=position
            if setFields {guard node.setSourceTutorialInitialValue(value),admitted() else{return false}}
            if normalize {guard node.normalizeSourceTutorialInitialTile(),admitted() else{return false}}
            guard node.forceSourceTutorialInitialValue(value),admitted() else{return false}
        }
        return true
    }
    private func enqueueRepair(first:Bool)->Bool {
        guard admitted() else{return false};let id=UUID()
        let lease=service.requestSourceAnimationFrame(ownerID:"tutorial-repair:\(receipt.id):\(id)",generation:receipt.generation,callback:{[weak self] in
            guard let self,self.frames.removeValue(forKey:id) != nil,self.prepared,self.admitted() else{return}
            guard self.placeAndForceTargets() else{self.dispose();return}
            for (tileID,focused) in [(self.receipt.threeID,true),(self.receipt.twoID,true),(self.receipt.oneID,false)] {
                guard self.admitted(),let node=self.nodes[tileID] else{self.dispose();return}
                if !self.captured(node){continue}
                guard self.focus.focus(node,focused:focused),self.admitted() else{self.dispose();return}
            }
            if first {if !self.enqueueRepair(first:false){self.dispose()}}
            else {self.updateFocus()}
        },onCancelled:{[weak self] in self?.frames[id]=nil})
        guard let lease,admitted() else{lease?.cancel();return false};frames[id]=lease;return lease.active
    }
    /// Native viewport geometry changes without replacing the captured demo
    /// objects or restarting focus Math. Pending repair RAFs use these same
    /// updated coordinates; paint alpha remains owned by the existing roots.
    @discardableResult func relayout(positions:[String:CGPoint],geometryScale:CGFloat)->Bool {
        guard prepared,admitted(),Set(positions.keys)==Set(nodes.keys) else{return false}
        self.positions=positions
        for tile in engine.state.tiles {
            guard admitted(),let node=nodes[tile.id],let position=positions[tile.id],captured(node) else{return false}
            node.synchronizeSourceGeometry(geometryScale);node.position=position
        }
        return admitted()
    }
    func retire(_ node:NativeDiceNode){guard nodes[node.tileID] === node else{return};focus.retire(node)}
    func dispose(){guard !disposed else{return};disposed=true;let old=Array(frames.values);frames.removeAll();for frame in old{frame.cancel()};focus.dispose()
        _=engine.cancelSourceTutorialDemoActivation(receiptID:receipt.id,generation:receipt.generation)
    }
    isolated deinit{dispose()}
}
