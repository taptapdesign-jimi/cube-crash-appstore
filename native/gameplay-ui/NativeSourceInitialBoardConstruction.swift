import SpriteKit
import UIKit
import StackToSixGameplay

/// Fresh synchronous constructor caller. Owns the exact future Scene resources
/// and objects; it creates no renderer, timer, animation root or activity label.
@MainActor final class NativeSourceInitialBoardConstruction {
    private enum Phase {case building,prepared,adopted,failed,disposed}
    private var phase=Phase.building
    private var resourcesTransferred=false
    private(set) var visibilityReleased=false
    private(set) var recipe:NativeSourceInitialBoardRecipe?
    let canvas=SKNode()
    let textures:NativeBoardTextures
    /// Exact resource-owner adoption receipt; readiness after synchronous
    /// construction alone does not prove the entry barrier was prepared.
    let borrowedPreparedFoundation:Bool
    private(set) var nodes:[String:NativeDiceNode]=[:]
    private var ordered:[NativeDiceNode]=[]
    private var batch:NativeSourceAnimationClockService.SourceFrameLease?
    private var outstandingFaces:Set<String>=[]
    private let service:NativeSourceAnimationClockService,random:()->Double,generation:UInt64
    private weak var adoptedEngine:NativeGameplayEngine?
    private weak var adoptedScene:NativeBoardScene?
    var readyToAdopt:Bool {
        guard phase == .prepared,let recipe,batch?.active==true,outstandingFaces.count==recipe.openings.count,ordered.count==recipe.holders.count else{return false}
        return ordered.allSatisfy{nodes[$0.tileID] === $0 && $0.parent === canvas && $0.sourceGeneration==generation && $0.sourceContactNodeAlive}
    }
    var isCurrent:Bool {phase == .adopted && adoptedEngine?.state.generation==generation && adoptedScene?.engine === adoptedEngine && adoptedScene?.sourceAnimationBindingAdmissionOpen==true && canvas.parent === adoptedScene && adoptedScene != nil}
    var pendingFaceCount:Int {outstandingFaces.count}
    var onConstructorBatchSettled:(()->Void)?
    var constructorBatchPending:Bool {batch?.active == true}

    private init(root:URL,service:NativeSourceAnimationClockService,generation:UInt64,preparedTextures:NativeBoardTextures?=nil,random:@escaping()->Double) {
        borrowedPreparedFoundation=preparedTextures != nil
        textures=preparedTextures ?? NativeBoardTextures(root:root);self.service=service;self.generation=generation;self.random=random
    }
    static func make(root:URL,service:NativeSourceAnimationClockService,mode:NativeRunMode,board:Int,
        columns:Int=5,rows:Int=9,generation:UInt64=1,gameplaySeed:UInt64=1,tutorialDemo:Bool=false,arcadeVariant:NativeArcadeVariant = .endurance,
        preparedTextures:NativeBoardTextures?=nil,random:@escaping()->Double) -> NativeSourceInitialBoardConstruction? {
        guard service.sourceFrameTransportAdmissionOpen else{return nil}
        let owner=NativeSourceInitialBoardConstruction(root:root,service:service,generation:generation,preparedTextures:preparedTextures,random:random)
        // Original source texture barrier precedes constructor draws. Reuse
        // this one owner in Scene; do not decode these paths in a second owner.
        let required=NativeBoardTextures.sourceInitialFoundationPaths
        guard required.allSatisfy({preparedTextures != nil ? owner.textures.sourceCachedTexture(candidates:[$0]) != nil:owner.textures.texture($0,densityAware:false) != nil}) else{owner.dispose();return nil}
        let recipe=NativeSourceInitialBoardRecipe.capture(mode:mode,board:board,columns:columns,rows:rows,
            generation:generation,gameplaySeed:gameplaySeed,tutorialDemo:tutorialDemo,arcadeVariant:arcadeVariant,random:random,
            constructHolder:{[owner] holder in owner.construct(holder)},openTile:{[owner] opening in owner.open(opening)})
        guard let recipe,owner.phase == .building else{owner.dispose();return nil}
        owner.recipe=recipe
        // Literal finalizeBoardVisibility hides these actual objects. Native
        // entry reveal remains a separate, explicitly unadmitted companion.
        for node in owner.ordered {node.isHidden=true}
        owner.phase = .prepared
        return owner
    }
    /// Genuine occupied-cell restore only. Original schema/constructor/face
    /// graph is not equivalent to a fresh board or a seeded opening recipe.
    static func makeRestoredRegular(root:URL,service:NativeSourceAnimationClockService,
        saved:NativeBoardState,preparedTextures:NativeBoardTextures?=nil,random:@escaping()->Double)->NativeSourceInitialBoardConstruction? {
        guard service.sourceFrameTransportAdmissionOpen,NativeSourceInitialBoardRecipe.canRestoreRegular(saved) else{return nil}
        return makeRestored(root:root,service:service,saved:saved,preparedTextures:preparedTextures,random:random)
    }
    /// Same occupied-cell Source constructor graph, now including validated
    /// Wild identities. Static skin/idle and Bootstrap activation remain separate.
    static func makeRestored(root:URL,service:NativeSourceAnimationClockService,
        saved:NativeBoardState,preparedTextures:NativeBoardTextures?=nil,random:@escaping()->Double)->NativeSourceInitialBoardConstruction? {
        guard service.sourceFrameTransportAdmissionOpen,NativeSourceInitialBoardRecipe.canRestore(saved) else{return nil}
        let owner=NativeSourceInitialBoardConstruction(root:root,service:service,generation:saved.generation,preparedTextures:preparedTextures,random:random)
        let required=NativeBoardTextures.sourceInitialFoundationPaths
        guard required.allSatisfy({preparedTextures != nil ? owner.textures.sourceCachedTexture(candidates:[$0]) != nil:owner.textures.texture($0,densityAware:false) != nil}) else{owner.dispose();return nil}
        // Eligible restored faces share this exact future Scene resource owner.
        // Resolve before constructor draws/visible motion so the raw face RAF
        // only reads retained original identities and performs no decoding.
        for tile in saved.tiles where tile.isWild {
            guard let core=tile.gameplayArchetype,
                  let face=NativeDiceArtwork.sourceWildSkinDefinition(kind:core.rawValue,variant:tile.variant),
                  (preparedTextures != nil ? owner.textures.sourceCachedTexture(candidates:[face.path]) != nil:owner.textures.texture(face.path,densityAware:false) != nil) else{owner.dispose();return nil}
        }
        let recipe=NativeSourceInitialBoardRecipe.captureRestored(saved,random:random,
            construct:{[owner] holder,_ in owner.construct(holder)},restoreFace:{[owner] tile in owner.restore(tile)})
        guard let recipe,owner.phase == .building else{owner.dispose();return nil}
        owner.recipe=recipe
        for node in owner.ordered {node.isHidden=true}
        owner.phase = .prepared
        return owner
    }
    private func restore(_ tile:NativeTile)->Bool {
        guard phase == .building,let node=nodes[tile.id],node.parent === canvas else{return false}
        outstandingFaces.insert(tile.id)
        var installing=true
        defer{installing=false}
        let current:()->Bool = {[weak self,weak node] in
            guard let self,let node,NativeSourceRestoreFaceAdmission.permits(installing:installing,
                building:self.phase == .building,adopted:self.isCurrent) else{return false}
            return self.nodes[tile.id] === node && node.parent === self.canvas && node.sourceGeneration==self.generation
        }
        let finished:()->Void = {[weak self,weak node] in
            guard let self else{return};self.outstandingFaces.remove(tile.id)
            if let node,self.isCurrent,self.nodes[tile.id] === node {self.adoptedScene?.sourceRestoredWildFaceSettled(node)}
        }
        let cancelled:()->Void = {[weak self] in
            guard let self else{return};self.outstandingFaces.remove(tile.id)
            if self.phase == .prepared {self.failBeforeAdoption()}
        }
        if tile.isWild {
            return node.restoreSourceWildHolder(tile,service:service,current:current,onFinished:finished,onCancelled:cancelled)
        }
        return node.restoreSourceRegularHolder(tile,service:service,random:random,current:current,onFinished:finished,onCancelled:cancelled)
    }
    private func construct(_ holder:NativeSourceInitialBoardRecipe.Holder)->Bool {
        guard phase == .building else{return false}
        let node=NativeDiceNode(id:holder.tileID,value:0,kind:"regular",variant:nil,depth:1,locked:true,textures:textures)
        node.position=CGPoint(x:CGFloat(holder.cell.column*148+64),y:CGFloat(-(holder.cell.row*148+64)))
        canvas.addChild(node)
        guard node.prepareSourceInitialHolder(rotation:holder.rotation,generation:generation,cell:holder.cell),phase == .building else{node.dispose();return false}
        nodes[holder.tileID]=node;ordered.append(node)
        if batch == nil {
            batch=service.requestSourceAnimationFrame(ownerID:"initial-constructor-batch:\(generation)",generation:generation,
                callback:{[weak self] in
                    guard let self else{return};self.batch=nil
                    guard self.isCurrent else{self.failBeforeAdoption();return}
                    let captured=self.ordered
                    for node in captured {
                        guard self.isCurrent else{return}
                        if self.nodes[node.tileID] === node,node.parent === self.canvas,node.sourceGeneration==self.generation {
                            node.flushSourceInitialHolderVisuals()
                        }
                    }
                    if self.isCurrent {let settled=self.onConstructorBatchSettled;self.onConstructorBatchSettled=nil;settled?()}
                },onCancelled:{[weak self] in self?.batch=nil})
            guard batch?.active==true,phase == .building else{return false}
        }
        return true
    }
    private func open(_ opening:NativeSourceInitialBoardRecipe.Opening)->Bool {
        guard phase == .building,let node=nodes[opening.tileID],node.parent === canvas else{return false}
        outstandingFaces.insert(opening.tileID)
        return node.openSourceInitialHolder(opening.value,service:service,random:random,current:{[weak self,weak node] in
            guard let self,let node,self.phase == .building || self.isCurrent else{return false}
            return self.nodes[opening.tileID] === node && node.parent === self.canvas && node.sourceGeneration==self.generation
        },onFinished:{[weak self] in self?.outstandingFaces.remove(opening.tileID)},onCancelled:{[weak self] in
            guard let self else{return};self.outstandingFaces.remove(opening.tileID)
            if self.phase == .prepared {self.failBeforeAdoption()}
        })
    }
    /// Native bridge readiness, not a new delayed frame. Root fresh caller must
    /// adopt synchronously before yielding; early callbacks fail closed, no retry.
    func adopt(engine:NativeGameplayEngine,scene:NativeBoardScene)->Bool {
        guard readyToAdopt,let recipe,recipe.matches(engine.state) else{return false}
        guard canvas.parent === scene,scene.engine === engine else{return false}
        adoptedEngine=engine;adoptedScene=scene;resourcesTransferred=true;phase = .adopted
        return isCurrent
    }
    func ownsHiddenInitialObject(_ node:NativeDiceNode)->Bool {isCurrent && !visibilityReleased && nodes[node.tileID] === node}
    /// Explicit bridge to the existing Native entry only; not v9 sweetPopIn parity.
    func releaseToExistingNativeEntry() {guard isCurrent else{return};visibilityReleased=true}
    /// Literal clearAllAppAnimationFrames scope: raw setValue faces survive.
    func cancelTrackedConstructorBatch() {let captured=batch;batch=nil;captured?.cancel()}
    private func failBeforeAdoption() {guard phase == .prepared || phase == .building else{return};phase = .failed;dispose()}
    func dispose() {
        guard phase != .disposed else{return};phase = .disposed;adoptedEngine=nil;adoptedScene=nil
        let capturedBatch=batch;batch=nil;let captured=ordered;ordered=[];nodes=[:];outstandingFaces=[]
        capturedBatch?.cancel()
        for node in captured {
            if resourcesTransferred {node.retireSourceStackFrames()}
            else {node.dispose();node.removeFromParent()}
        }
        if !resourcesTransferred {textures.dispose();canvas.removeFromParent()}
    }
    isolated deinit {dispose()}
}
