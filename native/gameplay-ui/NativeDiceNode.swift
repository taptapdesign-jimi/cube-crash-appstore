import SpriteKit
import UIKit
import StackToSixGameplay

@MainActor
final class NativeDiceNode: SKNode, NativeTileOuterPoseHost, NativeDragShadowHost, NativeRegularStackFrameHost {
    let tileID: String
    private var sourceStarHalo:NativeSourceStarHaloPresentation?
    private var sourceStarSheet:NativeSourceStarSheetPresentation?
    private var sourceStarSheetID:UUID?
    private var sourceStarSheetStartTasks:NativeSourceMicrotaskAdapters?
    private var sourceStarSheetAwaitingStart=false
    var sourcePlainStarSheetPendingID:UUID? {sourceStarSheetAwaitingStart ? sourceStarSheetID:nil}
    var sourcePlainStarArtworkSprite:SKSpriteNode? {sourceStarSheet?.sprite}
    var sourcePlainStarArtworkElapsedMilliseconds:Double? {sourceStarSheet?.elapsedMilliseconds}
    var sourcePlainStarSharedAtlasTexture:SKTexture? {textures.sourceCachedTexture(candidates:[NativeDiceSheet.star.path])}
    @discardableResult func beginSourcePlainStarSheet(tasks:NativeSourceMicrotaskAdapters,layer:SKNode,
        current:@escaping()->Bool,paintable:@escaping()->Bool)->Bool {
        guard !disposed,!sourceIdleDeferred,kind=="wild",variant==nil,
            let scope=sourceSpecialIdle,scope.admissionOpen,current() else{return false}
        if let owner=sourceStarSheet,owner.isCurrent {
            owner.pointerStateChanged()
            return flushSourcePlainStarSheetStart(capturedID:sourceStarSheetID)
        }
        retireSourceStarSheet()
        let id=UUID(),generation=sourceGeneration,revision=sourceBindingRevision
        sourceStarSheetID=id
        let valid={ [weak self] in
            guard let self,!self.disposed,self.sourceStarSheetID==id,self.sourceGeneration==generation,
                self.sourceBindingRevision==revision,self.kind=="wild",self.variant==nil,
                !self.sourceIdleDeferred,self.sourceSpecialIdle === scope,scope.admissionOpen else{return false}
            let accepted=current()
            return accepted && !self.disposed && self.sourceStarSheetID==id && self.sourceGeneration==generation
        }
        guard let owner=NativeSourceStarSheetPresentation(textures:textures,host:visual,base:face,layer:layer,
            current:valid,paintable:{[weak self] in self?.sourceIdleHostPaintable(canvasPaintable:paintable())==true},
            ownsBase:{[weak self] in self?.sourceStarSheetID==id}) else{sourceStarSheetID=nil;return false}
        sourceStarSheet=owner
        sourceStarSheetStartTasks=tasks;sourceStarSheetAwaitingStart=true
        return flushSourcePlainStarSheetStart(capturedID:id)
    }
    /// A captured pending registry key owns no atlas work. The real registry
    /// receipt and genuine APP task boundary jointly admit resource startup.
    @discardableResult func flushSourcePlainStarSheetStart(capturedID:UUID?)->Bool {
        guard let capturedID,sourceStarSheetID==capturedID,sourceStarSheetAwaitingStart else{return true}
        guard let owner=sourceStarSheet,owner.isCurrent,let tasks=sourceStarSheetStartTasks else{
            retireSourceStarSheet();return false
        }
        guard sourceSpecialIdle?.hasStarted(self)==true,tasks.fifo.isAcceptingJobs else{return true}
        sourceStarSheetAwaitingStart=false;sourceStarSheetStartTasks=nil
        let accepted=owner.start(tasks:tasks)
        guard sourceStarSheet === owner else{owner.dispose();return true}
        guard accepted,owner.isCurrent else{
            retireSourceStarSheet();return false
        }
        return true
    }
    func tickSourcePlainStarSheet(deltaMilliseconds:Double,suspended:Bool) {
        guard !suspended else{return};sourceStarSheet?.tick(deltaMilliseconds:deltaMilliseconds)
    }
    private func retireSourceStarSheet(){
        let captured=sourceStarSheet;captured?.dispose()
        if sourceStarSheet === captured {
            sourceStarSheet=nil;sourceStarSheetID=nil;sourceStarSheetStartTasks=nil;sourceStarSheetAwaitingStart=false
        }
    }
    private var sourceStarHaloPreparationID:UUID?
    private var sourceStarHaloReactionScope:NativeSourceMicrotaskFIFO.Scope?
    var sourceLiveStarHaloCount:Int {sourceStarHalo?.starCount ?? 0}
    var sourceStarOrbitHost:SKNode {visual}
    var sourceStarOrbitMetrics:CGSize {.init(width:max(1,face.frame.width),height:max(1,face.frame.height))}
    var sourceStarArtworkZIndex:CGFloat {face.zPosition}
    func sourceStarEarlyCapture(in stage:SKScene)->NativeSourceStarHaloPresentation.Capture? {sourceStarHalo?.captureForMerge(in:stage)}
    /// Takes ownership of an already prepared and mounted captured renderer.
    /// Asset/count Math and foreground projection remain caller responsibilities.
    @discardableResult func adoptSourceStarHalo(_ halo:NativeSourceStarHaloPresentation,
        generation:UInt64,ticker:NativeSourceStarHaloTicker)->Bool {
        if sourceStarHalo?.isDisposed == true {sourceStarHalo=nil}
        guard !disposed,generation>0,sourceGeneration==generation,parent != nil,
            kind=="wild",variant==nil,sourceStarHalo==nil,!halo.isDisposed,
            halo.capturedGeneration==generation,halo.parent != nil else{return false}
        sourceStarHalo=halo
        guard halo.start(ticker:ticker),!disposed,sourceGeneration==generation,
            sourceStarHalo === halo else {
            if sourceStarHalo === halo {sourceStarHalo=nil};halo.dispose();return false
        }
        return true
    }
    func retireSourceStarHalo(){
        retireSourceStarSheet();retireSourceStarHaloOnly()
    }
    private func retireSourceStarHaloOnly(){
        sourceStarHaloPreparationID=nil
        let scope=sourceStarHaloReactionScope;sourceStarHaloReactionScope=nil;scope?.dispose()
        let old=sourceStarHalo;sourceStarHalo=nil;old?.dispose()
    }
    /// Plain-Star Source attachment. Scene owns exact foreground mounting/metrics.
    /// Existing prototype Core count timing is not admitted by this API.
    @discardableResult func beginSourcePlainStarHalo(service:NativeSourceAnimationClockService,
        ticker:NativeSourceStarHaloTicker,tasks:NativeSourceMicrotaskAdapters,
        generation:UInt64,introBounce:Bool,force:Bool=false,random:@escaping()->Double,
        performanceNow:@escaping()->Double,current:@escaping()->Bool,paintable:@escaping()->Bool,
        metrics:@escaping()->CGSize,mount:@escaping(NativeSourceStarHaloPresentation)->Bool)->Bool {
        guard !disposed,generation>0,sourceGeneration==generation,parent != nil,kind=="wild",variant==nil,current(),!disposed else{return false}
        if sourceStarHalo?.isDisposed == true {retireSourceStarHalo()}
        if !force,(sourceStarHalo != nil || sourceStarHaloPreparationID != nil) {return true}
        retireSourceStarHaloOnly()
        guard !disposed,sourceGeneration==generation,kind=="wild",variant==nil,current(),!disposed else{return false}
        let id=UUID();sourceStarHaloPreparationID=id
        let matches={ [weak self] in
            guard let self,!self.disposed,self.sourceGeneration==generation,
                self.sourceStarHaloPreparationID==id,self.kind=="wild",self.variant==nil,self.parent != nil else{return false}
            let ok=current()
            return ok && !self.disposed && self.sourceStarHaloPreparationID==id && self.sourceGeneration==generation
        }
        guard let scope=tasks.fifo.makeAssetScope(boundProducer:.sourceAssetCompletionTask,isCurrent:matches) else{retireSourceStarHalo();return false}
        sourceStarHaloReactionScope=scope
        guard let count=NativeSourceStarHaloMotion.pickCount(random:random),matches() else{
            if sourceStarHaloPreparationID==id {retireSourceStarHalo()};return false
        }
        let attachedMilliseconds=performanceNow()
        guard attachedMilliseconds.isFinite,matches() else{if sourceStarHaloPreparationID==id {retireSourceStarHalo()};return false}
        let ready={ [weak self] (texture:SKTexture?) in
            guard let self,matches() else{return}
            guard let stars=NativeSourceStarHaloMotion.makeStars(count:count,textureWidth:Double(texture?.size().width ?? 56),introBounce:introBounce,performanceNow:performanceNow,random:random,current:matches),matches() else{return}
            guard let halo=NativeSourceStarHaloPresentation(stars:stars,texture:texture,introBounce:introBounce,performanceMilliseconds:attachedMilliseconds,service:service,generation:generation,current:matches,paintable:paintable,metrics:metrics) else{return}
            guard matches(),mount(halo),matches(),self.adoptSourceStarHalo(halo,generation:generation,ticker:ticker) else{halo.dispose();return}
        }
        let candidates=["assets/small-star@3x.png","assets/small-star@2x.png","assets/small-star.png"]
        if let texture=textures.sourceCachedTexture(candidates:candidates) {ready(texture)}
        else {textures.prepareSourceStarTexture(candidates:candidates,current:matches,assetTasks:tasks,reactionScope:scope,completion:ready)}
        return matches()
    }
    private(set) var value: Int
    private(set) var kind: String
    private(set) var variant: String?
    private(set) var sourceWildStateCleared=false
    private(set) var sourceResidualWildPresence=false
    private var sourceWildDestinationFrames:NativeSourceWildDestinationFaceSequence?
    var sourceWildDestinationFrameCount:Int {sourceWildDestinationFrames?.pendingCount ?? 0}
    private(set) var depth: Int
    private(set) var locked: Bool
    private var sourceRegularFrameBinding:NativeRegularStackFrameBinding?
    private weak var sourceRegularFrameService:NativeSourceAnimationClockService?
    private weak var sourceRegularFrameParent:SKNode?
    private var sourceRegularFrameGeneration:UInt64?
    private(set) var sourceCurrentRegularSkin:NativeRegularStackLayout.Skin?
    var sourceMaxStackDepth=1
    var sourceRegularFramePending:Bool {(sourceRegularFrameBinding?.pendingFrameCount ?? 0) > 0 || sourceRestoreEmptyFaceFrame?.active==true}
    var sourcePendingStackFrameCount:Int {sourceRegularFrameBinding?.pendingFrameCount ?? 0}
    var sourceAlive:Bool {!disposed && sourceRegularFrameGeneration==sourceGeneration && parent === sourceRegularFrameParent && parent != nil}
    var sourceValue:Int {get{value}set{guard !disposed else{return};value=newValue}}
    var sourceAlpha:Double {get{Double(alpha)}set{guard !disposed else{return};alpha=CGFloat(newValue)}}
    var sourceLocked:Bool {locked}
    var sourceStackDepth:Int {get{depth}set{guard !disposed else{return};depth=newValue}}
    var sourceBaseScaleX:Double {Double(face.xScale)}
    var sourceBaseScaleY:Double {Double(face.yScale)}
    var sourceBaseAnchorX:Double {Double(face.anchorPoint.x)}
    var sourceBaseAnchorY:Double {Double(1-face.anchorPoint.y)}
    var sourceBaseX:Double {Double(face.position.x)}
    var sourceBaseY:Double {Double(-face.position.y)}
    var sourcePaintedNumbersTexture:SKTexture? {face.texture}
    private(set) var sourceStackRevision:UInt64=0
    var sourceStackContainer:SKNode {stack}
    var sourceStackLayerNodes:[SKNode] {stack.children}
    var sourcePipNodes:[SKNode] {pips.children}
    func sourceNumbersSkinsAvailable()->Set<NativeRegularStackLayout.Skin> {
        Set(NativeRegularStackLayout.Skin.allCases.filter{textures.texture(String($0.rawValue.dropFirst(2)),densityAware:false) != nil})
    }
    // Fresh Source constructor only; never consumes a replacement/hash draw.
    func prepareSourceInitialHolder(rotation:Double,generation:UInt64,cell:NativeCell?=nil) -> Bool {
        guard !disposed,kind=="regular",variant==nil,value==0,locked,depth==1,parent != nil,
              let texture=textures.texture("assets/tile.png",densityAware:false) else{return false}
        sourceGeneration=generation;sourceGridCell=cell;sourceMarkerCoverageGeneration=generation;sourceEventMode="auto"
        // Literal createTile/app-spawn initializes these absent JS properties.
        // The admitted wrapper never runs animateTileSpawn/drag-anim aliases.
        // Raw nodes have no record; teardown retires it before callbacks.
        sourceConstructorMarkerAbsence = .init(pendingRemoval:false,beingRemoved:false,cleanupQueued:false,
            ccSpawnAnimating:false,spawnAnimating:false,isSpawning:false,spawnTweenActive:false)
        face.texture=texture;face.setScale(1);face.size=texture.size();face.setScale(128/max(1,texture.size().width));face.alpha=1
        stack.removeAllChildren();pips.removeAllChildren()
        sourceInnerPosition = .zero;dragInnerTilt=CGFloat(rotation)
        return !disposed && sourceGeneration==generation && parent != nil
    }
    func prepareSourceHardPrimaryBeforeValue()->Bool {
        guard sourcePhysicalMarkersCovered,!isSpecial,locked,value==0 else{return false}
        locked=false;sourceEventMode="static";ensureSourceAppSpawnFullOpacity()
        return sourceContactNodeAlive
    }
    func prepareSourceLockedBonus(alpha:Double){
        guard sourcePhysicalMarkersCovered,locked,value==0 else{return}
        sourceEventMode="none";self.alpha=CGFloat(alpha)
    }
    func repairSourceLockedBonus(alpha:Double){
        guard sourcePhysicalMarkersCovered,locked,value==0 else{return}
        self.alpha=CGFloat(alpha)
    }
    /// Literal fillNullCellsWithLockedPlaceholders applies alpha independently
    /// to the root, rotG and base after the actual zero-holder constructor.
    func prepareSourceMagnetReservedHolder(rotation:Double,generation:UInt64,cell:NativeCell?=nil)->Bool {
        guard prepareSourceInitialHolder(rotation:rotation,generation:generation,cell:cell),!disposed else{return false}
        alpha=0.20;visual.alpha=0.20;face.alpha=0.20
        return !disposed && sourceGeneration==generation && parent != nil
    }
    func openSourceInitialHolder(_ value:Int,service:NativeSourceAnimationClockService,
        random:@escaping()->Double,current:@escaping()->Bool,onFinished:@escaping()->Void,
        onCancelled:@escaping()->Void) -> Bool {
        guard !disposed,locked,self.value==0,depth==1,!isSpecial else{return false}
        locked=false;sourceEventMode="static";face.alpha=1
        return queueSourceStackValue(value,addStack:0,service:service,random:random,current:current,
            onFinished:onFinished,onCancelled:onCancelled)
    }
    private var sourceRestoreEmptyFaceID:String?
    private var sourceRestoreEmptyFaceFrame:NativeSourceAnimationClockService.SourceFrameLease?
    /// Literal ordinary restore: constructor was already installed with the
    /// captured tilt. setValue schedules one raw RAF even for a zero holder.
    func restoreSourceRegularHolder(_ tile:NativeTile,service:NativeSourceAnimationClockService,
        random:@escaping()->Double,current:@escaping()->Bool,onFinished:@escaping()->Void,
        onCancelled:@escaping()->Void)->Bool {
        guard !disposed,parent != nil,tile.id==tileID,kind=="regular",variant==nil,
            !tile.isWild,(0...5).contains(tile.value),sourceRestoreEmptyFaceFrame==nil,
            sourceRegularFrameBinding==nil else{return false}
        locked=tile.locked;value=tile.value;depth=1;alpha=CGFloat(tile.locked && tile.value==0 ? min(0.25,tile.alpha):tile.alpha);isHidden = !tile.visible
        sourceEventMode=locked ? "none":"static"
        let generation=sourceGeneration,capturedParent=parent
        if tile.value>0 {
            let available=sourceNumbersSkinsAvailable()
            guard available.contains(.base),!disposed,parent === capturedParent else{return false}
            sourceRegularFrameParent=parent;sourceRegularFrameGeneration=generation;sourceMaxStackDepth=1;sourceRegularFrameService=service
            let binding=NativeRegularStackFrameBinding(host:self,service:service,available:available,random:random,current:current)
            sourceRegularFrameBinding=binding
            return binding.setValue(tile.value,addStack:0,onFinished:onFinished,onCancelled:onCancelled)
        }
        let id=UUID().uuidString;sourceRestoreEmptyFaceID=id
        let lease=service.requestSourceAnimationFrame(ownerID:"restore-empty:\(tileID):\(generation)",generation:generation,
            callback:{[weak self] in
                guard let self,self.sourceRestoreEmptyFaceID==id else{return};self.sourceRestoreEmptyFaceFrame=nil;self.sourceRestoreEmptyFaceID=nil
                guard !self.disposed,self.sourceGeneration==generation,self.parent === capturedParent else{onCancelled();return}
                let admitted=current()
                guard admitted,!self.disposed,self.sourceGeneration==generation,self.parent === capturedParent,
                    let texture=self.textures.texture("assets/tile.png",densityAware:false) else{onCancelled();return}
                self.value=0;self.depth=1;self.face.texture=texture;self.face.setScale(1);self.face.size=texture.size()
                self.face.xScale=128/max(1,self.face.size.width);self.face.yScale=128/max(1,self.face.size.height)
                self.stack.removeAllChildren();self.pips.removeAllChildren();onFinished()
            },onCancelled:{[weak self] in
                if self?.sourceRestoreEmptyFaceID==id {self?.sourceRestoreEmptyFaceFrame=nil;self?.sourceRestoreEmptyFaceID=nil}
                onCancelled()
            })
        guard let lease,!disposed,sourceGeneration==generation,parent === capturedParent else{lease?.cancel();return false}
        sourceRestoreEmptyFaceFrame=lease
        return lease.active
    }
    // Genuine ordinary createTile -> restored Wild assignment, independent of
    // typed APP static-skin receipts. This record owns only the constructor and
    // board.setValue face, not complete Wild/idle/transaction admission.
    private weak var sourceRestoredWildParent:SKNode?
    private var sourceRestoredWildIdentity:(generation:UInt64,kind:String,variant:String?)?
    private var sourceRestoredWildDropMarkers:NativeWildMeterDropRuntime.SourceTileMarkers?
    private var sourceRestoredWildFaceHit: CGRect?
    private var sourceRestoreWildFaceID:UUID?
    private var sourceRestoreWildFaceFrame:NativeSourceAnimationClockService.SourceFrameLease?
    var sourceRestoredWildConstructorCurrent:Bool {
        guard !disposed,let identity=sourceRestoredWildIdentity else{return false}
        return sourceGeneration==identity.generation && parent === sourceRestoredWildParent && parent != nil &&
            kind==identity.kind && variant==identity.variant && !sourceWildStateCleared
    }
    var sourceRestoreWildFacePending:Bool {sourceRestoreWildFaceFrame?.active==true}
    /// Restore constructs a Wild holder without entering the carrier/drop path.
    /// These fields belong to that constructor, not an absent carrier owner.
    func captureSourceRestoredWildDropMarkers()->NativeWildMeterDropRuntime.SourceTileMarkers? {
        guard sourcePhysicalMarkersCovered,sourceRestoredWildConstructorCurrent,
              !sourceOpenedWildConstructorCurrent else{return nil}
        return sourceRestoredWildDropMarkers
    }
    /// The caller has genuinely created the ordinary holder and captured tilt.
    /// Assign the restored identity without constructing a Raw special node,
    /// changing the captured pose, choosing a hash skin, or starting idle FX.
    func restoreSourceWildHolder(_ tile:NativeTile,service:NativeSourceAnimationClockService,
        current:@escaping()->Bool,onFinished:@escaping()->Void,onCancelled:@escaping()->Void)->Bool {
        guard !disposed,let capturedParent=parent,tile.id==tileID,kind=="regular",variant==nil,
              value==0,depth==1,sourceMarkerCoverageGeneration==sourceGeneration,
              let core=tile.archetype,tile.value==6,!tile.sourceWildStateCleared,!tile.sourceResidualWildPresence,
              tile.variant.map({NativeSpecialDiceRegistry.compatibleVariant($0,core:core) != nil}) ?? true,
              let requested=NativeDiceArtwork.sourceWildSkinDefinition(kind:core.rawValue,variant:tile.variant),
              sourceRestoreWildFaceFrame==nil,sourceRegularFrameBinding==nil,current(),!disposed,
              parent === capturedParent else{return false}
        let generation=sourceGeneration
        kind=core.rawValue;variant=tile.variant;value=tile.value;locked=tile.locked;depth=1
        definition=requested;sourceIdleDeferred=true;sourceRegistryPending=false
        sourceEventMode=locked ? "none":"static";alpha=CGFloat(tile.alpha);isHidden = !tile.visible
        sourceWildStateCleared=false;sourceResidualWildPresence=false
        sourceRestoredWildParent=capturedParent
        sourceRestoredWildIdentity=(generation,kind,variant)
        sourceRestoredWildDropMarkers = .init(dropping:false,handoffLocked:false)
        let id=UUID();sourceRestoreWildFaceID=id
        let lease=service.requestSourceAnimationFrame(ownerID:"restore-wild:\(tileID):\(generation)",generation:generation,
            callback:{[weak self] in
                guard let self,self.sourceRestoreWildFaceID==id else{return}
                self.sourceRestoreWildFaceFrame=nil;self.sourceRestoreWildFaceID=nil
                guard self.sourceRestoredWildConstructorCurrent,self.sourceGeneration==generation else{onCancelled();return}
                let admitted=current()
                guard admitted,self.sourceRestoredWildConstructorCurrent,self.sourceGeneration==generation,
                      let texture=self.textures.sourceCachedTexture(candidates:[requested.path]) else{onCancelled();return}
                // Literal board._setValueVisuals Wild branch: no numbers draw,
                // no idle endpoint, and no typed upload receipt is fabricated.
                self.depth=1;self.stack.removeAllChildren();self.pips.removeAllChildren();self.pips.isHidden=true
                self.shadow.isHidden=true
                // All thirteen current Source registry variants explicitly own
                // a tile-sized board.setValue hit shape; plain cores retain
                // their constructor hit until the separate APP skin caller.
                if self.variant != nil {self.sourceRestoredWildFaceHit=CGRect(x:-64,y:-64,width:128,height:128)}
                self.face.texture=texture;self.face.setScale(1);self.face.size=requested.size
                self.face.anchorPoint=requested.anchor;self.face.alpha=1;self.face.isHidden=false;self.face.colorBlendFactor=0
                self.onResourceReady?()
                guard self.sourceRestoredWildConstructorCurrent,self.sourceGeneration==generation,current(),
                      self.sourceRestoredWildConstructorCurrent else{onCancelled();return}
                onFinished()
            },onCancelled:{[weak self] in
                if self?.sourceRestoreWildFaceID==id {self?.sourceRestoreWildFaceFrame=nil;self?.sourceRestoreWildFaceID=nil}
                onCancelled()
            })
        guard let lease,!disposed,sourceGeneration==generation,parent === capturedParent,
              sourceRestoreWildFaceID==id else{lease?.cancel();return false}
        sourceRestoreWildFaceFrame=lease
        return lease.active
    }
    private func retireSourceRestoredWildFrame() {
        let captured=sourceRestoreWildFaceFrame;sourceRestoreWildFaceFrame=nil;sourceRestoreWildFaceID=nil
        captured?.cancel()
    }

    // Literal openAtCell setValue6 on an actual captured zero holder. This
    // lineage is independent of restore and of the later typed APP upload.
    private weak var sourceOpenedWildParent:SKNode?
    private var sourceOpenedWildIdentity:(id:UUID,generation:UInt64,kind:String,variant:String?)?
    private var sourceOpenedWildFaceHit:CGRect?
    private weak var sourceOpenedWildTexture:SKTexture?
    private var sourceOpenedWildFrame:NativeSourceAnimationClockService.SourceFrameLease?
    var sourceOpenedWildConstructorCurrent:Bool {
        guard !disposed,let identity=sourceOpenedWildIdentity else{return false}
        return identity.generation==sourceGeneration && identity.kind==kind && identity.variant==variant &&
            parent != nil && parent === sourceOpenedWildParent && !sourceWildStateCleared && !sourceResidualWildPresence
    }
    var sourceOpenedWildFacePending:Bool {sourceOpenedWildFrame?.active==true}
    var sourceOpenedWildFaceCurrent:Bool {
        sourceOpenedWildConstructorCurrent && !sourceOpenedWildFacePending && sourceOpenedWildTexture != nil &&
            face.texture === sourceOpenedWildTexture && textures.sourceRasterPixelSize(for:face.texture!) != nil
    }
    @discardableResult func openSourceWildCore(_ core:String,selectedVariant:String?,
        service:NativeSourceAnimationClockService,current:@escaping()->Bool,onCancelled:@escaping()->Void)->Bool {
        guard !disposed,parent != nil,kind=="regular",variant==nil,value==0,depth==1,sourceIdleDeferred,
              sourceMarkerCoverageGeneration==sourceGeneration,service.sourceFrameTransportAdmissionOpen,
              let requested=NativeDiceArtwork.sourceWildSkinDefinition(kind:core,variant:nil),
              let selected=NativeDiceArtwork.sourceWildSkinDefinition(kind:core,variant:selectedVariant),current() else{return false}
        // Targeted preparation stays with the existing texture owner, before
        // queuing the raw face. The RAF itself must never decode or upload.
        guard textures.texture(requested.path,densityAware:false) != nil,
              textures.texture(selected.path,densityAware:false) != nil,current(),!disposed,
              kind=="regular",value==0,let capturedParent=parent else{return false}
        retireSourceStackFrames();retireSourceWildShimmer()
        guard current(),!disposed,parent === capturedParent,kind=="regular",value==0 else{return false}
        let id=UUID(),generation=sourceGeneration
        kind=core;variant=nil;value=6;depth=1;locked=false;definition=requested
        sourceWildStateCleared=false;sourceResidualWildPresence=false;sourceEventMode="static";alpha=1
        stack.removeAllChildren();pips.removeAllChildren();pips.isHidden=true
        sourceWildSkinRevision &+= 1
        sourceOpenedWildParent=capturedParent;sourceOpenedWildIdentity=(id,generation,core,nil)
        sourceOpenedWildTexture=nil
        let valid:()->Bool = {[weak self,weak capturedParent] in
            guard let self,let capturedParent,self.sourceOpenedWildIdentity?.id==id,
                  self.sourceOpenedWildConstructorCurrent,self.sourceGeneration==generation,
                  self.parent === capturedParent else{return false}
            return current() && !self.disposed && self.sourceOpenedWildIdentity?.id==id && self.sourceOpenedWildConstructorCurrent
        }
        guard let lease=service.requestSourceAnimationFrame(ownerID:"open-wild:\(tileID):\(generation)",generation:generation,
            callback:{[weak self] in
                guard let self,self.sourceOpenedWildIdentity?.id==id else{return}
                self.sourceOpenedWildFrame=nil
                // Original board._setValueVisuals reads the live variant at
                // delivery, not the variant that existed when setValue queued.
                guard valid(),let face=NativeDiceArtwork.sourceWildSkinDefinition(kind:self.kind,variant:self.variant),
                      let texture=self.textures.sourceCachedTexture(candidates:[face.path]) else{onCancelled();return}
                self.value=6;self.depth=1;self.stack.removeAllChildren();self.pips.removeAllChildren();self.pips.isHidden=true;self.shadow.isHidden=true
                self.face.texture=texture;self.face.setScale(1);self.face.size=face.size;self.face.anchorPoint=face.anchor
                self.face.alpha=1;self.face.isHidden=false;self.face.colorBlendFactor=0
                if self.variant != nil {self.sourceOpenedWildFaceHit=CGRect(x:-64,y:-64,width:128,height:128)}
                self.sourceOpenedWildTexture=texture;self.onResourceReady?()
                if !valid(){onCancelled()}
            },onCancelled:{[weak self] in
                if self?.sourceOpenedWildIdentity?.id==id {self?.sourceOpenedWildFrame=nil}
                onCancelled()
            }),valid() else{retireSourceOpenedWildFrame();return false}
        sourceOpenedWildFrame=lease;return lease.active
    }
    @discardableResult func applySourceOpenedWildVariant(_ selected:String?)->Bool {
        guard sourceOpenedWildConstructorCurrent,sourceIdleDeferred,
              let requested=NativeDiceArtwork.sourceWildSkinDefinition(kind:kind,variant:selected),
              textures.sourceCachedTexture(candidates:[requested.path]) != nil,
              var identity=sourceOpenedWildIdentity else{return false}
        // Registry assignment is fields-only. If the raw face already fired,
        // retain that actual core mask until the separate APP skin paints.
        retireSourceWildShimmer();sourceWildSkinRevision &+= 1
        variant=selected;identity.variant=selected;sourceOpenedWildIdentity=identity;definition=requested
        return sourceOpenedWildConstructorCurrent
    }
    private func retireSourceOpenedWildFrame(){
        let captured=sourceOpenedWildFrame;sourceOpenedWildFrame=nil
        sourceOpenedWildIdentity=nil;sourceOpenedWildParent=nil;sourceOpenedWildTexture=nil;sourceOpenedWildFaceHit=nil
        captured?.cancel()
    }

    // Presentation ownership only; this is not a fabricated Source input,
    // save, idle or spawning marker. Exact captured Root id owns these channels.
    private(set) var sourceBoardEntryBinding:UUID?
    var sourceBoardEntryIdentityAdmitted:Bool {
        guard !disposed,!sourceWildStateCleared,!sourceResidualWildPresence else{return false}
        if kind=="regular",variant==nil,!isSpecial {return true}
        guard sourceRestoredWildConstructorCurrent,sourceIdleDeferred,
              let core=NativeWildArchetype(rawValue:kind) else{return false}
        return variant.map{NativeSpecialDiceRegistry.compatibleVariant($0,core:core) != nil} ?? true
    }
    func beginSourceBoardEntryPaint(id:UUID)->Bool {
        guard !disposed,parent != nil,sourceBoardEntryIdentityAdmitted,
            sourceBoardEntryBinding==nil,!dragging,!sourceResidualWildPresence,
            !sourceOuterOwners.pickupScale,!sourceOuterOwners.snapBack,
            !sourceOuterOwners.mergeImpact,!sourceOuterOwners.isBeingSpawned,
            !sourceOuterOwners.pendingRemoval,!sourceOuterOwners.beingRemoved,
            !sourceOuterOwners.cleanupQueued,!sourceOuterOwners.wildSpawnDropping else{return false}
        sourceBoardEntryBinding=id
        let generation=sourceGeneration,capturedParent=parent
        sourceOuterBridge?.interrupt()
        return !disposed && sourceBoardEntryBinding==id && sourceGeneration==generation && parent === capturedParent
    }
    func paintSourceBoardEntry(id:UUID,position:CGPoint,rotation:Double,scale:Double,alpha:Double) {
        guard !disposed,sourceBoardEntryBinding==id,parent != nil else{return}
        self.position=position;zRotation=CGFloat(rotation);paintSourceOuterScale(CGPoint(x:scale,y:scale));self.alpha=CGFloat(alpha);isHidden=false
    }
    func paintSourceBoardEntryRest(id:UUID,position:CGPoint,rotation:Double) {
        guard !disposed,sourceBoardEntryBinding==id,parent != nil else{return};self.position=position;zRotation=CGFloat(rotation)
    }
    func settleSourceBoardEntry(id:UUID,position:CGPoint,rotation:Double) {
        guard !disposed,sourceBoardEntryBinding==id,parent != nil else{return}
        self.position=position;zRotation=CGFloat(rotation);paintSourceOuterScale(CGPoint(x:1,y:1));isHidden=false
        alpha=locked ? (value>0 ? 0:0.25):1
        visual.alpha=1;face.alpha=1;pips.alpha=1
    }
    func endSourceBoardEntryPaint(id:UUID) {if sourceBoardEntryBinding==id{sourceBoardEntryBinding=nil}}

    func normalizeSourceTutorialInitialTile()->Bool {
        guard !disposed,kind=="regular",variant==nil,!isSpecial,!dragging,
            !sourceRegularFramePending,!sourceResidualWildPresence,parent != nil,
            !sourceOuterOwners.pickupScale,!sourceOuterOwners.snapBack,
            !sourceOuterOwners.mergeImpact,!sourceOuterOwners.isBeingSpawned,
            !sourceOuterOwners.pendingRemoval,!sourceOuterOwners.beingRemoved,
            !sourceOuterOwners.cleanupQueued,!sourceOuterOwners.wildSpawnDropping else{return false}
        let capturedGeneration=sourceGeneration,capturedParent=parent
        // Existing outer owner targets this tile/scale/rotation. Keep driver,
        // shadow and independent raw frames bound; generic retirement is wrong.
        sourceOuterBridge?.interrupt()
        guard !disposed,sourceGeneration==capturedGeneration,parent === capturedParent else{return false}
        depth=1;paintSourceOuterScale(CGPoint(x:1,y:1));visual.setScale(1)
        return !disposed && sourceGeneration==capturedGeneration && parent === capturedParent
    }
    private(set) var sourceTutorialInitialSpawned=false
    func setSourceTutorialInitialValue(_ next:Int)->Bool {
        guard !disposed,kind=="regular",variant==nil,!isSpecial,(1...6).contains(next),parent != nil else{return false}
        sourceTutorialInitialSpawned=true;sourceEventMode="static"
        return forceSourceTutorialInitialValue(next)
    }
    func forceSourceTutorialInitialValue(_ next:Int)->Bool {
        guard !disposed,kind=="regular",variant==nil,!isSpecial,(1...6).contains(next),parent != nil else{return false}
        value=next;locked=false;sourceWildStateCleared=false;sourceResidualWildPresence=false
        isHidden=false;alpha=1;face.isHidden=false;face.alpha=1
        return drawSourceTutorialPips(next)
    }
    @discardableResult func drawSourceTutorialPips(_ next:Int)->Bool {
        guard !disposed,kind=="regular",variant==nil,!isSpecial,parent != nil else{return false}
        pips.removeAllChildren();pips.position = .zero;pips.setScale(1);pips.zRotation=0
        pips.isHidden=false;pips.alpha=1;pips.zPosition=50
        let maps=[1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]]
        let half=128.0*0.42/2,size=15.0,radius=5.0
        for index in maps[max(1,min(6,next))] ?? [4] {
            let x=Double(index%3-1)*half,y = -Double(index/3-1)*half
            let pip=SKShapeNode(rect:CGRect(x:x-size/2,y:y-size/2,width:size,height:size),cornerRadius:radius)
            pip.fillColor=UIColor(red:143.0/255,green:106.0/255,blue:85.0/255,alpha:0.96);pip.strokeColor = .clear
            pips.addChild(pip)
        }
        return true
    }
    var sourceTutorialPlainStarFaceReady:Bool {
        !disposed && parent != nil && kind=="wild" && variant==nil &&
            textures.sourceCachedTexture(candidates:["assets/wild.png"]) != nil
    }
    @discardableResult func commitSourceTutorialWildFields(generation:UInt64)->Bool {
        guard sourceTutorialPlainStarFaceReady,sourceGeneration==generation,generation>0 else{return false}
        value=6;locked=false;sourceWildStateCleared=false;sourceResidualWildPresence=false
        isHidden=false;alpha=1;sourceEventMode="static"
        return true
    }
    /// Source _setValueVisuals plain-Star branch, called only by the captured
    /// tutorial RAF owner. It paints the same node without generic rebuild,
    /// idle admission, asset decoding, or a Math draw.
    @discardableResult func paintSourceTutorialWildFace(generation:UInt64,current:()->Bool)->Bool {
        guard !disposed,generation>0,sourceGeneration==generation,parent != nil,
            kind=="wild",variant==nil,current(),!disposed,
            sourceGeneration==generation,kind=="wild",variant==nil,
            let texture=textures.sourceCachedTexture(candidates:["assets/wild.png"]) else{return false}
        value=6;depth=1;locked=false;sourceWildStateCleared=false;sourceResidualWildPresence=false
        stack.removeAllChildren();pips.removeAllChildren();pips.isHidden=true
        face.texture=texture;face.setScale(1);face.size=texture.size()
        face.xScale=128/max(1,texture.size().width);face.yScale=128/max(1,texture.size().height)
        face.anchorPoint=CGPoint(x:0.5,y:0.5);face.colorBlendFactor=0;face.alpha=1;face.isHidden=false
        shadow.isHidden=true
        sourceStarSheet?.baseFacePainted()
        return !disposed && sourceGeneration==generation && parent != nil
    }

    func setSourceTutorialInitialFocus(_ focused:Bool)->Bool {
        guard !disposed,kind=="regular",variant==nil,!isSpecial,parent != nil else{return false}
        isHidden=false;sourceEventMode=focused ? "static":"none"
        return !focused || drawSourceTutorialPips(value>0 ? value:1)
    }

    // Captured app-spawn bounce cancellation is a real timeline interruption,
    // not a synthetic Source `_isBeingSpawned`/`_spawnTween` marker.
    private var sourceAppSpawnInterruption:(id:String,pickup:()->Void,interrupted:()->Void)?
    @discardableResult func bindSourceAppSpawnInterruption(id:String,pickup:@escaping()->Void,interrupted:@escaping()->Void)->Bool {
        guard !disposed,sourceAppSpawnInterruption==nil else{return false}
        sourceAppSpawnInterruption=(id,pickup,interrupted);return true
    }
    func unbindSourceAppSpawnInterruption(id:String) {
        guard sourceAppSpawnInterruption?.id==id else{return};sourceAppSpawnInterruption=nil
    }
    private func interruptSourceAppSpawn() {
        let captured=sourceAppSpawnInterruption;sourceAppSpawnInterruption=nil
        captured?.interrupted()
    }
    /// Regular branch of app-core repairBoardTileVisuals. External flags must
    /// come from complete captured APP owners, not a missing dictionary row.
    /// Special/Wild broker repair remains a separate required branch.
    @discardableResult func repairSourceRegularBoardVisuals(outerTransformOwned:Bool,
        activeDrag:Bool,innerImpactOwned:Bool,wildDropping:Bool,retireUnownedInnerTransform:()->Bool,current:()->Bool)->Bool {
        guard sourcePhysicalMarkersCovered,parent != nil,kind=="regular",variant==nil,
              !sourceResidualWildPresence else{return false}
        if isHidden || wildDropping {return true}
        let generation=sourceGeneration,capturedParent=parent,revision=sourceBindingRevision
        func valid()->Bool {
            guard !disposed,sourceGeneration==generation,parent === capturedParent,sourceBindingRevision==revision else{return false}
            let accepted=current()
            return accepted && !disposed && sourceGeneration==generation && parent === capturedParent && sourceBindingRevision==revision
        }
        guard valid() else{return false}
        func outerOwned()->Bool {
            outerTransformOwned || activeDrag || dragging || sourceIdleTimelinePresent ||
                sourceOuterOwners.competes || sourceSkipIdleScaleReset || !sourceLockedSpawnMarkers.isEmpty
        }
        var local=sourceLocalScale
        let sx=local.x.isFinite ? local.x:1,sy=local.y.isFinite ? local.y:1
        if !outerOwned(),min(sx,sy)<0.86 {
            killSourceActiveScaleChildren();guard valid() else{return false}
            if !outerOwned(){paintSourceOuterScale(CGPoint(x:1,y:1))}
        }
        guard valid() else{return false}
        if value<=0 {return true}
        local=sourceLocalScale
        if !outerOwned(),abs(local.x-1)>0.005 || abs(local.y-1)>0.005 || abs(sourceRotation)>0.005 {
            killSourceActiveScaleChildren();guard valid() else{return false}
            if !outerOwned(){paintSourceOuterScale(CGPoint(x:1,y:1));paintSourceIdleRotation(0)}
        }
        guard valid() else{return false}
        if !activeDrag,!dragging,!innerImpactOwned {
            let x=visual.xScale.isFinite ? visual.xScale:1,y=visual.yScale.isFinite ? visual.yScale:1
            if min(x,y)<0.90 || max(x,y)>1.10 || abs(x-y)>0.08 || abs(visual.zRotation)>0.12 {
                // Borrow the actual inner transform retirement owner. Missing
                // authority must not leave an orphan tween repainting this pose.
                guard retireUnownedInnerTransform(),valid() else{return false}
                visual.setScale(1);visual.zRotation=0
            }
        }
        guard let texture=face.texture ?? textures.sourceCachedTexture(candidates:["assets/numbers.png"]),valid() else{return false}
        alpha=1;visual.alpha=1;face.alpha=1;face.isHidden=false;pips.alpha=1
        // Preserve current authored numbers skin and Source texture/scale
        // representation used by subsequent stack-layer capture. No Math draw.
        face.texture=texture;face.setScale(1);face.size=texture.size()
        face.xScale=128/max(1,texture.size().width);face.yScale=128/max(1,texture.size().height)
        face.anchorPoint=CGPoint(x:0.5,y:0.5)
        return valid()
    }
    /// Local second pass at each spawn safety deadline. Unlike the full
    /// prepass, regular opacity/pips repair also applies to hidden roots.
    @discardableResult func repairSourceRegularSpawnOpacity(wildDropping:Bool)->Bool {
        guard sourcePhysicalMarkersCovered,parent != nil,kind=="regular",variant==nil,
              !sourceResidualWildPresence else{return false}
        if wildDropping {return true}
        if locked,value<=0,!isHidden,alpha<0.08 {alpha=0.2}
        if locked || value<=0 {return true}
        if alpha<0.99 {ensureSourceAppSpawnFullOpacity()}
        if pips.isHidden {pips.isHidden=false}
        return true
    }
    func ensureSourceAppSpawnFullOpacity() {
        guard !disposed else{return}
        alpha=1;visual.alpha=1;face.alpha=1;pips.alpha=1;pips.isHidden=false
    }
    /// app-spawn.openAtCell normalizes/binds, then Core and immediate setValue,
    /// then the independent raw numbers/pips RAF. No decorative bounce wait.
    func openSourceAppSpawnHolder(_ value:Int,service:NativeSourceAnimationClockService,
        random:@escaping()->Double,current:@escaping()->Bool,frameCurrent:(()->Bool)?=nil,beforeSetValue:()->Bool,
        onCancelled:@escaping()->Void)->Bool {
        guard !disposed,!isSpecial,self.value==0,depth==1,parent != nil,value>0,value<6 else{return false}
        let capturedGeneration=sourceGeneration,capturedParent=parent
        locked=false;sourceEventMode="static";ensureSourceAppSpawnFullOpacity()
        guard beforeSetValue(),!disposed,sourceGeneration==capturedGeneration,parent === capturedParent,current(),
            !disposed,sourceGeneration==capturedGeneration,parent === capturedParent else{return false}
        // The finite Promise caller may retire after arrival. Its token still
        // guards admission above, while the actual retained Node/app-scope
        // frame context owns subsequent setValue/merge face RAFs. Nil keeps the
        // old primitive semantics for callers not genuinely mapped yet.
        return queueSourceStackValue(value,addStack:0,service:service,random:random,current:frameCurrent ?? current,
            onCancelled:onCancelled)
    }
    // Exact retained conversion token; an old cleanup never owns a later C
    // conversion on this same container. It is NOT a Source activity marker.
    private var sourceMagnetConversionRevision:UInt64=0
    var sourceRetainedMagnetConversionRevision:UInt64 {sourceMagnetConversionRevision}
    /// Literal v9 app-merge survivor conversion: this actual container is
    /// normalized/reset before setValue's separate raw numbers RAF. Resources
    /// must already be retained. No hash skin/replacement Node is constructed.
    func convertSourceMagnetSurvivor(position:CGPoint,depthZ:CGFloat,selectValue:()->Int?,
        service:NativeSourceAnimationClockService,driver:NativeTileOuterTimelineDriver,
        random:@escaping()->Double,current:@escaping()->Bool,frameCurrent:@escaping()->Bool,
        beforeSetValue:()->Bool,onCancelled:@escaping()->Void)->Bool {
        guard !disposed,parent != nil,sourcePhysicalMarkersCovered,
              textures.sourceRetainedRegularOpenTexturesReady,
              let tileTexture=textures.texture("assets/tile.png",densityAware:false) else{return false}
        sourceMagnetConversionRevision &+= 1;let revision=sourceMagnetConversionRevision
        let generation=sourceGeneration,capturedParent=parent
        func valid()->Bool {
            guard !disposed,sourceMagnetConversionRevision==revision,sourceGeneration==generation,parent === capturedParent else{return false}
            let accepted=current()
            return accepted && !disposed && sourceMagnetConversionRevision==revision && sourceGeneration==generation && parent === capturedParent
        }
        guard valid() else{return false}
        // Seal family/frame/outer owners before external captured retirement.
        // Suppression is established without rebuild/onResourceReady callbacks.
        sourceIdleDeferred=true;sourceRegistryPending=false;artworkGeneration &+= 1
        let idleScope=sourceSpecialIdle
        idleScope?.retire(self);guard valid() else{return false}
        retireSourceAnimationBindingsPreservingPaint();guard valid() else{return false}
        let phase=artworkPhaseID;artworkPhaseID=nil;artworkRunning=false;artworkElapsed=0
        if let phase {textures.releaseIdlePhase(phase)}
        guard valid() else{return false}
        let oldKanta=kantaIdle,oldMushroom=mushroomSmoke,oldEngine=spaceshipEngine,oldHoney=honeyIdle,oldFizz=idleFizz
        kantaIdle=nil;mushroomSmoke=nil;spaceshipEngine=nil;honeyIdle=nil;idleFizz=nil
        oldKanta?.dispose();guard valid() else{return false}
        oldMushroom?.dispose();guard valid() else{return false}
        oldEngine?.dispose();guard valid() else{return false}
        oldHoney?.dispose();guard valid() else{return false}
        oldFizz?.dispose();guard valid() else{return false}
        self.position=position;zRotation=0;paintSourceOuterScale(CGPoint(x:1,y:1))
        visual.position = .zero;visual.zRotation=0;visual.setScale(1);visual.alpha=1;visual.isHidden=false
        spaceshipRoot.position = .zero;spaceshipRoot.zRotation=0;spaceshipRoot.setScale(1)
        face.removeFromParent();visual.addChild(face)
        face.anchorPoint=CGPoint(x:0.5,y:0.5);face.position = .zero;face.zRotation=0
        face.texture=tileTexture;face.size=CGSize(width:128,height:128);face.setScale(1);face.alpha=1;face.isHidden=false
        shadow.zRotation=0;shadow.setScale(1);shadow.isHidden=false
        // Literal collapse/normalization precedes randomRegularTileValue.
        // Retirement/current hooks may synchronously deliver callbacks; the
        // shared APP draw therefore cannot be precomputed by the caller.
        stack.removeAllChildren();pips.removeAllChildren()
        guard valid(),let value=selectValue(),value>0,value<6,valid() else{return false}
        artwork.isHidden=true;flowerCanvas.isHidden=true;frames=[];paintedFrame = -1;fishMediaReady=false
        kind="regular";variant=nil;sourceWildStateCleared=false;sourceResidualWildPresence=false
        definition=NativeDiceArtwork.definition(kind:"regular",variant:nil,regularSkin:0)
        depth=1;sourceMaxStackDepth=1;locked=false;isHidden=false;alpha=1;sourceEventMode="static";zPosition=depthZ
        sourceCurrentRegularSkin=nil;sourceRegistryPaused=false;sourceIdleDeferred=false
        stack.removeAllChildren();pips.removeAllChildren();pips.position = .zero;pips.setScale(1);pips.zRotation=0;pips.alpha=1;pips.isHidden=false
        installSourceOuterDriver(driver,generation:generation,geometryScale:sourceNativeGeometryScale)
        guard valid() else{return false}
        let capturedFrameCurrent:()->Bool = {[weak self,weak capturedParent] in
            guard let self,let capturedParent,!self.disposed,self.sourceMagnetConversionRevision==revision,
                  self.sourceGeneration==generation,self.parent === capturedParent else{return false}
            let accepted=frameCurrent()
            return accepted && !self.disposed && self.sourceMagnetConversionRevision==revision && self.sourceGeneration==generation && self.parent === capturedParent
        }
        guard beforeSetValue(),valid() else{return false}
        return queueSourceStackValue(value,addStack:0,service:service,random:random,current:capturedFrameCurrent,onCancelled:onCancelled)
    }


    /// Original ONE shared drawStack/drawPips batch reads the immediate value,
    /// and never selects a numbers skin when all initial depths are one.
    func flushSourceInitialHolderVisuals() {
        guard !disposed,!isSpecial,depth==1 else{return}
        stack.removeAllChildren();pips.removeAllChildren()
        pips.position = .zero;pips.setScale(1);pips.zRotation=0;pips.alpha=1;pips.isHidden=false
        guard !locked,value>0 else{return}
        let maps=[1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8]]
        for index in maps[value] ?? [] {
            let x=CGFloat(index%3-1)*25.6,y = -CGFloat(index/3-1)*25.6
            let pip=SKSpriteNode(texture:textures.pipTexture(),size:CGSize(width:15,height:15))
            pip.position=CGPoint(x:x,y:y)
            pips.addChild(pip)
        }
    }
    @discardableResult func queueSourceStackValue(_ value:Int,addStack:Int,service:NativeSourceAnimationClockService,random:@escaping()->Double,current:@escaping()->Bool,onPhysicalCommit:(()->Bool)?=nil,onFinished:(()->Void)?=nil,onCancelled:(()->Void)?=nil)->Bool {
        guard !disposed,!isSpecial,!locked,value>0,value<6,parent != nil else{onCancelled?();return false}
        if sourceRegularFrameBinding==nil {
            let available=sourceNumbersSkinsAvailable()
            guard available.contains(.base),!disposed,parent != nil else{onCancelled?();return false}
            sourceRegularFrameParent=parent;sourceRegularFrameGeneration=sourceGeneration;sourceMaxStackDepth=max(1,depth)
            sourceRegularFrameService=service
            sourceRegularFrameBinding=NativeRegularStackFrameBinding(host:self,service:service,available:available,random:random,current:current)
        }
        return sourceRegularFrameBinding?.setValue(value,addStack:addStack,onPhysicalCommit:onPhysicalCommit,onFinished:onFinished,onCancelled:onCancelled)==true
    }
    func retireSourceStackFrames() {
        retireSourceOpenedWildFrame()
        retireSourceRestoredWildFrame()
        if let empty=sourceRestoreEmptyFaceFrame {
            let captured=sourceRegularFrameBinding
            sourceRestoreEmptyFaceFrame=nil;sourceRestoreEmptyFaceID=nil
            sourceRegularFrameBinding=nil;sourceRegularFrameService=nil;sourceRegularFrameParent=nil;sourceRegularFrameGeneration=nil
            retireSourceWildDestinationFrames();empty.cancel();captured?.dispose();return
        }
        retireSourceWildDestinationFrames()
        let captured=sourceRegularFrameBinding
        sourceRegularFrameBinding=nil;sourceRegularFrameService=nil;sourceRegularFrameParent=nil;sourceRegularFrameGeneration=nil
        captured?.dispose()
    }
    func prepareSourceStackSkin(_ skin:NativeRegularStackLayout.Skin) {
        guard sourceAlive,let texture=textures.texture(String(skin.rawValue.dropFirst(2)),densityAware:false) else{return}
        sourceCurrentRegularSkin=skin
        face.texture=texture;face.setScale(1);face.size=texture.size();face.xScale=128/max(1,texture.size().width);face.yScale=128/max(1,texture.size().height)
        face.isHidden=false;face.alpha=1
    }
    func installSourceStackFace(_ layout:NativeRegularStackLayout) {
        guard sourceAlive,!isSpecial,!locked else{return}
        installSourceStackLayers(layout)
        pips.removeAllChildren();pips.position = .zero;pips.setScale(1);pips.zRotation=0;pips.alpha=1;pips.isHidden=false
        let maps=[1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]]
        for index in maps[value] ?? [] {
            let x=CGFloat(index%3-1)*25.6,y = -CGFloat(index/3-1)*25.6
            let pip=SKSpriteNode(texture:textures.pipTexture(),size:CGSize(width:15,height:15))
            pip.position=CGPoint(x:x,y:y)
            pips.addChild(pip)
        }
    }
    private func installSourceStackLayers(_ layout:NativeRegularStackLayout) {
        guard sourceAlive,!isSpecial,!locked,let texture=face.texture else{return}
        sourceStackRevision &+= 1;stack.removeAllChildren()
        for layer in layout.layers {
            let container=SKNode();container.name="source-stack-layer-\(layer.index)"
            container.position=CGPoint(x:layer.x,y:-layer.y);container.zRotation = -layer.rotation;container.zPosition=CGFloat(layer.z)
            let sprite=SKSpriteNode(texture:texture);sprite.anchorPoint=CGPoint(x:layer.anchorX,y:1-layer.anchorY)
            sprite.xScale=layer.spriteScaleX;sprite.yScale=layer.spriteScaleY;sprite.alpha=layer.spriteAlpha
            container.addChild(sprite)
            let rectangle=CGRect(x:-layer.size/2,y:-layer.size/2,width:layer.size,height:layer.size)
            let overlay=SKShapeNode(rect:rectangle,cornerRadius:layer.overlayRadius)
            overlay.fillColor=UIColor(red:139.0/255,green:90.0/255,blue:43.0/255,alpha:1);overlay.strokeColor = .clear;overlay.alpha=layer.overlayAlpha
            container.addChild(overlay);stack.addChild(container)
        }
    }
    func sourceMergeSixFaceReady(service:NativeSourceAnimationClockService)->Bool {sourceAlive && sourceRegularFrameService === service && sourceRegularFrameBinding?.sourceAdmissionOpen==true && !isSpecial && !locked && sourceCurrentRegularSkin != nil && service.sourceFrameTransportAdmissionOpen && sourceNumbersSkinsAvailable().contains(.base)}
    /// Original setValue6 queues its skin draw; immediate drawStack uses the
    /// already painted skin and changes no pips before that genuine RAF.
    func prepareSourceMergeSixFace(depth:Int,final:Bool,usesSourceDestinationParentState:Bool=false,service:NativeSourceAnimationClockService,
        random:@escaping()->Double,onFaceCancelled:@escaping()->Void)->Bool {
        guard sourceMergeSixFaceReady(service:service),let binding=sourceRegularFrameBinding,let skin=sourceCurrentRegularSkin else{return false}
        guard binding.setValue(6,addStack:0,onCancelled:onFaceCancelled),sourceAlive else{return false}
        sourceStackDepth=final ? 1:min(4,max(1,depth))
        let layout=NativeRegularStackLayout.captureLayers(depth:sourceStackDepth,skin:skin,baseX:sourceBaseX,baseY:sourceBaseY,
            baseScaleX:sourceBaseScaleX,baseScaleY:sourceBaseScaleY,anchorX:sourceBaseAnchorX,anchorY:sourceBaseAnchorY,random:random)
        guard sourceAlive else{return false}
        installSourceStackLayers(layout);sourceEventMode="none";zPosition=10000
        if usesSourceDestinationParentState {
            alpha=1
            if final {visual.isHidden=true;shadow.isHidden=true}
        } else if final {isHidden=true}
        return sourceAlive
    }
    /// Narrow literal normal core-Magnet→regular-dst prefix. The authentic
    /// protected face RAF keeps its old painted skin; no variant conversion or
    /// retained Wild backing is guessed here.
    func prepareSourceMagnetRegularDestination(_ plan:NativeSpecialMovePlan,
        service:NativeSourceAnimationClockService,random:@escaping()->Double,onFaceCancelled:@escaping()->Void)->Bool {
        prepareSourceSpecialRegularDestination(plan,expected:.magnet,service:service,random:random,onFaceCancelled:onFaceCancelled)
    }
    func prepareSourceTntRegularDestination(_ plan:NativeSpecialMovePlan,
        service:NativeSourceAnimationClockService,random:@escaping()->Double,onFaceCancelled:@escaping()->Void)->Bool {
        prepareSourceSpecialRegularDestination(plan,expected:.tnt,service:service,random:random,onFaceCancelled:onFaceCancelled)
    }
    private func prepareSourceSpecialRegularDestination(_ plan:NativeSpecialMovePlan,expected:NativeWildArchetype,
        service:NativeSourceAnimationClockService,random:@escaping()->Double,onFaceCancelled:@escaping()->Void)->Bool {
        guard plan.archetype == expected,NativeSpecialDiceRegistry.finale(source:plan.source,destination:plan.destination,gameplay:true)==expected,
              !plan.destination.isWild,plan.destination.variant==nil,plan.destination.id==tileID,
              plan.generation==sourceGeneration,!sourceResidualWildPresence else{return false}
        guard prepareSourceMergeSixFace(depth:min(4,plan.source.stackDepth+plan.destination.stackDepth),final:false,
            usesSourceDestinationParentState:true,service:service,random:random,onFaceCancelled:onFaceCancelled) else{return false}
        retireSourceWildShimmer();sourceWildStateCleared=true;sourceResidualWildPresence=false
        return sourceAlive
    }
    var sourceFinalResultChildrenHidden:Bool {visual.isHidden && shadow.isHidden}
    /// Prefix for the already-bound actual regular destination. A Wild
    /// destination is refused until its genuine retained regular backing is
    /// available; retained metadata must never restart a family idle owner.
    func prepareSourceDirectWildRegularDestination(_ prefix:NativeSourceDirectWildPrefixReceipt,
        service:NativeSourceAnimationClockService,random:@escaping()->Double,
        onFaceCancelled:@escaping()->Void)->Bool {
        guard prefix.preparedDestination.id==tileID,prefix.generation==sourceGeneration,
              prefix.preparedDestination.sourceWildStateCleared,
              prefix.originalDestination.variant==nil,!prefix.originalDestination.isWild,
              sourceMergeSixFaceReady(service:service) else{return false}
        guard prepareSourceMergeSixFace(depth:prefix.preparedDestination.stackDepth,
            final:prefix.isFinal,service:service,random:random,
            onFaceCancelled:onFaceCancelled) else{return false}
        retireSourceWildShimmer();sourceWildStateCleared=true
        if prefix.isFinal {
            // Literal hideFinal suppresses children, never parent visibility.
            // The preceding regular helper's whole-node hide is legacy-only.
            isHidden = !prefix.preparedDestination.visible
            visual.isHidden=true;shadow.isHidden=true
        }
        return sourceAlive
    }

    /// Actual Direct-family backing with registry identity retained. No numbers
    /// decode or synthetic regular skin; selected upload belongs to Scene.
    func sourceWildDestinationFaceReady(service:NativeSourceAnimationClockService)->Bool {
        guard let core=NativeWildArchetype(rawValue:kind) else{return false}
        if let variant,NativeSpecialDiceRegistry.compatibleVariant(variant,core:core)==nil {return false}
        return !disposed && sourceOuterDriven && parent != nil && !locked &&
        (kind == "wild" || kind == "wild-juice" || kind == "wild-tnt" || kind == "wild-magnet") &&
        !sourceWildStateCleared &&
        !sourceResidualWildPresence && sourceWildDestinationFrames==nil && face.texture != nil &&
        service.sourceFrameTransportAdmissionOpen
    }
    func retireSourceWildDestinationFrames() {
        let captured=sourceWildDestinationFrames;sourceWildDestinationFrames=nil
        captured?.dispose()
    }
    func hideSourceWildDestinationFinalChildren() {
        guard !disposed,sourceWildStateCleared else{return}
        depth=1;stack.removeAllChildren();pips.removeAllChildren();pips.isHidden=true
        visual.isHidden=true;shadow.isHidden=true
        sourceSpecialIdle?.retire(self)
    }
    @discardableResult func prepareSourceDirectWildDestination(
        prefix:NativeSourceDirectWildPrefixReceipt,faceReceipt:NativeSourceWildDestinationFaceReceipt,
        preparedStarTexture:SKTexture,service:NativeSourceAnimationClockService,
        random:@escaping()->Double,current:@escaping()->Bool,
        commitPhysical:@escaping()->Bool,onFacePainted:@escaping()->Void,onFaceCancelled:@escaping()->Void)->Bool {
        guard prefix.preparedDestination.id==tileID,prefix.generation==sourceGeneration,
              faceReceipt.transactionID==prefix.id,faceReceipt.beforeFace==prefix.preparedDestination,
              prefix.originalDestination.isWild,
              NativeSourceWildDestinationFaceReceipt.selectedAssetPath(for:prefix.originalDestination)==faceReceipt.assetPath,
              sourceWildDestinationFaceReady(service:service),current(),!disposed else{return false}
        return prepareSourceCapturedWildDestination(original:prefix.originalDestination,prepared:prefix.preparedDestination,
            isFinal:prefix.isFinal,faceReceipt:faceReceipt,preparedStarTexture:preparedStarTexture,service:service,random:random,current:current,commitPhysical:commitPhysical,onFacePainted:onFacePainted,onFaceCancelled:onFaceCancelled)
    }
    @discardableResult func prepareSourceSpecialWildDestination(_ receipt:NativeSourceSpecialWildDestinationFaceReceipt,
        preparedStarTexture:SKTexture,service:NativeSourceAnimationClockService,random:@escaping()->Double,
        current:@escaping()->Bool,commitPhysical:@escaping()->Bool,onFacePainted:@escaping()->Void,onFaceCancelled:@escaping()->Void)->Bool {
        let face=receipt.face
        guard face.beforeFace.id==tileID,face.generation==sourceGeneration,receipt.transactionID==face.transactionID,
            face.originalDestination.isWild,face.beforeFace.sourceWildStateCleared,
            sourceWildDestinationFaceReady(service:service),current() else{return false}
        return prepareSourceCapturedWildDestination(original:face.originalDestination,prepared:face.beforeFace,isFinal:false,
            faceReceipt:face,preparedStarTexture:preparedStarTexture,service:service,random:random,current:current,commitPhysical:commitPhysical,onFacePainted:onFacePainted,onFaceCancelled:onFaceCancelled)
    }
    private func prepareSourceCapturedWildDestination(original:NativeTile,prepared:NativeTile,isFinal:Bool,
        faceReceipt:NativeSourceWildDestinationFaceReceipt,preparedStarTexture:SKTexture,service:NativeSourceAnimationClockService,
        random:@escaping()->Double,current:@escaping()->Bool,commitPhysical:@escaping()->Bool,
        onFacePainted:@escaping()->Void,onFaceCancelled:@escaping()->Void)->Bool {
        // Cleared special uses the default Star geometry, retaining only the
        // registry variant's authored dimensions/pivot (including Magnet final).
        let selectedFace=NativeDiceArtwork.definition(kind:"wild",variant:original.variant)
        let generation=sourceGeneration,capturedParent=parent
        let capturedTexture=face.texture,capturedWidth=face.size.width*face.xScale,capturedHeight=face.size.height*face.yScale
        guard let capturedTexture,capturedParent != nil else{return false}
        // Normalize SpriteKit logical .size into Source raw texture + scale;
        // the same actual Sprite/texture and painted dimensions are retained.
        face.size=capturedTexture.size()
        face.xScale=capturedWidth/max(1,face.size.width);face.yScale=capturedHeight/max(1,face.size.height)
        value=6;depth=prepared.stackDepth;kind="regular";retireSourceWildShimmer();sourceWildStateCleared=true
        sourceResidualWildPresence=false;sourceEventMode="none";alpha=1;isHidden = !prepared.visible
        zPosition=10000
        // Layer installation borrows existing base geometry, not a skin draw.
        sourceRegularFrameParent=parent;sourceRegularFrameGeneration=generation
        weak var capturedOwner:NativeSourceWildDestinationFaceSequence?
        let valid:() -> Bool = { [weak self] in
            guard let self,!self.disposed,self.sourceWildDestinationFrames === capturedOwner,
                  self.sourceGeneration==generation,self.parent === capturedParent else{return false}
            let accepted=current()
            return accepted && !self.disposed && self.sourceWildDestinationFrames === capturedOwner &&
                self.sourceGeneration==generation && self.parent === capturedParent
        }
        let owner=NativeSourceWildDestinationFaceSequence(request:{name,callback,cancelled in
            guard let lease=service.requestSourceAnimationFrame(ownerID:faceReceipt.id+":"+name,
                generation:generation,callback:callback,onCancelled:cancelled) else{return nil}
            return {lease.cancel()}
        },hooks:.init(current:valid,firstFace:{[weak self] in
            guard let self,valid() else{return false}
            guard commitPhysical(),valid() else{onFaceCancelled();return false}
            self.face.texture=preparedStarTexture;self.face.size=preparedStarTexture.size()
            self.face.anchorPoint=selectedFace.anchor
            self.face.xScale=selectedFace.size.width/max(1,self.face.size.width);self.face.yScale=selectedFace.size.height/max(1,self.face.size.height)
            self.face.alpha=1;self.face.isHidden=false;self.artwork.isHidden=true
            self.sourceResidualWildPresence=true;self.depth=1;self.stack.removeAllChildren()
            self.pips.removeAllChildren();self.pips.isHidden=true;self.shadow.isHidden=true
            onFacePainted();return valid()
        },immediateStack:{[weak self] in
            guard let self,valid() else{return false}
            let layout=NativeRegularStackLayout.captureLayers(depth:self.depth,skin:.base,
                baseX:self.sourceBaseX,baseY:self.sourceBaseY,baseScaleX:self.sourceBaseScaleX,
                baseScaleY:self.sourceBaseScaleY,anchorX:self.sourceBaseAnchorX,anchorY:self.sourceBaseAnchorY,random:random)
            guard valid() else{return false}
            self.installSourceStackLayers(layout);return valid()
        },nestedPipsCheck:{[weak self] in
            guard let self,valid(),self.value==6,!self.sourceResidualWildPresence else{return}
            if isFinal {self.hideSourceWildDestinationFinalChildren()}else{self.pips.isHidden=false}
        },hideFinal:{[weak self] in self?.hideSourceWildDestinationFinalChildren()},stopIdle:{[weak self] in
            guard let self,valid() else{return};self.sourceSpecialIdle?.retire(self)
        }))
        capturedOwner=owner;sourceWildDestinationFrames=owner
        let started=owner.start(final:isFinal,deferIdleStop:original.archetype == .star)
        guard started,valid() else {if sourceWildDestinationFrames === owner {retireSourceWildDestinationFrames()};return false}
        return true
    }

    let visual = SKNode()
    private let face = SKSpriteNode()
    private let pips = SKNode()
    private let stack = SKNode()
    private let shadow = SKSpriteNode()
    private let sourceShadowContainer=SKNode()
    private var sourceShadowOwner:NativeDragShadowPresentationOwner?
    var sourceMergeSixCleanupToken:UInt64?
    var sourceMergeSixLastMerge=false
    var sourceMergeSixFinalAllowedByResolver=false
    var sourceNonFinalMergeSix=false
    var sourceNonFinalMergeSixAt:Double?
    var sourceContactNodeAlive:Bool {!disposed}
    // Actual Source selected-locked-slot writer. The app-spawn wrapper never
    // creates _spawnTween/_isBeingSpawned; an action/lease is not a marker.
    private var sourceLockedSpawnMarkers:Set<String>=[]
    var sourceIsBeingSpawned:Bool {!sourceLockedSpawnMarkers.isEmpty}
    // Only actual Source constructors establish absence of the legacy spawn
    // aliases. A generic Native node/action cannot declare missing fields false.
    struct SourceConstructorMarkerAbsence {
        let pendingRemoval,beingRemoved,cleanupQueued:Bool
        let ccSpawnAnimating,spawnAnimating,isSpawning,spawnTweenActive:Bool
    }
    private var sourceConstructorMarkerAbsence:SourceConstructorMarkerAbsence?
    func captureSourceConstructorMarkerAbsence()->SourceConstructorMarkerAbsence? {
        guard sourcePhysicalMarkersCovered,parent != nil else{return nil}
        return sourceConstructorMarkerAbsence
    }
    private var sourceMarkerCoverageGeneration:UInt64?
    var sourcePhysicalMarkersCovered:Bool {
        !disposed && sourceMarkerCoverageGeneration==sourceGeneration && sourceOuterDriven
    }
    func beginSourceLockedSpawnMarker(id:String)->Bool {
        guard sourcePhysicalMarkersCovered,!isSpecial,locked,value==0,parent != nil else{return false}
        return sourceLockedSpawnMarkers.insert(id).inserted
    }
    func clearSourceLockedSpawnMarker(id:String){sourceLockedSpawnMarkers.remove(id)}
    /// Save-only borrow. These are genuine Node/Core-owned marker fields;
    /// caller still requires a covered Source roster and global-owner capture.
    /// This does NOT mount the two global marker capabilities on its own.
    func captureSourceSaveTileMarkers(model:NativeTile,runtime:NativeNoMovesTileRuntime?)->NativeSourceSaveTileMarkers? {
        guard sourcePhysicalMarkersCovered,parent != nil,tileID==model.id else{return nil}
        var markers=NativeSourceSaveTileMarkers()
        markers.destroyed=runtime?.destroyed==true
        markers.wildSpawnDropping=runtime?.wildDropping==true
        markers.wildSpawnHandoffLock=runtime?.wildHandoff==true
        markers.isBeingSpawned = !sourceLockedSpawnMarkers.isEmpty
        markers.pendingRemoval=model.pendingRemoval
        markers.beingRemoved=runtime?.beingRemoved==true;markers.cleanupQueued=runtime?.cleanupQueued==true
        // Literal app-spawn / actual Source constructor and locked-open paths
        // do not assign the three aliases or _spawnTween. NativeSource physical
        // roster admission must not include unmapped animateTileSpawn/drag-anim.
        markers.ccSpawnAnimating=false;markers.spawnAnimating=false;markers.isSpawning=false;markers.hasSpawnTween=false
        return markers
    }
    /// Same retained object, actual immediate value/input/painted fields. Core
    /// metadata below is read from its actual lifecycle writers, never inferred
    /// from pendingSpecial/pendingDirectWild/animation lifetime.
    func captureSourceMagnetPhysical(model:NativeTile,runtime:NativeNoMovesTileRuntime?,lastMerge:Bool)->NativeSourceMagnetPhysicalTile? {
        guard sourcePhysicalMarkersCovered,parent != nil,tileID==model.id else{return nil}
        let archetype:NativeSourceMagnetPhysicalTile.Kind
        switch sourceResidualWildPresence ? "wild":(sourceWildStateCleared ? "regular":kind) {
        case "regular":archetype = .regular
        case "wild":archetype = .star
        case "wild-juice":archetype = .juice
        case "wild-magnet":archetype = .magnet
        case "wild-tnt":archetype = .tnt
        default:return nil
        }
        return .init(id:tileID,value:value,depth:depth,locked:locked,visible:!isHidden,
            alpha:Double(alpha),eventMode:sourceEventMode,kind:archetype,
            destroyed:runtime?.destroyed==true,magnetAffected:model.magnetOwned,
            pendingRemoval:model.pendingRemoval,beingRemoved:runtime?.beingRemoved==true,
            cleanupQueued:runtime?.cleanupQueued==true,wildHandoff:runtime?.wildHandoff==true,
            isBeingSpawned:!sourceLockedSpawnMarkers.isEmpty,spawnTweenActive:nil,lastMerge:lastMerge)
    }
    private var sourceMagnetPullNodeToken:UUID?
    var sourceMagnetPullProtected:Bool {sourceMagnetPullNodeToken != nil}
    @discardableResult func protectSourceMagnetPull(token:UUID,generation:UInt64,current:()->Bool)->Bool {
        guard sourcePhysicalMarkersCovered,sourceGeneration==generation,sourceMagnetPullNodeToken==nil,parent != nil else{return false}
        sourceMagnetPullNodeToken=token // seal identity BEFORE actual idle stop callbacks.
        locked=true;sourceEventMode="none";sourceSkipIdleScaleReset=true
        sourceSpecialIdle?.retire(self)
        guard !disposed,sourceMagnetPullNodeToken==token,sourceGeneration==generation else{return false}
        let accepted=current()
        return accepted && !disposed && sourceMagnetPullNodeToken==token && sourceGeneration==generation
    }
    @discardableResult func prepareSourceMagnetPullScale(token:UUID,generation:UInt64)->Bool {
        guard !disposed,sourceMagnetPullNodeToken==token,sourceGeneration==generation else{return false}
        // Literal pull child creation kills SCALE tweens only. Its ordinary
        // idle rotation/callback root is not replaced by a generic interrupt.
        killSourceActiveScaleChildren()
        return !disposed && sourceMagnetPullNodeToken==token && sourceGeneration==generation
    }
    @discardableResult func releaseSourceMagnetPull(token:UUID,generation:UInt64,restore:Bool)->Bool {
        guard !disposed,sourceMagnetPullNodeToken==token,sourceGeneration==generation else{return false}
        sourceMagnetPullNodeToken=nil;sourceSkipIdleScaleReset=false
        if restore {locked=false;sourceEventMode="static"}
        return true
    }
    var sourceContactLastStackLayer:SKNode? {stack.children.last}
    func sourceKillInnerContactTweens(){sourceShadowOwner?.cancelInnerTiltReturn()}
    var sourceEventMode="static"
    private var sourceWildSkinRevision:UInt64=0
    private var sourceWildSkinFaceHeight:CGFloat=128
    private var sourceBeeFrames:(id:UUID,generation:UInt64,handles:[NativeBoardTextures.SourceTextureHandle])?
    private struct SourceBeeHostPose {
        var position:CGPoint,rotation:CGFloat,x:CGFloat,y:CGFloat
        func matches(_ other:Self)->Bool {
            abs(position.x-other.position.x)<0.000001 && abs(position.y-other.position.y)<0.000001 &&
            abs(rotation-other.rotation)<0.000001 && abs(x-other.x)<0.000001 && abs(y-other.y)<0.000001
        }
        var settled:Bool {
            let a=abs(x),b=abs(y),largest=max(a,b)
            return x.isFinite && y.isFinite && largest>=0.01 && abs(a-b)/largest<=0.05
        }
    }
    private struct SourceBeeHostMotion {
        var original:SourceBeeHostPose,lastPaint:SourceBeeHostPose?,settled:Bool
    }
    private var sourceBeeHostMotion:SourceBeeHostMotion?
    private var sourceBeeOriginalSkin:(generation:UInt64,kind:String,variant:String?,handle:NativeBoardTextures.SourceTextureHandle)?
    private var sourceBeeOriginalFacing:CGFloat=1

    private var sourceBeeHostPose:SourceBeeHostPose {
        .init(position:sourceInnerPosition,rotation:dragInnerTilt,x:visual.xScale,y:visual.yScale)
    }
    private func paintSourceBeeHostPose(_ pose:SourceBeeHostPose) {
        dragInnerTilt=pose.rotation;sourceInnerPosition=pose.position
        visual.xScale=pose.x;visual.yScale=pose.y
    }
    private func retireSourceBeeHostMotion(restoring:Bool) {
        let captured=sourceBeeHostMotion,originalSkin=sourceBeeOriginalSkin
        sourceBeeHostMotion=nil;sourceBeeOriginalSkin=nil
        guard restoring else{return}
        if let originalSkin,originalSkin.generation==sourceGeneration,originalSkin.kind==kind,originalSkin.variant==variant,
           textures.isSourceTextureHandleCurrent(originalSkin.handle),
           sourceBeeFrames?.handles.contains(where:{$0.texture === face.texture})==true {
            face.texture=originalSkin.handle.texture;face.xScale=sourceBeeOriginalFacing
            sourceWildSkinTexture=originalSkin
        }
        guard let captured,let last=captured.lastPaint,last.matches(sourceBeeHostPose) else{return}
        paintSourceBeeHostPose(captured.original)
    }
    private func paintSourceBeeHostMotion(seconds:TimeInterval) {
        guard var motion=sourceBeeHostMotion,!dragging else{return}
        let current=sourceBeeHostPose
        if !motion.settled {
            guard current.settled else{return}
            motion.original=current;motion.lastPaint=current;motion.settled=true
        }
        if let last=motion.lastPaint {
            // A new transform writer owns its new pose; do not overwrite it.
            guard last.matches(current) else{sourceBeeHostMotion=nil;return}
        } else {
            // Drag released our channels. Resume only once the captured
            // neutral pose is actually back, not while snapback still paints.
            guard motion.original.matches(current) else{return}
        }
        let t=max(0,seconds),scale=1+sin(t * .pi * 2.6 + .pi * 0.6)*0.018
        let pose=SourceBeeHostPose(position:CGPoint(x:motion.original.position.x+sin(t * .pi * 1.7)*2.8,
            y:motion.original.position.y-sin(t * .pi * 2.3 + .pi * 0.35)*5),
            rotation:motion.original.rotation+sin(t * .pi * 1.9 + .pi * 0.2)*0.025,
            x:motion.original.x*scale,y:motion.original.y*scale)
        paintSourceBeeHostPose(pose);motion.lastPaint=sourceBeeHostPose;sourceBeeHostMotion=motion
    }

    private var sourceWildShimmerID:UUID?
    private var sourceWildShimmer:(clock:NativeSourceWildShimmerClock,renderer:NativeSourceWildShimmerRenderer)?
    var sourceWildShimmerRootCount:Int {sourceWildShimmer?.clock.activeRootCount ?? 0}
    var sourceWildShimmerSprite:SKSpriteNode? {sourceWildShimmer?.renderer.sprite}
    @discardableResult func beginSourceWildShimmer(service:NativeSourceAnimationClockService,
        random:@escaping()->Double,current:@escaping()->Bool,canvasPaintable:Bool=true)->Bool {
        guard !disposed,!sourceIdleDeferred,!sourceWildStateCleared,sourceOuterDriven,parent != nil,
              NativeWildArchetype(rawValue:kind) != nil else{return false}
        // The exact plain Star SVG owns its own gloss; no duplicate Pixi shimmer.
        if kind=="wild",variant==nil {retireSourceWildShimmer();return true}
        guard let texture=face.texture,let requested=NativeDiceArtwork.sourceWildSkinDefinition(kind:kind,variant:variant) else{return false}
        let beeFrameCurrent=sourceBeeFrames?.handles.contains{textures.isSourceTextureHandleCurrent($0) && $0.texture === texture} == true
        let restoredFaceCurrent=sourceRestoredWildConstructorCurrent && !sourceRestoreWildFacePending &&
            textures.sourceCachedTexture(candidates:[requested.path]) === texture
        guard sourceWildSkinReceiptCurrent || restoredFaceCurrent || sourceOpenedWildFaceCurrent || beeFrameCurrent else{return false}
        retireSourceWildShimmer()
        let id=UUID(),generation=sourceGeneration,revision=sourceBindingRevision,skinRevision=sourceWildSkinRevision
        weak var capturedParent:SKNode?=parent
        weak var capturedNode:NativeDiceNode?=self
        func valid()->Bool {
            guard let node=capturedNode,!node.disposed,node.sourceWildShimmerID==id,node.sourceGeneration==generation,
                  node.sourceBindingRevision==revision,node.sourceWildSkinRevision==skinRevision,
                  !node.sourceWildStateCleared,!node.sourceIdleDeferred,
                  let capturedParent,node.parent === capturedParent else{return false}
            if let renderer=node.sourceWildShimmer?.renderer,!renderer.current {return false}
            let accepted=current()
            return accepted && !node.disposed && node.sourceWildShimmerID==id && node.sourceGeneration==generation &&
                node.sourceBindingRevision==revision && node.sourceWildSkinRevision==skinRevision && !node.sourceWildStateCleared &&
                !node.sourceIdleDeferred && node.parent === capturedParent
        }
        sourceWildShimmerID=id
        guard valid() else{sourceWildShimmerID=nil;return false}
        // Source base.width includes its scale, not rotated bounding-box width.
        let size=CGSize(width:face.size.width*abs(face.xScale),height:face.size.height*abs(face.yScale))
        guard let pixels=textures.sourceRasterPixelSize(for:texture),let logicalMaskWidth=textures.sourceRasterLogicalWidth(for:texture),
              let renderer=NativeSourceWildShimmerRenderer(texture:texture,size:size,anchor:face.anchorPoint,pixelSize:pixels,logicalMaskWidth:logicalMaskWidth,
            cache:textures.sourceWildShimmerGradients) else{sourceWildShimmerID=nil;return false}
        renderer.mount(in:visual,position:face.position,rotation:face.zRotation,zPosition:face.zPosition+1)
        let clock=NativeSourceWildShimmerClock(service:service,width:Double(size.width),height:Double(size.height),
            current:{[weak self] in
                guard let self else{return false}
                let accepted=valid();if !accepted{self.retireSourceWildShimmer()};return accepted
            },random:random,
            paint:{[weak self,weak renderer] pose in
                guard let self,valid(),let renderer else{return};renderer.paint(pose);self.onResourceReady?()
            })
        sourceWildShimmer=(clock,renderer)
        clock.setVisible(sourceShimmerHostPaintable(canvasPaintable:canvasPaintable))
        guard valid(),clock.start(),valid() else{retireSourceWildShimmer();return false}
        onResourceReady?();return true
    }
    private func sourceShimmerHostPaintable(canvasPaintable:Bool)->Bool {
        sourceIdleHostPaintable(canvasPaintable:canvasPaintable)
    }
    func reconcileSourceWildShimmerVisibility(canvasPaintable:Bool){
        sourceWildShimmer?.clock.setVisible(sourceShimmerHostPaintable(canvasPaintable:canvasPaintable))
    }
    func setSourceWildShimmerVisible(_ visible:Bool){sourceWildShimmer?.clock.setVisible(visible)}
    func retireSourceWildShimmer(){
        sourceWildShimmerID=nil
        let captured=sourceWildShimmer;sourceWildShimmer=nil
        captured?.clock.dispose();captured?.renderer.dispose()
    }

    private var sourceSkinHitArea:(id:UUID,generation:UInt64,rect:CGRect)?
    private var sourceWildSkinTexture:(generation:UInt64,kind:String,variant:String?,handle:NativeBoardTextures.SourceTextureHandle)?
    var sourceWildSkinReceiptCurrent:Bool {
        guard !disposed,let receipt=sourceWildSkinTexture,receipt.generation==sourceGeneration,
              receipt.kind==kind,receipt.variant==variant,!sourceWildStateCleared else{return false}
        return face.texture === receipt.handle.texture && textures.isSourceTextureHandleCurrent(receipt.handle)
    }
    var sourceWildSkinAssetPath:String? {sourceWildSkinReceiptCurrent ? sourceWildSkinTexture?.handle.assetPath:nil}
    var hasSourceSkinHitArea:Bool {sourceSkinHitArea != nil || (sourceRestoredWildConstructorCurrent && sourceRestoredWildFaceHit != nil) || (sourceOpenedWildConstructorCurrent && sourceOpenedWildFaceHit != nil)}
    func containsSourceSkinInput(_ point:CGPoint,in canvas:SKNode,generation:UInt64)->Bool {
        guard !disposed,!isHidden,sourceGeneration==generation,sourceOuterDriven,sourceEventMode=="static",
              parent === canvas else{return false}
        if let hit=sourceSkinHitArea,hit.generation==generation {return hit.rect.contains(convert(point,from:canvas))}
        guard let hit=sourceRestoredWildConstructorCurrent ? sourceRestoredWildFaceHit : (sourceOpenedWildConstructorCurrent ? sourceOpenedWildFaceHit : nil) else{return false}
        return hit.contains(convert(point,from:canvas))
    }
    /// Source synchronous hit/pips/shadow prefix plus generation-owned texture
    /// reaction. Caller supplies the exact authored conditional idle owner.
    /// APP safety repair borrows an already admitted skin. It paints the
    /// current face without running the constructor's idle-start protocol.
    /// In particular a suspended/dragged idle remains owned and unchanged.
    @discardableResult func repairSourceWildSkinPaint(generation:UInt64,current:()->Bool)->Bool {
        guard !disposed,parent != nil,sourceOuterDriven,sourceGeneration==generation,
              isSpecial,!sourceWildStateCleared,
              let paintedReceipt=sourceWildSkinTexture,let hit=sourceSkinHitArea,hit.generation==generation,
              paintedReceipt.generation==generation,paintedReceipt.kind==kind,paintedReceipt.variant==variant,
              textures.isSourceTextureHandleCurrent(paintedReceipt.handle),
              let definition=NativeDiceArtwork.sourceWildSkinDefinition(kind:kind,variant:variant) else{return false}
        // Bee's admitted idle writer publishes its actual current frame receipt.
        // v9 repairBoardTileVisuals restores the registry's static face, using
        // the original skin retained by that same live animation cohort.
        let receipt:(generation:UInt64,kind:String,variant:String?,handle:NativeBoardTextures.SourceTextureHandle)
        let beeCohortID:UUID?
        if paintedReceipt.handle.assetPath==definition.path {
            receipt=paintedReceipt;beeCohortID=nil
        } else {
            guard variant=="bee",let cohort=sourceBeeFrames,cohort.generation==generation,
                  cohort.handles.contains(where:{$0.texture === paintedReceipt.handle.texture && $0.assetPath==paintedReceipt.handle.assetPath}),
                  let original=sourceBeeOriginalSkin,original.generation==generation,
                  original.kind==kind,original.variant==variant,original.handle.assetPath==definition.path,
                  textures.isSourceTextureHandleCurrent(original.handle) else{return false}
            receipt=original;beeCohortID=cohort.id
        }
        var expectedReceipt=paintedReceipt
        let capturedParent=parent,revision=sourceBindingRevision,skinRevision=sourceWildSkinRevision
        func cohortCurrent()->Bool {
            guard let beeCohortID else{return true}
            return sourceBeeFrames?.id==beeCohortID && sourceBeeFrames?.generation==generation &&
                sourceBeeOriginalSkin?.handle.texture === receipt.handle.texture &&
                sourceBeeOriginalSkin?.handle.assetPath==receipt.handle.assetPath &&
                sourceBeeFrames?.handles.contains(where:{$0.texture === paintedReceipt.handle.texture && textures.isSourceTextureHandleCurrent($0)})==true
        }
        func valid()->Bool {
            guard !disposed,parent === capturedParent,sourceGeneration==generation,
                  sourceBindingRevision==revision,sourceWildSkinRevision==skinRevision,
                  sourceSkinHitArea?.id==hit.id,!sourceWildStateCleared,
                  kind==receipt.kind,variant==receipt.variant,textures.isSourceTextureHandleCurrent(receipt.handle),
                  sourceWildSkinTexture?.handle.texture === expectedReceipt.handle.texture && cohortCurrent() else{return false}
            let accepted=current()
            return accepted && !disposed && parent === capturedParent && sourceGeneration==generation &&
                sourceBindingRevision==revision && sourceWildSkinRevision==skinRevision &&
                sourceSkinHitArea?.id==hit.id && !sourceWildStateCleared &&
                kind==receipt.kind && variant==receipt.variant && textures.isSourceTextureHandleCurrent(receipt.handle) &&
                sourceWildSkinTexture?.handle.texture === expectedReceipt.handle.texture && cohortCurrent()
        }
        guard valid() else{return false}
        let anchor=variant=="bottle" || variant=="kanta" ? face.anchorPoint:definition.anchor
        guard anchor.x.isFinite,anchor.y.isFinite else{return false}
        // Pixi's width/height setters retain the current facing sign (zero
        // becomes positive). Normalize the SpriteKit size at unit magnitude,
        // then restore those actual signs without carrying idle squash.
        let facing=CGPoint(x:face.xScale<0 ? -1:1,y:face.yScale<0 ? -1:1)
        alpha=1;visual.alpha=1;face.alpha=1;face.isHidden=false;pips.alpha=1
        face.texture=receipt.handle.texture;face.setScale(1);face.size=definition.size
        face.xScale=facing.x;face.yScale=facing.y
        face.anchorPoint=anchor;face.colorBlendFactor=0
        sourceWildSkinFaceHeight=definition.size.height
        sourceWildSkinTexture=receipt;expectedReceipt=receipt
        sourceStarSheet?.baseFacePainted()
        paintFishVisibility()
        if kind=="wild-juice",variant==nil {paintArtwork()}
        return valid()
    }
    @discardableResult func repairSourceWildSkin(generation:UInt64,assetTasks:NativeSourceMicrotaskAdapters,
        reactionScope:NativeSourceMicrotaskFIFO.Scope,current:@escaping()->Bool,
        startSourceIdle:()->Bool,startSourceShimmer:(()->Bool)?=nil,startSourceIdleBubbles:(()->NativeIdleBubbleField?)?=nil,currentSourceFaceAnchor:(()->CGPoint?)?=nil,completion:@escaping(Bool)->Void)->Bool {
        guard !disposed,parent != nil,sourceOuterDriven,sourceGeneration==generation,
              isSpecial,!sourceWildStateCleared,NativeWildArchetype(rawValue:kind) != nil,
              reactionScope.isBound(to:assetTasks.fifo),reactionScope.admissionOpen else{return false}
        let capturedParent=parent,capturedKind=kind,capturedVariant=variant,revision=sourceBindingRevision,skinRevision=sourceWildSkinRevision
        guard let requested=NativeDiceArtwork.sourceWildSkinDefinition(kind:kind,variant:variant) else{return false}
        let requestedPath=requested.path
        let dynamicAnchor=variant=="bottle" || variant=="kanta"
        guard sourceIdleDeferred || !dynamicAnchor || currentSourceFaceAnchor != nil else{return false}
        var admitted=true;let hitID=UUID()
        var startedBubbles:NativeIdleBubbleField?,startedShimmer:UUID?,startedMagnetCue:UUID?
        func valid()->Bool {
            guard admitted,!disposed,sourceGeneration==generation,parent === capturedParent,sourceBindingRevision==revision,sourceWildSkinRevision==skinRevision,
                  kind==capturedKind,variant==capturedVariant,!sourceWildStateCleared else{return false}
            let accepted=current()
            return accepted && admitted && !disposed && sourceGeneration==generation && parent === capturedParent &&
                sourceBindingRevision==revision && sourceWildSkinRevision==skinRevision && kind==capturedKind && variant==capturedVariant && !sourceWildStateCleared
        }
        guard valid() else{return false}
        let side:CGFloat=kind=="wild-magnet" ? 128*1.10:128
        sourceSkinHitArea=(hitID,generation,CGRect(x:-side/2,y:-side/2,width:side,height:side))
        sourceWildSkinFaceHeight=requested.size.height
        if kind=="wild-magnet" {sourceEventMode="static"}
        pips.isHidden=true;pips.removeAllChildren();shadow.isHidden=true
        let accepted=textures.prepareSourceSpecialTexture(assetPath:requestedPath,assetTasks:assetTasks,
            reactionScope:reactionScope,current:valid) {[weak self] handle in
                guard let self,valid() else{return}
                guard let handle,handle.assetPath==requestedPath,self.textures.isSourceTextureHandleCurrent(handle) else{completion(false);return}
                let anchor:CGPoint
                if dynamicAnchor,!self.sourceIdleDeferred {
                    guard let reader=currentSourceFaceAnchor,let live=reader(),valid(),live.x.isFinite,live.y.isFinite else{completion(false);return}
                    anchor=live // actual live idle owner, captured at texture paint, not request
                } else {anchor=requested.anchor}
                // Normalize before size: repeated async skin receipts must not
                // compound SpriteKit's existing scale into the next face size.
                self.face.texture=handle.texture;self.face.setScale(1);self.face.size=requested.size
                // SpriteKit's logical size is independent of texture pixels.
                // Keep authored idle/drag flips relative to that logical face;
                // xScale=±1 must never expose the full @2x raster dimensions.
                self.face.anchorPoint=anchor;self.face.alpha=1;self.face.isHidden=false
                self.paintFishVisibility()
                if self.kind=="wild-juice",self.variant==nil {self.paintArtwork()}
                self.face.colorBlendFactor=0
                self.sourceWildSkinTexture=(generation,capturedKind,capturedVariant,handle)
                self.sourceStarSheet?.baseFacePainted()
                if capturedVariant=="bee",self.sourceBeeOriginalSkin==nil,
                   self.sourceBeeFrames?.handles.isEmpty==true {
                    // Idle can begin in the synchronous skin prefix before the
                    // static upload settles. Capture this genuine static receipt
                    // while the frame cohort is still pending, never fabricate
                    // an original handle from the Raw constructor cache.
                    self.sourceBeeOriginalSkin=self.sourceWildSkinTexture
                    self.sourceBeeOriginalFacing=self.face.xScale
                }
                self.onResourceReady?()
                guard valid() else{return}
                completion(self.textures.isSourceTextureHandleCurrent(handle))
            }
        func reject()->Bool {
            admitted=false
            if let startedMagnetCue {cancelSourceMagnetFizzRAF(cue:startedMagnetCue)}
            if let startedBubbles,idleFizz === startedBubbles {idleFizz=nil;startedBubbles.dispose()}
            if let startedShimmer,sourceWildShimmerID==startedShimmer {retireSourceWildShimmer()}
            if sourceSkinHitArea?.id==hitID {sourceSkinHitArea=nil}
            return false
        }
        guard accepted,valid() else{return reject()}
        if !sourceIdleDeferred {
            if let startSourceShimmer {
                let previous=sourceWildShimmerID,accepted=startSourceShimmer()
                if sourceSkinHitArea?.id==hitID,sourceWildShimmerID != previous {startedShimmer=sourceWildShimmerID}
                guard accepted,valid() else{return reject()}
            }
            if let startSourceIdleBubbles {
                startedBubbles=startSourceIdleBubbles()
                if let startedBubbles,idleFizz === startedBubbles {startedMagnetCue=sourceIdleBubbleStartID}
                guard startedBubbles != nil,valid() else{return reject()}
            }
            let idle=startSourceIdle()
            guard idle,valid() else{return reject()}
        }
        return true
    }
    /// Actual mobile Bee Promise.allSettled cohort. No Raw frame cache may
    /// replace a Source-owned face; missing frames keep authored order and a
    /// minimum of two valid uploaded receipts is required before playback.
    @discardableResult func prepareSourceBeeIdleFrames(generation:UInt64,
        assetTasks:NativeSourceMicrotaskAdapters,reactionScope:NativeSourceMicrotaskFIFO.Scope,
        current:@escaping()->Bool,completion:@escaping(Bool)->Void)->Bool {
        guard !disposed,!sourceIdleDeferred,variant=="bee",kind=="wild",sourceOuterDriven,
              sourceGeneration==generation,sourceSkinHitArea != nil,
              reactionScope.isBound(to:assetTasks.fifo),reactionScope.admissionOpen else{return false}
        let capturedParent=parent,revision=sourceBindingRevision,skinRevision=sourceWildSkinRevision,id=UUID()
        func live()->Bool {
            guard !disposed,parent === capturedParent,sourceGeneration==generation,
                  sourceBindingRevision==revision,sourceWildSkinRevision==skinRevision,
                  !sourceIdleDeferred,!sourceWildStateCleared,variant=="bee",kind=="wild",sourceSkinHitArea != nil else{return false}
            let accepted=current()
            return accepted && !disposed && parent === capturedParent && sourceGeneration==generation &&
                sourceBindingRevision==revision && sourceWildSkinRevision==skinRevision &&
                !sourceIdleDeferred && !sourceWildStateCleared && variant=="bee" && kind=="wild" &&
                sourceSkinHitArea != nil && reactionScope.isBound(to:assetTasks.fifo)
        }
        guard live() else{return false}
        retireSourceBeeHostMotion(restoring:true)
        let original=sourceBeeHostPose
        sourceBeeOriginalSkin=sourceWildSkinReceiptCurrent ? sourceWildSkinTexture:nil
        sourceBeeOriginalFacing=face.xScale
        sourceBeeHostMotion = .init(original:original,lastPaint:original,settled:original.settled)
        sourceBeeFrames=(id,generation,[])
        var settled=Array(repeating:false,count:4),results=[NativeBoardTextures.SourceTextureHandle?](repeating:nil,count:4)
        func settle(_ index:Int,_ handle:NativeBoardTextures.SourceTextureHandle?) {
            guard live(),sourceBeeFrames?.id==id,!settled[index] else{return}
            settled[index]=true;results[index]=handle
            guard settled.allSatisfy({$0}) else{return}
            let handles=results.compactMap{$0}.filter{textures.isSourceTextureHandleCurrent($0)}
            guard handles.count>=2 else{sourceBeeFrames=nil;retireSourceBeeHostMotion(restoring:true);completion(false);return}
            sourceBeeFrames=(id,generation,handles);elapsed=0;paintedFrame = -1
            onResourceReady?()
            guard live(),sourceBeeFrames?.id==id else{return}
            completion(true)
        }
        var accepted=true
        for index in 0..<4 {
            let path="assets/shop/bee/bee\(index+1)@2x.png"
            let item=textures.prepareSourceSpecialTexture(assetPath:path,assetTasks:assetTasks,reactionScope:reactionScope,
                current:{live() && self.sourceBeeFrames?.id==id}) {handle in settle(index,handle)}
            if !item {accepted=false;settle(index,nil)}
        }
        return accepted
    }

    private let artwork = SKSpriteNode()
    private let flowerCanvas = SKNode()
    private let flowerRoot = SKNode()
    private let flowerScale = SKNode()
    private let flowerRotation = SKNode()
    private let flowerArt = SKSpriteNode()
    private var kantaIdle: NativeKantaDiceIdle?
    private var mushroomSmoke:NativeMushroomDiceSmoke?
    private var spaceshipEngine:NativeSpaceshipDiceIdle?
    private var honeyIdle:NativeHoneyDiceIdle?
    private var sourceHoneyIdle:NativeSourceHoneyIdlePresentation?
    private var sourceHoneyAdmissionID:UUID?,sourceHoneyOwnerID:UUID?
    private var sourceHoneyPaintable:(()->Bool)?
    private var sourceHoneyPreparing=false
    var hasSourceHoneyIdle:Bool{sourceHoneyIdle != nil}
    var sourceHoneySprites:[SKSpriteNode]{sourceHoneyIdle?.sprites ?? []}
    var sourceHoneyCohortCommitted:Bool{sourceHoneyIdle?.cohortCommitted==true}
    private(set) var sourceIdleDeferred:Bool
    private var fishMediaReady=false
    private var idleFizz:NativeIdleBubbleField?
    private let spaceshipRoot=SKNode()
    private let textures: NativeBoardTextures
    private var definition: NativeDiceArtwork
    private var frames: [SKTexture] = []
    private var paintedFrame = -1
    private var artworkGeneration = 0
    private var disposed = false
    private var cuberoElapsed:TimeInterval = 0
    private var sourceBottleIdle:NativeSourceBottleIdlePresentation?
    private var sourceBottlePreservingBase=false
    var hasSourceBottleIdle:Bool {sourceBottleIdle != nil}
    private var sourceBottleAdmissionID:UUID?,sourceBottleOwnerID:UUID?
    private var sourceBottlePaintable:(()->Bool)?
    private var bottleElapsed:TimeInterval = 0
    private var spaceshipElapsed:TimeInterval = 0
    private var elapsed: TimeInterval = 0
    private var dragging = false
    private var sourceRegistryPending=false,sourceRegistryPaused=false
    private weak var sourceSpecialIdle:NativeSourceSpecialIdleScope?
    private var artworkPhaseID:Int?
    private var artworkRunning=false,artworkElapsed:TimeInterval=0
    // PRIVATE injected outer owner: no Source driver creation here.
    private var sourceOuterBridge:NativeTileOuterNodeBridge?
    private var sourceOuterBindingID:UUID?,sourceBindingRevision:UInt64=0
    private var sourceNativeGeometryScale:CGFloat=1
    var sourceGeometryScale:CGFloat {sourceNativeGeometryScale}
    private(set) var sourceGeneration:UInt64=0
    /// Source c/r belong to the actual holder, independently of its painted pose.
    /// Only constructor/placement writers publish this identity; absent is unknown.
    private(set) var sourceGridCell:NativeCell?
    @discardableResult func bindSourceGridCell(_ cell:NativeCell,generation:UInt64)->Bool {
        guard !disposed,parent != nil,sourceGeneration==generation,
              sourceMarkerCoverageGeneration==generation,sourceGridCell != nil else{return false}
        sourceGridCell=cell
        return true
    }
    var sourceSkipIdleScaleReset=false
    var sourceTileID:String {tileID}
    var sourceLocalScale:CGPoint {CGPoint(x:xScale/sourceNativeGeometryScale,y:yScale/sourceNativeGeometryScale)}
    var sourceLocalPosition:CGPoint {position}
    var sourceRotation:CGFloat {-zRotation}
    var sourceOuterDriven:Bool {sourceOuterBridge != nil}
    var sourceOuterReceipt:NativeTileOuterReceipt? {sourceOuterBridge?.receipt}
    var sourceOuterOwners:NativeTileOuterEligibility.Owners {sourceOuterBridge?.owners ?? .init()}
    var sourceIdleTimelinePresent:Bool {sourceOuterBridge?.idleTimelinePresent == true}
    var sourceActiveIdle:Bool {sourceOuterBridge?.activeIdle==true}
    func beginSourceMergeImpact(_ motion:NativeMergeImpactMotion)->Bool {sourceOuterBridge?.mergeImpact(motion) ?? false}
    func killSourceActiveScaleChildren(){sourceOuterBridge?.killActiveScaleChildren()}
    func paintSourceIdleRotation(_ rotation:CGFloat){guard !disposed else{return};zRotation = -rotation}
    func paintSourceOuterPositionRotation(_ pose:NativeTileOuterMotion.Pose){guard !disposed else{return};position=pose.position;zRotation = -pose.rotation}
    func installSourceOuterDriver(_ driver:NativeTileOuterTimelineDriver,generation:UInt64,geometryScale:CGFloat) {
        guard !disposed else{return}
        if sourceGeneration != generation {
            sourceGridCell=nil
            retireSourceStarHalo()
            let outer=sourceOuterBridge,shadow=sourceShadowOwner
            sourceOuterBridge=nil;sourceShadowOwner=nil;sourceOuterBindingID=nil;sourceBindingRevision &+= 1
            let retiredRevision=sourceBindingRevision
            outer?.dispose();shadow?.dispose()
            guard !disposed,sourceBindingRevision==retiredRevision,sourceOuterBridge==nil,sourceShadowOwner==nil else{return}
        }
        let local=sourceOuterBridge == nil ? CGPoint(x:1,y:1):sourceLocalScale
        sourceGeneration=generation;sourceNativeGeometryScale=geometryScale;paintSourceOuterScale(local)
        if sourceOuterBridge==nil {
            let bindingID=UUID();sourceOuterBindingID=bindingID;sourceBindingRevision &+= 1
            sourceOuterBridge=NativeTileOuterNodeBridge(host:self,driver:driver,canonicalBase:CGPoint(x:1,y:1),bindingCurrent:{[weak self] in self?.disposed==false && self?.sourceOuterBindingID==bindingID})
        }
    }
    func retireSourceAnimationBindingsPreservingPaint() {
        retireSourceHoneyIdle()
        retireSourceOpenedWildFrame()
        retireSourceWildShimmer()
        retireSourceBeeHostMotion(restoring:false)
        sourceRestoredWildIdentity=nil;sourceRestoredWildDropMarkers=nil;sourceRestoredWildParent=nil;sourceRestoredWildFaceHit=nil
        sourceSkinHitArea=nil;sourceWildSkinTexture=nil;sourceBeeFrames=nil
        guard !disposed,sourceOuterBridge != nil || sourceShadowOwner != nil || sourceRegularFrameBinding != nil || sourceWildDestinationFrames != nil || sourceRestoreEmptyFaceFrame != nil || sourceRestoreWildFaceFrame != nil else{return}
        retireSourceStackFrames()
        guard !disposed else{return}
        let generation=sourceGeneration,parent=self.parent,position=self.position,x=xScale,y=yScale,rotation=zRotation,innerPosition=visual.position,innerRotation=visual.zRotation
        let outer=sourceOuterBridge,shadowOwner=sourceShadowOwner
        sourceOuterBridge=nil;sourceShadowOwner=nil;sourceOuterBindingID=nil;sourceBindingRevision &+= 1 // unhook before captured callbacks
        let retiredRevision=sourceBindingRevision
        outer?.dispose();shadowOwner?.dispose()
        guard !disposed,sourceGeneration==generation,self.parent === parent,sourceBindingRevision==retiredRevision,sourceOuterBridge==nil,sourceShadowOwner==nil else{return}
        self.position=position;xScale=x;yScale=y;zRotation=rotation;visual.position=innerPosition;visual.zRotation=innerRotation
    }
    func synchronizeSourceGeometry(_ scale:CGFloat) {
        guard sourceOuterDriven else{setScale(scale);return}
        let local=sourceLocalScale;sourceNativeGeometryScale=scale;paintSourceOuterScale(local)
    }
    func restoreSourceOuterForAcceptedDrop(){sourceOuterBridge?.restoreForAcceptedDrop()}
    func paintSourceOuter(_ pose:NativeTileOuterMotion.Pose) {
        guard !disposed else{return}
        position=pose.position;paintSourceOuterScale(pose.scale);zRotation = -pose.rotation
    }
    func paintSourceOuterPosition(_ position:CGPoint) {guard !disposed else{return};self.position=position}
    func paintSourceOuterScale(_ scale:CGPoint) {
        guard !disposed else{return}
        xScale=sourceNativeGeometryScale*scale.x;yScale=sourceNativeGeometryScale*scale.y
    }
    func paintSourceIdle(_ pose:NativeRegularIdleMotion.Pose) {
        guard !disposed else{return}
        paintSourceOuterScale(CGPoint(x:pose.x,y:pose.y));zRotation = -pose.rotation
    }
    func beginSourcePickup()->Bool {
        sourceAppSpawnInterruption?.pickup()
        guard !disposed else{return false}
        return sourceOuterBridge?.pickup() ?? false
    }
    func beginSourceReturn(to destination:CGPoint,onCompleted:@escaping()->Void)->Bool {sourceOuterBridge?.snapBack(to:destination,onCompleted:onCompleted) ?? false}
    func beginSourceIdle(_ motion:NativeRegularIdleMotion,release:@escaping()->Void,onSmoke:@escaping()->Void,onFinished:@escaping()->Void)->Bool {
        guard let bridge=sourceOuterBridge else{release();return false}
        return bridge.idle(motion,releaseSourceFrames:release,onSmoke:onSmoke,onFinished:onFinished)
    }
    func interruptSourceOuter(){sourceOuterBridge?.interrupt()}
    func interruptSourceOuter(receipt:NativeTileOuterReceipt){sourceOuterBridge?.interrupt(receipt:receipt)}
    // Literal Source topology: shadow container lift scale/alpha wraps the
    // existing immutable PNG; inner appearance scale does not scale its offset.
    var dragShadowTileID:String {tileID}
    var dragShadowGeneration:UInt64 {sourceGeneration}
    var dragShadowIsWild:Bool {isSpecial}
    var dragShadowAlpha:CGFloat {
        get {sourceShadowContainer.alpha}
        set {sourceShadowContainer.alpha=newValue}
    }
    var dragShadowLiftScale:CGFloat {
        get {sourceShadowContainer.xScale}
        set {sourceShadowContainer.setScale(newValue)}
    }
    var dragShadowVisible:Bool {
        get {!sourceShadowContainer.isHidden}
        set {sourceShadowContainer.isHidden = !newValue}
    }
    var sourceInnerPosition:CGPoint {
        get {let center=NativeDragShadowPose.center(tilt:dragInnerTilt);return CGPoint(x:visual.position.x-center.x,y:visual.position.y+center.y)}
        set {let center=NativeDragShadowPose.center(tilt:dragInnerTilt);visual.position=CGPoint(x:newValue.x+center.x,y:newValue.y-center.y)}
    }
    var dragInnerTilt:CGFloat {
        get {-visual.zRotation}
        set {
            let baseline=sourceInnerPosition
            visual.zRotation = -newValue
            // Native center conversion composes the independently captured
            // rotG position channel with Source top-center pivot(-64).
            let center=NativeDragShadowPose.center(tilt:newValue)
            visual.position=CGPoint(x:baseline.x+center.x,y:baseline.y-center.y)
        }
    }
    func paintDragShadow(_ pose:NativeDragShadowPose) {
        guard !disposed else{return}
        shadow.position=CGPoint(x:pose.position.x,y:-pose.position.y)
        shadow.setScale(pose.appearanceScale);shadow.zRotation=0
    }
    func installSourceDragTweenDriver(_ driver:NativeDragTweenDriver) {
        guard !disposed,sourceShadowOwner==nil else{return}
        sourceBindingRevision &+= 1
        shadow.removeFromParent();sourceShadowContainer.addChild(shadow)
        sourceShadowContainer.zPosition = -20;sourceShadowContainer.alpha=0;sourceShadowContainer.isHidden=true
        shadow.alpha=1;shadow.zPosition=0;if sourceShadowContainer.parent==nil {addChild(sourceShadowContainer)}
        sourceShadowOwner=NativeDragShadowPresentationOwner(host:self,driver:driver)
    }
    private var sourceKeepsInnerIdle:Bool {variant == "spaceship"}
    func sourcePointerDown() {
        if !sourceKeepsInnerIdle {sourceShadowOwner?.cancelInnerTiltReturn()}
        sourceShadowOwner?.pickup()
    }
    func sourcePointerMoved(filteredVelocity:CGPoint) {
        guard sourceShadowOwner != nil,dragging else{return}
        if !sourceKeepsInnerIdle {
            let target=max(-0.16,min(0.16,-filteredVelocity.x*18))
            dragInnerTilt += (target-dragInnerTilt)*0.18
        }
        sourceShadowOwner?.update(filteredVelocity:filteredVelocity)
    }
    func sourcePointerUp(){sourceShadowOwner?.release(keepsInnerIdle:sourceKeepsInnerIdle)}
    func sourceSnapBackCompleted(){sourceShadowOwner?.snapBackCompleted()}
    var onResourceReady: (() -> Void)?

    init(id: String, value: Int, kind: String, variant: String?, depth: Int, locked: Bool,
         textures: NativeBoardTextures, deferSourceIdle:Bool=false,sourceSpecialIdle:NativeSourceSpecialIdleScope?=nil) {
        sourceIdleDeferred=deferSourceIdle
        self.sourceSpecialIdle=sourceSpecialIdle
        sourceRegistryPending=sourceSpecialIdle != nil && (kind != "regular" && kind != "normal" && kind != "" || variant.flatMap{NativeSpecialDiceRegistry.variants[$0]} != nil)
        tileID = id; self.value = value; self.kind = kind; self.variant = variant
        self.depth = depth; self.locked = locked; self.textures = textures
        let hash = id.utf8.reduce(UInt64(5381)) { ($0 &* 33) &+ UInt64($1) }
        definition = NativeDiceArtwork.definition(kind: kind, variant: variant, regularSkin: Int(hash % 4))
        super.init()
        name = "native-die-\(id)"
        visual.name = "die-visual"
        shadow.texture = textures.texture("assets/shadow.png")
        shadow.size = CGSize(width: 128 * 1.42 * 0.7 * 1.1, height: 128 * 1.42 * 0.7 * 1.1)
        shadow.alpha = 0; shadow.zPosition = -20
        addChild(shadow); addChild(visual)
        visual.addChild(stack); visual.addChild(face); visual.addChild(pips); visual.addChild(artwork)
        visual.addChild(spaceshipRoot)
        visual.addChild(flowerCanvas); flowerCanvas.zPosition = 2; flowerCanvas.isHidden = true
        flowerCanvas.addChild(flowerRoot); flowerRoot.addChild(flowerScale)
        flowerScale.addChild(flowerRotation); flowerRotation.addChild(flowerArt)
        stack.zPosition = -5; pips.zPosition = 1; artwork.zPosition = 2
        rebuild()
        if let sourceSpecialIdle {_ = configureSourceSpecialIdle(sourceSpecialIdle)}
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    var hasAnimatedArtwork: Bool {
        if let sheet=sourceStarSheet,sheet.isCurrent {return true}
        if let honey=sourceHoneyIdle {return !disposed && !sourceWildStateCleared && !sourceIdleDeferred && honey.isCurrent}
        if variant=="bee",sourceSkinHitArea != nil {
            guard let cohort=sourceBeeFrames,cohort.generation==sourceGeneration,cohort.handles.count>=2,
                  cohort.handles.allSatisfy({textures.isSourceTextureHandleCurrent($0)}) else{return false}
        }
        return !disposed && !sourceWildStateCleared && !sourceRegistryPaused && !sourceIdleDeferred && !sourceRegistryPending && ((!frames.isEmpty && definition.idleSheet != nil) || variant == "bee" || variant == "flower" || variant == "cubero" || variant == "bottle" || variant == "spaceship" || variant == "fish" && artworkPhaseID != nil && !artworkRunning || honeyIdle?.hasActiveMotion==true || idleFizz?.isRunning==true || mushroomSmoke != nil || kantaIdle?.assetReady == true)
    }
    var authoredArtworkReceipt:(frame:Int,elapsed:Double,running:Bool,pending:Bool,paused:Bool) {(paintedFrame,artworkElapsed,artworkRunning,sourceRegistryPending,sourceRegistryPaused)}
    var hasPresentationActions: Bool { hasActions() || visual.hasActions() || shadow.hasActions() }
    var resourcePaths: Set<String> {
        var paths: Set<String> = [definition.path, "assets/shadow.png"]
        if sourceStarSheet != nil {paths.insert(NativeDiceSheet.star.path)}
        if let receipt=sourceWildSkinTexture,receipt.generation==sourceGeneration,
           receipt.kind==kind,receipt.variant==variant,!sourceWildStateCleared {
            paths.insert(receipt.handle.assetPath) // pin exact Source mobile path, not only Raw alias
        }
        if let frames=sourceBeeFrames,frames.generation==sourceGeneration,variant=="bee",kind=="wild" {
            paths.formUnion(frames.handles.map(\.assetPath))
        }
        if let sheet = definition.idleSheet { paths.insert(sheet.path) }
        if variant == "kanta" { paths.formUnion(["assets/shop/kanta/02.png","assets/shop/kanta/04.png"]) }
        if variant == "flower" { paths.insert("assets/shop/bush/flower-pixi-source.png") }
        if variant == "spaceship" {paths.formUnion((1...4).map {"assets/shop/spaceship/spaceship-idle\($0).png"})}
        if variant == "honey" {paths.formUnion((1...7).map {"assets/shop/honey/bee\($0).png"})}
        return paths
    }

    func update(value: Int, kind: String, variant: String?, depth: Int, locked: Bool) {
        guard !disposed else { return }
        if sourceWildDestinationFrames != nil {return} // Exact captured face owns these fields through main.
        if sourceRegularFramePending,kind==self.kind,variant==self.variant,locked==self.locked,!isSpecial {self.value=value;return}
        if sourceRegularFrameBinding != nil && (kind != self.kind || variant != self.variant || locked != self.locked) {retireSourceStackFrames()}
        guard !disposed else{return}
        guard self.value != value || self.kind != kind || self.variant != variant || self.depth != depth || self.locked != locked else { return }
        let sourceSkinOwnsUnchangedIdentity = self.kind==kind && self.variant==variant && (sourceSkinHitArea != nil || sourceRestoredWildConstructorCurrent || sourceOpenedWildConstructorCurrent)
        if self.kind != kind || self.variant != variant {
            retireSourceWildShimmer()
            // Retire this skin identity before any callback or raw rebuilding.
            // Its revision prevents an old A→B→A async receipt from repainting.
            retireSourceBottleIdle(restoring:true)
            retireSourceHoneyIdle()
            retireSourceBeeHostMotion(restoring:true)
            retireSourceOpenedWildFrame()
            retireSourceRestoredWildFrame();sourceRestoredWildIdentity=nil;sourceRestoredWildDropMarkers=nil;sourceRestoredWildParent=nil;sourceRestoredWildFaceHit=nil
            sourceWildSkinRevision &+= 1
            sourceSkinHitArea=nil;sourceWildSkinTexture=nil;sourceBeeFrames=nil
            retireSourceStarHalo()
            sourceSpecialIdle?.retire(self);sourceRegistryPaused=false
            sourceRegistryPending=sourceSpecialIdle != nil && (kind != "regular" && kind != "normal" && kind != "" || variant.flatMap{NativeSpecialDiceRegistry.variants[$0]} != nil)
        }
        self.value = value; self.depth = depth; self.locked = locked
        let identityChanged = self.kind != kind || self.variant != variant
        self.kind = kind; self.variant = variant
        // Core value/depth/lock bookkeeping must not replace a Source-owned
        // special face, live pivot, or idle hierarchy with the Raw recipe.
        // This applies while its real texture request is pending as well.
        if sourceSkinOwnsUnchangedIdentity {return}
        if identityChanged {
            if let id=artworkPhaseID {textures.releaseIdlePhase(id)}
            fishMediaReady=false
            artworkPhaseID=nil;artworkRunning=false;artworkElapsed=0
            kantaIdle?.dispose(); kantaIdle = nil;mushroomSmoke?.dispose();mushroomSmoke=nil;spaceshipEngine?.dispose();spaceshipEngine=nil;honeyIdle?.dispose();honeyIdle=nil;idleFizz?.dispose();idleFizz=nil
            let hash = tileID.utf8.reduce(UInt64(5381)) { ($0 &* 33) &+ UInt64($1) }
            definition = NativeDiceArtwork.definition(kind: kind, variant: variant, regularSkin: Int(hash % 4))
            elapsed = 0; cuberoElapsed = 0; bottleElapsed=0;spaceshipElapsed=0;spaceshipRoot.position = .zero;spaceshipRoot.zRotation=0;face.position = .zero; face.zRotation = 0; frames = []; paintedFrame = -1
        }
        rebuild()
        if let scope=sourceSpecialIdle {_ = configureSourceSpecialIdle(scope)}
    }

    private func rebuild() {
        if !sourceIdleDeferred && !sourceRegistryPending,idleFizz==nil,let family=NativeIdleBubbleMotion.family(kind:kind,variant:variant) {
            let field=NativeIdleBubbleField(family:family);idleFizz=field;visual.addChild(field)
        }
        // Idle allocation may rebuild its hierarchy, but the admitted Source
        // skin owns the static face even while its real upload is pending.
        if sourceSkinHitArea == nil && !sourceRestoredWildConstructorCurrent && !sourceOpenedWildConstructorCurrent {
            face.texture = textures.texture(value == 0 && !isSpecial ? "assets/tile.png" : definition.path)
            face.size = definition.size; face.anchorPoint = definition.anchor
        }
        let faceHost=variant == "spaceship" ? spaceshipRoot:visual
        if face.parent !== faceHost {face.removeFromParent();faceHost.addChild(face)}
        face.isHidden = false; artwork.isHidden = true
        paintFishVisibility()
        flowerCanvas.isHidden = true
        if !sourceIdleDeferred && !sourceRegistryPending,variant == "spaceship",spaceshipEngine==nil {
            let engine=NativeSpaceshipDiceIdle();spaceshipEngine=engine;spaceshipRoot.addChild(engine);engine.zPosition = -2
        }
        if !sourceIdleDeferred && !sourceRegistryPending,!sourceHoneyPreparing,variant == "honey",honeyIdle==nil,sourceHoneyIdle==nil {
            let idle=NativeHoneyDiceIdle(textures:textures);honeyIdle=idle;visual.addChild(idle)
        }
        if !sourceIdleDeferred && !sourceRegistryPending,variant == "mushroom",mushroomSmoke==nil {
            let smoke=NativeMushroomDiceSmoke();mushroomSmoke=smoke;visual.addChild(smoke);smoke.zPosition = -1
        }
        if !sourceIdleDeferred && !sourceRegistryPending,variant == "kanta" {
            if kantaIdle == nil {
                let idle = NativeKantaDiceIdle(textures:textures,size:definition.size)
                kantaIdle = idle;visual.addChild(idle);idle.zPosition = 2
            }
            face.isHidden = kantaIdle?.assetReady == true
            kantaIdle?.alpha = locked ? 0.18 : 1
        }
        if variant == "flower" {
            let scale: CGFloat = 128 / 108.36
            flowerCanvas.position = CGPoint(x: -79.33*scale, y: 74.78*scale)
            flowerCanvas.setScale(scale)
            flowerScale.position = CGPoint(x: 80, y: -117)
            flowerRotation.position = CGPoint(x: 0, y: 42)
            flowerArt.texture = textures.texture("assets/shop/bush/flower-pixi-source.png")
            flowerArt.anchorPoint = CGPoint(x: 0, y: 1)
            flowerArt.position = CGPoint(x: -80+25.15, y: 75-20.6)
            flowerArt.size = CGSize(width: 108.36, height: 108.36)
            if flowerArt.texture != nil {admitArtworkPhase(group:"flower-bouncy-pixi",cycle:NativeFlowerMotion.duration)}
            paintFlower()
        }
        if sourceSkinHitArea == nil {face.alpha = locked ? 0.18 : 1}
        paintBottle()
        sourceStackRevision &+= 1
        pips.removeAllChildren(); stack.removeAllChildren()
        if !isSpecial && !locked && value > 0 {
            let maps = [1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]]
            for index in maps[min(6,max(1,value))] ?? [] {
                let x = CGFloat(index % 3 - 1) * 25.6
                let y = -CGFloat(index / 3 - 1) * 25.6
                let pip=SKSpriteNode(texture:textures.pipTexture(),size:CGSize(width:15,height:15))
                pip.position=CGPoint(x:x,y:y)
                pips.addChild(pip)
            }
            for index in 1..<max(1,min(4,depth)) {
                let layer = SKSpriteNode(texture: face.texture)
                let shrink = 1 - CGFloat(index) * 0.05
                layer.size = CGSize(width: 128 * shrink, height: 128 * shrink)
                layer.alpha = 0.9
                // Persisted ID gives independent, stable layer poses on re-render.
                let seed = CGFloat(tileID.utf8.reduce(index * 7) { ($0 * 31 + Int($1)) % 991 })
                layer.position = CGPoint(x: sin(seed) * (6 + CGFloat(index)*1.6), y: cos(seed) * (5 + CGFloat(index)*1.3))
                layer.zRotation = (index % 2 == 0 ? -1 : 1) * (10 + seed.truncatingRemainder(dividingBy: 10)) * .pi / 180
                layer.zPosition = CGFloat(-10 + index)
                layer.color = UIColor(red: 139.0/255, green: 90.0/255, blue: 43.0/255, alpha: 1)
                layer.colorBlendFactor = 0.25
                stack.addChild(layer)
            }
        }
        artworkGeneration += 1
        let token = artworkGeneration
        if !sourceIdleDeferred && !sourceRegistryPending,let sheet = definition.idleSheet {
            if !frames.isEmpty { admitArtworkPhase(group:sheet.path,cycle:sheet.cycle);paintArtwork(); return }
            textures.prepare(sheet) { [weak self] loaded in
                guard let self, !self.disposed, token == self.artworkGeneration, !self.sourceIdleDeferred else { return }
                self.frames = loaded
                if !loaded.isEmpty {self.admitArtworkPhase(group:sheet.path,cycle:sheet.cycle)}
                self.paintArtwork()
                self.onResourceReady?()
            }
        }
    }

    private var sourceMagnetFizzRAFs:[UUID:(cue:UUID,lease:NativeSourceAnimationClockService.SourceFrameLease)]=[:]
    private func cancelSourceMagnetFizzRAF(cue:UUID?=nil){
        let ids=sourceMagnetFizzRAFs.filter{cue==nil || $0.value.cue==cue}.map{$0.key}
        let old=ids.compactMap{sourceMagnetFizzRAFs.removeValue(forKey:$0)?.lease};old.forEach{$0.cancel()}
    }
    /// Every accepted same-live-node Source prefix keeps its original FIFO RAF.
    /// Scope/generation/defer/disposal retirement remains destructive.
    @discardableResult func scheduleSourceMagnetFizzRestart(service:NativeSourceAnimationClockService,
        tasks:NativeSourceMicrotaskFIFO.Scope,canvasPaintable:@escaping()->Bool,current:@escaping()->Bool)->Bool {
        guard !disposed,kind=="wild-magnet",variant=="bottle" || variant=="honey",
              !sourceIdleDeferred,let scope=sourceIdleBubbleScope,scope.admissionOpen,
              let field=sourceIdleBubbleField,idleFizz === field,field.parent === visual,
              let cue=sourceIdleBubbleStartID,tasks.admissionOpen,current() else{return false}
        let id=UUID(),generation=sourceGeneration,capturedVariant=variant,capturedParent=parent
        guard let lease=service.requestSourceAnimationFrame(ownerID:"source-magnet-fizz-\(tileID)",generation:generation,
            callback:{[weak self,weak scope,weak service,weak capturedParent] in
                guard let self,self.sourceMagnetFizzRAFs.removeValue(forKey:id) != nil else{return}
                guard let service,let scope,!self.disposed,!self.sourceIdleDeferred,!self.sourceWildStateCleared,
                      self.sourceGeneration==generation,self.kind=="wild-magnet",self.variant==capturedVariant,
                      self.parent === capturedParent,self.sourceIdleBubbleScope === scope,
                      let latest=self.sourceIdleBubbleField,self.idleFizz === latest,latest.parent === self.visual,
                      tasks.admissionOpen,scope.admissionOpen,current() else{return}
                _ = self.beginSourceIdleBubbles(scope:scope,service:service,tasks:tasks,canvasPaintable:canvasPaintable,current:current)
            }) else{return false}
        sourceMagnetFizzRAFs[id]=(cue,lease);return true
    }
    private var sourceIdleBubbleStartID:UUID?
    private weak var sourceIdleBubbleField:NativeIdleBubbleField?
    private weak var sourceIdleBubbleScope:NativeSourceSpecialIdleScope?
    private var sourceIdleBubbleCurrent:(()->Bool)?
    private var sourceIdleBubblePaintable:(()->Bool)?
    /// Called only from the actual APP skin prefix after shimmer, before variant
    /// motion. Generic Raw rebuild never borrows the APP Math.random function.
    @discardableResult func beginSourceIdleBubbles(scope:NativeSourceSpecialIdleScope,service:NativeSourceAnimationClockService,tasks:NativeSourceMicrotaskFIFO.Scope,canvasPaintable:@escaping()->Bool,current:@escaping()->Bool)->NativeIdleBubbleField? {
        guard !disposed,!sourceIdleDeferred,!sourceWildStateCleared,
              sourceOuterDriven,parent != nil,sourceSpecialIdle === scope,scope.admissionOpen,
              let hit=sourceSkinHitArea,hit.generation==sourceGeneration,
              let common=scope.sourceMathRandom,let family=NativeIdleBubbleMotion.family(kind:kind,variant:variant) else{return nil}
        let generation=sourceGeneration,revision=sourceBindingRevision,skinRevision=sourceWildSkinRevision,artRevision=artworkGeneration
        let capturedParent=parent,id=UUID()
        func live()->Bool {
            guard !disposed,!sourceIdleDeferred,!sourceWildStateCleared,
                  sourceGeneration==generation,sourceBindingRevision==revision,sourceWildSkinRevision==skinRevision,
                  artworkGeneration==artRevision,parent === capturedParent,sourceSkinHitArea?.id==hit.id,
                  sourceSpecialIdle === scope,scope.admissionOpen else{return false}
            let accepted=current()
            return accepted && !disposed && sourceGeneration==generation && sourceBindingRevision==revision &&
                sourceWildSkinRevision==skinRevision && artworkGeneration==artRevision && sourceSkinHitArea?.id==hit.id &&
                sourceSpecialIdle === scope && scope.admissionOpen && !sourceIdleDeferred && parent === capturedParent
        }
        guard live() else{return nil}
        sourceIdleBubbleStartID=id
        let old=idleFizz;idleFizz=nil;old?.dispose() // literal stop existing bubble system
        let paintable:()->Bool = {[weak self] in
            guard let self else{return false}
            return self.sourceIdleHostPaintable(canvasPaintable:canvasPaintable())
        }
        let field=NativeIdleBubbleField(sourceFamily:family,service:service,tasks:tasks,random:{common.next()},
            current:{[weak self,weak scope,weak capturedParent] in
                guard let self,let scope,!self.disposed,scope.admissionOpen,
                      self.sourceIdleBubbleStartID==id,self.sourceGeneration==generation,
                      self.sourceBindingRevision==revision,self.sourceWildSkinRevision==skinRevision,
                      self.artworkGeneration==artRevision,self.parent === capturedParent else{return false}
                return current()
            },paintable:paintable)
        guard sourceIdleBubbleStartID==id,live() else {
            field.dispose();if sourceIdleBubbleStartID==id {sourceIdleBubbleStartID=nil};return nil
        }
        idleFizz=field;sourceIdleBubbleField=field;sourceIdleBubbleScope=scope;sourceIdleBubbleCurrent=current;sourceIdleBubblePaintable=paintable;visual.addChild(field)
        field.setSourceVisible(paintable())
        guard field.startSource() else {
            if idleFizz === field {idleFizz=nil};field.dispose();return nil
        }
        onResourceReady?()
        guard sourceIdleBubbleStartID==id,idleFizz === field,live() else {
            if idleFizz === field {idleFizz=nil};field.dispose()
            if sourceIdleBubbleStartID==id {sourceIdleBubbleStartID=nil};return nil
        }
        return field
    }

    private func retireSourceIdleBubbles(scope:NativeSourceSpecialIdleScope) {
        guard sourceIdleBubbleScope === scope else{return}
        cancelSourceMagnetFizzRAF()
        let field=sourceIdleBubbleField;sourceIdleBubbleField=nil;sourceIdleBubbleScope=nil;sourceIdleBubbleCurrent=nil;sourceIdleBubblePaintable=nil;sourceIdleBubbleStartID=nil
        if idleFizz === field {idleFizz=nil};field?.dispose()
    }
    /// Source bubbles are a distinct FX owner, not variant-registry motion.
    /// Scene validates identity only; APP Source roots own all animation time.
    func tickSourceIdleBubbles(_ delta:TimeInterval,suspended:Bool) {
        guard let field=sourceIdleBubbleField,idleFizz === field,let scope=sourceIdleBubbleScope else{return}
        let admitted=scope.admissionOpen && sourceIdleBubbleCurrent?()==true
        // Current/model getters may reenter. An old check never retires C.
        guard sourceIdleBubbleField === field,idleFizz === field,sourceIdleBubbleScope === scope else{return}
        guard admitted else{retireSourceIdleBubbles(scope:scope);return}
        guard !disposed,!sourceWildStateCleared,!sourceIdleDeferred,!isHidden,alpha>0,!suspended else{return}
        // Source roots borrow the canonical service; Scene samples no animation time.
    }

    func reconcileSourceIdleBubbleVisibility(){
        reconcileSourceHoneyIdleVisibility()
        reconcileSourceBottleIdleVisibility()
        guard let field=sourceIdleBubbleField,idleFizz === field else{return}
        field.setSourceVisible(sourceIdleBubblePaintable?()==true)
    }

    /// Literal _ccDeferWildIdleFx boundary. Static original artwork may paint
    /// while hidden; phase/media allocation starts only at real Source landed.
    var sourceIdleOwnerCount:Int {
        [artworkPhaseID != nil,kantaIdle != nil,mushroomSmoke != nil,
         spaceshipEngine != nil,honeyIdle != nil,sourceHoneyIdle != nil,idleFizz != nil].filter{$0}.count
    }
    func setSourceIdleDeferred(_ active:Bool,preserveSourceBottleBase:Bool=false,preserveSourceHoneyIdle:Bool=false) {
        guard !disposed,sourceIdleDeferred != active else{return}
        sourceBottlePreservingBase=preserveSourceBottleBase && !active && variant=="bottle"
        sourceHoneyPreparing=preserveSourceHoneyIdle && !active && variant=="honey"
        defer{sourceBottlePreservingBase=false;sourceHoneyPreparing=false}
        sourceIdleDeferred=active;artworkGeneration+=1
        if active {
            retireSourceStarSheet()
            retireSourceBottleIdle(restoring:true)
            retireSourceHoneyIdle()
            cancelSourceMagnetFizzRAF()
            retireSourceWildShimmer()
            retireSourceBeeHostMotion(restoring:true)
            sourceBeeFrames=nil
            if let id=artworkPhaseID {textures.releaseIdlePhase(id)}
            artworkPhaseID=nil;artworkRunning=false;artworkElapsed=0;fishMediaReady=false
            kantaIdle?.dispose();kantaIdle=nil;mushroomSmoke?.dispose();mushroomSmoke=nil
            spaceshipEngine?.dispose();spaceshipEngine=nil;honeyIdle?.dispose();honeyIdle=nil
            idleFizz?.dispose();idleFizz=nil
            elapsed=0;cuberoElapsed=0;bottleElapsed=0;spaceshipElapsed=0
            spaceshipRoot.position = .zero;spaceshipRoot.zRotation=0
            face.position = .zero;face.zRotation=0
            if sourceSkinHitArea == nil {face.xScale=1;face.yScale=1}
        }
        rebuild()
        if !active,let scope=sourceSpecialIdle {_ = configureSourceSpecialIdle(scope)}
        onResourceReady?()
    }

    private var sourceIdleEligible:Bool {!sourceWildStateCleared && (isSpecial || variant.flatMap{NativeSpecialDiceRegistry.variants[$0]} != nil)}
    @discardableResult func configureSourceSpecialIdle(_ scope:NativeSourceSpecialIdleScope)->Bool {
        guard !disposed,scope.admissionOpen,sourceSpecialIdle == nil || sourceSpecialIdle === scope else{return false}
        sourceSpecialIdle=scope
        guard sourceIdleEligible else{scope.retire(self);return true}
        if sourceIdleDeferred {sourceRegistryPending=true;return true}
        return scope.register(self,owner:.init(start:{[weak self] in
            guard let self,!self.disposed else{return}
            let pending=self.sourceRegistryPending;self.sourceRegistryPending=false;self.sourceRegistryPaused=false
            if pending {self.rebuild()};self.onResourceReady?()
        },stop:{[weak self,weak scope] in self?.stopSourceRegisteredIdle(restoringActiveBee:scope?.admissionOpen==true)},pause:{[weak self] in
            self?.setSourceRegistryPaused(true)
        },resume:{[weak self] in self?.setSourceRegistryPaused(false)}))
    }
    func retireSourceSpecialIdleBinding(_ scope:NativeSourceSpecialIdleScope){
        guard sourceSpecialIdle === scope else{return};retireSourceStarSheet();retireSourceIdleBubbles(scope:scope);retireSourceHoneyIdle();retireSourceBottleIdle(restoring:true);sourceSpecialIdle=nil;sourceRegistryPending=sourceIdleEligible;scope.retire(self)
    }
    @discardableResult func beginSourceHoneyIdle(service:NativeSourceAnimationClockService,
        scope:NativeSourceSpecialIdleScope,assetTasks:NativeSourceMicrotaskAdapters,use2x:Bool,
        current:@escaping()->Bool,paintable:@escaping()->Bool)->Bool {
        guard !disposed,variant=="honey",!sourceWildStateCleared,!sourceIdleDeferred,!sourceRegistryPending,
            sourceSpecialIdle === scope,parent != nil,let random=scope.sourceMathRandom,
            service.sourceMicrotaskTasks === assetTasks,assetTasks.fifo.isAcceptingJobs else{return false}
        let id=UUID(),generation=sourceGeneration,revision=sourceBindingRevision,skinRevision=sourceWildSkinRevision,capturedKind=kind
        weak var capturedParent=parent
        sourceHoneyAdmissionID=id
        func identity()->Bool {
            !disposed && !sourceWildStateCleared && variant=="honey" && kind==capturedKind &&
            sourceGeneration==generation && sourceBindingRevision==revision && sourceWildSkinRevision==skinRevision &&
            parent === capturedParent && parent != nil && sourceSpecialIdle === scope && !sourceIdleDeferred
        }
        func admitted()->Bool {
            guard sourceHoneyAdmissionID==id,identity(),scope.admissionOpen else{return false}
            let ok=current();return ok && sourceHoneyAdmissionID==id && identity()
        }
        defer{if sourceHoneyAdmissionID==id {sourceHoneyAdmissionID=nil}}
        guard admitted() else{return false}
        if let old=sourceHoneyIdle,old.isCurrent {return sourceHoneyIdle === old && admitted()}
        retireSourceHoneyIdle(invalidateAdmission:false)
        guard admitted() else{return false};sourceHoneyOwnerID=id
        let live:()->Bool = {[weak self,weak scope] in
            guard let self,let scope,!self.disposed,self.sourceHoneyOwnerID==id,
                !self.sourceWildStateCleared,self.variant=="honey",self.kind==capturedKind,
                self.sourceGeneration==generation,self.sourceBindingRevision==revision,self.sourceWildSkinRevision==skinRevision,
                self.parent === capturedParent,self.parent != nil,self.sourceSpecialIdle === scope,
                !self.sourceIdleDeferred,scope.admissionOpen else{return false}
            let ok=current()
            return ok && !self.disposed && self.sourceHoneyOwnerID==id &&
                self.sourceGeneration==generation && self.sourceBindingRevision==revision && self.sourceWildSkinRevision==skinRevision &&
                self.parent === capturedParent && self.sourceSpecialIdle === scope && !self.sourceIdleDeferred && !self.sourceWildStateCleared
        }
        guard let owner=NativeSourceHoneyIdlePresentation(textures:textures,use2x:use2x,service:service,
            random:{random.next()},current:live,paintable:{[weak self] in self?.sourceIdleHostPaintable(canvasPaintable:paintable())==true}),admitted() else {
            if sourceHoneyOwnerID==id {sourceHoneyOwnerID=nil};return false
        }
        sourceHoneyIdle=owner;sourceHoneyPaintable=paintable;visual.addChild(owner)
        let raw=honeyIdle;honeyIdle=nil;raw?.dispose()
        guard owner.start(textures:textures,assetTasks:assetTasks),sourceHoneyIdle === owner,admitted(),live() else {
            if sourceHoneyIdle === owner {retireSourceHoneyIdle(invalidateAdmission:false)} else{owner.dispose()}
            return false
        }
        owner.setDragging(dragging || sourceRegistryPaused);reconcileSourceHoneyIdleVisibility()
        return sourceHoneyIdle === owner && admitted() && live()
    }
    private func retireSourceHoneyIdle(invalidateAdmission:Bool=true){
        if invalidateAdmission {sourceHoneyAdmissionID=nil}
        let old=sourceHoneyIdle;sourceHoneyIdle=nil;sourceHoneyOwnerID=nil;sourceHoneyPaintable=nil;old?.dispose()
    }
    private func reconcileSourceHoneyIdleVisibility(){
        guard let owner=sourceHoneyIdle else{return}
        let visible=sourceIdleHostPaintable(canvasPaintable:sourceHoneyPaintable?()==true)
        guard sourceHoneyIdle === owner else{return};owner.setVisible(visible)
    }
    /// Explicit captured caller admission; Raw constructors never call this.
    @discardableResult func beginSourceBottleIdle(service:NativeSourceAnimationClockService,
        scope:NativeSourceSpecialIdleScope,current:@escaping()->Bool,paintable:@escaping()->Bool)->Bool {
        guard !disposed,variant=="bottle",!sourceIdleDeferred,!sourceRegistryPending,
              sourceSpecialIdle === scope,parent != nil else{return false}
        let id=UUID(),generation=sourceGeneration,revision=sourceBindingRevision
        let skinRevision=sourceWildSkinRevision,capturedKind=kind
        weak var capturedParent=parent
        sourceBottleAdmissionID=id
        func identity()->Bool {
            !disposed && variant=="bottle" && kind==capturedKind &&
                sourceGeneration==generation && sourceBindingRevision==revision &&
                sourceWildSkinRevision==skinRevision && parent === capturedParent &&
                parent != nil && sourceSpecialIdle === scope && !sourceIdleDeferred
        }
        func admitted()->Bool {
            guard sourceBottleAdmissionID==id,identity(),scope.admissionOpen else{return false}
            let accepted=current()
            return accepted && sourceBottleAdmissionID==id && identity()
        }
        defer{if sourceBottleAdmissionID==id {sourceBottleAdmissionID=nil}}
        guard admitted() else{return false}
        retireSourceBottleIdle(restoring:true,invalidateAdmission:false)
        guard admitted() else{return false}
        let live:()->Bool = {[weak self,weak scope] in
            guard let self,let scope,!self.disposed,self.sourceBottleOwnerID==id,
                  self.variant=="bottle",self.kind==capturedKind,
                  self.sourceGeneration==generation,self.sourceBindingRevision==revision,
                  self.sourceWildSkinRevision==skinRevision,self.parent === capturedParent,
                  self.parent != nil,self.sourceSpecialIdle === scope,scope.admissionOpen else{return false}
            let accepted=current()
            return accepted && !self.disposed && self.sourceBottleOwnerID==id &&
                self.sourceGeneration==generation && self.sourceBindingRevision==revision &&
                self.sourceWildSkinRevision==skinRevision && self.parent === capturedParent &&
                self.sourceSpecialIdle === scope && self.kind==capturedKind && self.variant=="bottle"
        }
        sourceBottleOwnerID=id
        guard let owner=NativeSourceBottleIdlePresentation(host:face,service:service,current:live),admitted() else {
            if sourceBottleOwnerID==id {sourceBottleOwnerID=nil};return false
        }
        sourceBottleIdle=owner;sourceBottlePaintable=paintable
        guard owner.start(),sourceBottleIdle === owner,admitted(),live() else {
            if sourceBottleIdle === owner {retireSourceBottleIdle(restoring:true,invalidateAdmission:false)}
            else {owner.dispose(restoring:false)}
            return false
        }
        reconcileSourceBottleIdleVisibility()
        return sourceBottleIdle === owner && admitted() && live()
    }
    private func retireSourceBottleIdle(restoring:Bool,invalidateAdmission:Bool=true) {
        if invalidateAdmission {sourceBottleAdmissionID=nil}
        let old=sourceBottleIdle
        old?.dispose(restoring:restoring)
        if sourceBottleIdle === old {sourceBottleIdle=nil;sourceBottleOwnerID=nil;sourceBottlePaintable=nil}
    }
    /// Source rotG ancestry; direct base artwork visibility is independent.
    func sourceIdleHostPaintable(canvasPaintable:Bool)->Bool {
        guard !disposed,canvasPaintable else{return false}
        // SKNode stores alpha at Float32 precision; use the exact painted
        // representation of the original inclusive .001 boundary.
        let threshold=CGFloat(Float(0.001))
        var ancestor:SKNode?=visual
        while let node=ancestor {
            if node.isHidden || node.alpha<=threshold {return false}
            ancestor=node.parent
        }
        return !isHidden && alpha>threshold
    }
    func reconcileSourceBottleIdleVisibility(){
        guard let owner=sourceBottleIdle else{return}
        let visible=sourceIdleHostPaintable(canvasPaintable:sourceBottlePaintable?()==true)
        guard sourceBottleIdle === owner else{return}
        owner.setSuspended(sourceRegistryPaused || dragging || !visible)
    }
    private func setSourceRegistryPaused(_ active:Bool) {
        guard !disposed,sourceRegistryPaused != active else{return}
        sourceRegistryPaused=active
        sourceStarSheet?.pointerStateChanged()
        reconcileSourceBottleIdleVisibility()
        let effective=active || dragging
        sourceHoneyIdle?.setDragging(effective)
        kantaIdle?.setDragging(effective);mushroomSmoke?.setDragging(effective);honeyIdle?.setDragging(effective)
        // Direct artwork state stays pointer-only; retain painted phase/skin.
        onResourceReady?()
    }
    private func stopSourceRegisteredIdle(restoringActiveBee:Bool) {
        guard !disposed else{return}
        // Kanta's native idle projects the front/rear artwork in a child
        // carrier and hides this already admitted base face. Source disposal
        // retains its original base sprite; retiring our projection must hand
        // visibility back to that same face before a Magnet pulls the die.
        let kantaBaseWasCovered=kantaIdle?.assetReady==true && variant=="kanta" && face.texture != nil
        retireSourceStarSheet()
        retireSourceBottleIdle(restoring:true)
        retireSourceHoneyIdle()
        retireSourceBeeHostMotion(restoring:restoringActiveBee);sourceBeeFrames=nil
        sourceRegistryPending=sourceIdleEligible;sourceRegistryPaused=true;artworkGeneration+=1
        if let id=artworkPhaseID {textures.releaseIdlePhase(id)};artworkPhaseID=nil
        kantaIdle?.dispose();kantaIdle=nil;mushroomSmoke?.dispose();mushroomSmoke=nil
        if kantaBaseWasCovered,!sourceWildStateCleared {face.isHidden=false}
        spaceshipEngine?.dispose();spaceshipEngine=nil;honeyIdle?.dispose();honeyIdle=nil
        if let scope=sourceIdleBubbleScope,!scope.admissionOpen {retireSourceIdleBubbles(scope:scope)}
        if idleFizz !== sourceIdleBubbleField {idleFizz?.dispose();idleFizz=nil}
        // Retain final artwork pose until the captured Node's normal exit.
    }

    var isSpecial: Bool { kind != "regular" && kind != "normal" && kind != "" }

    /// Literal level-flow ensureActiveFullVisual(tile,true): kill only known
    /// carrier scale owners. Position, rotation, shadow and family cues survive.
    func repairSourceLevelFlowVisual() {
        guard !disposed else{return}
        visual.removeAction(forKey:"stack")
        visual.removeAction(forKey:"source-ordinary-six-hero")
        visual.setScale(1)
        alpha=1;visual.alpha=1;face.alpha=1;pips.alpha=1;pips.isHidden=false
    }

    func setDragging(_ active: Bool,sourceOuterTransform:Bool=false) {
        guard !disposed else { return }
        if active,var motion=sourceBeeHostMotion {
            if let last=motion.lastPaint,last.matches(sourceBeeHostPose) {paintSourceBeeHostPose(motion.original)}
            motion.lastPaint=nil;sourceBeeHostMotion=motion
        }
        dragging = active
        sourceHoneyIdle?.setDragging(active || sourceRegistryPaused)
        reconcileSourceBottleIdleVisibility()
        if active {idleFizz?.stopForPointer()}
        if variant == "cubero" {cuberoElapsed = 0;face.position = .zero;face.zRotation = 0}
        kantaIdle?.setDragging(active || sourceRegistryPaused);mushroomSmoke?.setDragging(active || sourceRegistryPaused);honeyIdle?.setDragging(active || sourceRegistryPaused)
        if !sourceOuterTransform {
            visual.removeAction(forKey: "stack"); visual.removeAction(forKey: "lift")
            visual.setScale(active ? 1.08 : 1)
        }
        if sourceShadowOwner==nil {
            shadow.removeAllActions()
            shadow.run(.fadeAlpha(to: active ? 0.35 : 0, duration: 0.08))
        }
        paintArtwork()
        paintFlower()
        if variant == "bottle",sourceBottleIdle==nil {bottleElapsed=0;paintBottle()}
        // Source applyFishDragFacing restores baseScaleX on pointer-up.
        // Visibility/skin repair must not become a second facing writer.
        if variant == "fish",!active {face.xScale=1}
        paintFishVisibility()
        sourceStarSheet?.pointerStateChanged()
    }

    func updateShadow(direction: CGPoint) {
        guard dragging, !disposed,sourceShadowOwner==nil else { return }
        let distance = max(1, hypot(direction.x, direction.y))
        shadow.position = CGPoint(x: direction.x / distance * 12, y: direction.y / distance * 12 - 10)
    }

    func resumeIdleAfterLanding() {
        guard !disposed,!sourceIdleDeferred && !sourceRegistryPending,!dragging else {return}
        idleFizz?.restartAfterLanding();onResourceReady?()
    }

    func updateIdleDrag(offset:CGPoint,velocity:CGPoint) {sourceHoneyIdle?.updateDrag(offset:offset,velocity:velocity);honeyIdle?.updateDrag(offset:offset,velocity:velocity)}

    func tick(_ delta: TimeInterval, suspended: Bool, viewportCenter: CGFloat, fizzDelta:TimeInterval?=nil) {
        guard sourceStarSheet==nil else{return}
        guard !disposed, !sourceWildStateCleared, !sourceIdleDeferred && !sourceRegistryPending, !isHidden, alpha > 0, !suspended,!sourceRegistryPaused else { return }
        if variant=="bee",sourceSkinHitArea != nil {
            guard let frames=sourceBeeFrames,frames.generation==sourceGeneration,frames.handles.count>=2,
                  frames.handles.allSatisfy({textures.isSourceTextureHandleCurrent($0)}) else{return}
        }
        elapsed += delta
        if idleFizz !== sourceIdleBubbleField {idleFizz?.tick(fizzDelta ?? delta)}
        if let id=artworkPhaseID {
            if !artworkRunning {if textures.advanceIdlePhase(id) {artworkRunning=true;artworkElapsed=0}}
            else {artworkElapsed+=delta}
        }
        if variant == "bee" {
            let time = elapsed
            let count=sourceSkinHitArea != nil ? (sourceBeeFrames?.handles.count ?? 0):4
            let index = Int(floor(time / (dragging ? 0.032 : 0.04))) % count
            if paintedFrame != index {
                if sourceSkinHitArea != nil,let handle=sourceBeeFrames?.handles[index] {
                    guard textures.isSourceTextureHandleCurrent(handle) else{return}
                    face.texture=handle.texture
                    sourceWildSkinTexture=(sourceGeneration,kind,variant,handle)
                } else {face.texture = textures.texture("assets/shop/bee/bee\(index+1).png")}
                paintedFrame = index
            }
            face.xScale = position.x > viewportCenter ? -1 : 1
            if sourceSkinHitArea != nil {
                paintSourceBeeHostMotion(seconds:time)
                let globalX=scene.map{face.convert(.zero,to:$0).x} ?? .nan
                let flip=globalX.isFinite && viewportCenter.isFinite && viewportCenter>0 && globalX>viewportCenter
                face.xScale=flip ? -abs(face.xScale):abs(face.xScale)
            } else if !dragging {
                face.position = CGPoint(x: sin(time * .pi * 1.7) * 2.8, y: -sin(time * .pi * 2.3 + .pi * 0.35) * 5)
                face.zRotation = -sin(time * .pi * 1.9 + .pi * 0.2) * 0.025
                let scale = 1 + sin(time * .pi * 2.6 + .pi * 0.6) * 0.018
                face.yScale = scale; face.xScale *= scale
            } else { face.position = .zero; face.zRotation = 0; face.yScale = 1 }
        } else if variant == "cubero" {
            if !dragging {cuberoElapsed += delta}
            let pose=NativeCuberoIdleMotion.sample(seconds:cuberoElapsed)
            face.position=CGPoint(x:pose.x,y:-pose.y);face.zRotation = -pose.rotation
        } else if variant == "bottle" {
            if !dragging,sourceBottleIdle==nil {bottleElapsed+=delta};paintBottle()
        } else if variant == "spaceship" {
            spaceshipElapsed+=delta
            let pose=NativeSpaceshipIdleMotion.sample(seconds:spaceshipElapsed)
            spaceshipRoot.position=CGPoint(x:pose.x,y:-pose.y);spaceshipRoot.zRotation = -pose.rotation
            let frame=NativeSpaceshipIdleMotion.frame(seconds:spaceshipElapsed)
            if paintedFrame != frame,let texture=textures.texture("assets/shop/spaceship/spaceship-idle\(frame+1).png") {face.texture=texture;paintedFrame=frame}
            spaceshipEngine?.paint(seconds:spaceshipElapsed)
        } else if variant == "kanta" { kantaIdle?.tick(delta,globalX:position.x,viewportCenter:viewportCenter) }
        else if variant == "honey" {honeyIdle?.tick(delta)}
        else if variant == "mushroom" {mushroomSmoke?.tick(delta);paintArtwork()}
        else if variant == "flower" { paintFlower() }
        else { paintArtwork() }
    }

    func prepareFishMediaPhase() {
        guard !disposed,!sourceIdleDeferred && !sourceRegistryPending,variant == "fish" else {return}
        admitArtworkPhase(group:"fish-swim-composition",cycle:1.125);onResourceReady?()
    }
    func setFishMediaReady(_ ready:Bool) {
        guard !disposed,variant == "fish",!ready || !sourceIdleDeferred && !sourceRegistryPending else {return}
        fishMediaReady=ready
        if !ready {if let id=artworkPhaseID {textures.releaseIdlePhase(id)};artworkPhaseID=nil;artworkRunning=false;artworkElapsed=0}
        paintFishVisibility();onResourceReady?()
    }
    private func paintFishVisibility() {
        guard variant == "fish" else {return}
        face.isHidden=fishMediaReady && !dragging
        idleFizz?.isHidden=fishMediaReady && !dragging
    }
    func fishFrame(in scene:SKScene,visible:Bool)->NativeFishIdleFrame? {
        guard !disposed,!sourceIdleDeferred && !sourceRegistryPending,variant == "fish" else {return nil}
        let center=visual.convert(CGPoint.zero,to:scene)
        if dragging {face.xScale=center.x>scene.size.width/2 ? -1:1}
        let horizontal=visual.convert(CGPoint(x:1,y:0),to:scene),vertical=visual.convert(CGPoint(x:0,y:-1),to:scene)
        var branchAlpha:CGFloat=face.alpha
        var ancestor:SKNode?=visual
        var branchVisible=visible
        while let node=ancestor {branchAlpha*=node.alpha;branchVisible=branchVisible && !node.isHidden && node.alpha>0.001;ancestor=node.parent}
        return NativeFishIdleFrame.project(center:center,horizontalUnit:horizontal,verticalUnit:vertical,sceneHeight:scene.size.height,alpha:branchAlpha,dragging:dragging,phaseStarted:artworkRunning,visible:branchVisible,bubbles:idleFizz?.fishBubbleSnapshots ?? [],depth:zPosition,paintOrder:parent?.children.firstIndex(where:{$0 === self}) ?? 0)
    }

    private func admitArtworkPhase(group:String,cycle:TimeInterval) {
        guard !disposed,!sourceIdleDeferred && !sourceRegistryPending,artworkPhaseID==nil else {return}
        let phase=textures.reserveIdlePhase(group:group,cycle:cycle)
        artworkPhaseID=phase.id;artworkRunning=phase.running;artworkElapsed=0
    }

    private func paintBottle() {
        guard variant == "bottle",sourceBottleIdle==nil,!sourceBottlePreservingBase else {return}
        if dragging || sourceIdleDeferred || sourceRegistryPending {face.anchorPoint=definition.anchor;face.position = .zero;face.zRotation=0;return}
        let pose=NativeBottleIdleMotion.sample(seconds:bottleElapsed)
        face.anchorPoint=CGPoint(x:0.5,y:0)
        let faceHeight = sourceSkinHitArea != nil ? sourceWildSkinFaceHeight:definition.size.height
        face.position=CGPoint(x:0,y:-faceHeight*0.5-pose.y);face.zRotation = -pose.rotation
    }

    private func paintFlower() {
        guard variant == "flower", !disposed else { return }
        flowerCanvas.isHidden = sourceIdleDeferred || sourceRegistryPending || dragging || flowerArt.texture == nil || !artworkRunning
        face.isHidden = !flowerCanvas.isHidden
        guard !flowerCanvas.isHidden else { return }
        let pose = NativeFlowerMotion.sample(seconds: artworkElapsed)
        flowerRoot.position.y = -pose.translateY
        flowerScale.xScale = pose.scaleX; flowerScale.yScale = pose.scaleY
        flowerRotation.zRotation = -pose.rotationDegrees * .pi / 180
    }

    private func paintArtwork() {
        guard !disposed, !sourceIdleDeferred && !sourceRegistryPending, let sheet = definition.idleSheet, !frames.isEmpty else { return }
        let useFrames = artworkRunning && (!dragging || sheet.animateDuringDrag)
        artwork.isHidden = !useFrames; face.isHidden = useFrames
        guard useFrames else { return }
        let frame = sheet.frame(at: artworkElapsed)
        if frame != paintedFrame { artwork.texture = frames[frame]; paintedFrame = frame }
        artwork.anchorPoint = sheet.anchor
        artwork.size = CGSize(width: sheet.cell.width * sheet.displayScale, height: sheet.cell.height * sheet.displayScale)
        artwork.position.y = sheet.offsetY
    }

    /// Capture only the current authored artwork into plain nodes. SpriteKit's
    /// polymorphic copy would instantiate a second custom idle owner.
    func detachedArtworkCarrier() -> SKNode {
        func capture(_ original:SKNode)->SKNode {
            let node:SKNode
            if let sprite=original as? SKSpriteNode {
                let image=SKSpriteNode(texture:sprite.texture,color:sprite.color,size:sprite.size)
                image.anchorPoint=sprite.anchorPoint;image.colorBlendFactor=sprite.colorBlendFactor;image.blendMode=sprite.blendMode;image.shader=sprite.shader
                node=image
            } else if let shape=original as? SKShapeNode {
                let image=SKShapeNode(path:shape.path ?? CGPath(rect:.zero,transform:nil))
                image.fillColor=shape.fillColor;image.strokeColor=shape.strokeColor;image.lineWidth=shape.lineWidth;image.glowWidth=shape.glowWidth
                image.lineCap=shape.lineCap;image.lineJoin=shape.lineJoin;image.isAntialiased=shape.isAntialiased
                node=image
            } else if let label=original as? SKLabelNode {
                let image=SKLabelNode(fontNamed:label.fontName)
                image.text=label.text;image.attributedText=label.attributedText;image.fontSize=label.fontSize;image.fontColor=label.fontColor
                image.horizontalAlignmentMode=label.horizontalAlignmentMode;image.verticalAlignmentMode=label.verticalAlignmentMode
                node=image
            } else {node=SKNode()}
            node.name=original.name;node.position=original.position;node.zPosition=original.zPosition
            node.xScale=original.xScale;node.yScale=original.yScale;node.zRotation=original.zRotation;node.alpha=original.alpha;node.isHidden=original.isHidden
            for child in original.children {node.addChild(capture(child))}
            return node
        }
        return capture(visual)
    }

    func stackFeedback() {
        guard !disposed else { return }
        visual.removeAllActions(); visual.setScale(1)
        visual.run(NativeBoardMotion.stack(squash: depth % 2 == 0), withKey: "stack")
    }

    func dispose() {
        guard !disposed else { return }
        sourceGridCell=nil
        retireSourceBottleIdle(restoring:false)
        retireSourceHoneyIdle()
        cancelSourceMagnetFizzRAF()
        retireSourceOpenedWildFrame()
        retireSourceWildShimmer()
        retireSourceBeeHostMotion(restoring:false)
        sourceRestoredWildIdentity=nil;sourceRestoredWildDropMarkers=nil;sourceRestoredWildParent=nil;sourceRestoredWildFaceHit=nil
        sourceSkinHitArea=nil;sourceWildSkinTexture=nil;sourceBeeFrames=nil
        sourceMergeSixCleanupToken=nil
        sourceNonFinalMergeSix=false;sourceNonFinalMergeSixAt=nil
        retireSourceStarHalo()
        let idleScope=sourceSpecialIdle;sourceSpecialIdle=nil;idleScope?.retire(self)
        if sourceAppSpawnInterruption != nil {disposed=true;interruptSourceAppSpawn()}
        if sourceOuterDriven || sourceShadowOwner != nil || sourceRegularFrameBinding != nil || sourceWildDestinationFrames != nil || sourceRestoreEmptyFaceFrame != nil || sourceRestoreWildFaceFrame != nil {
            disposed=true // seal before captured Source release/cancellation reentry
            retireSourceStackFrames()
            let outer=sourceOuterBridge,shadowOwner=sourceShadowOwner
            sourceOuterBridge=nil;sourceShadowOwner=nil;sourceOuterBindingID=nil;sourceBindingRevision &+= 1
            outer?.dispose();shadowOwner?.dispose()
        }
        sourceLockedSpawnMarkers.removeAll();sourceMarkerCoverageGeneration=nil;sourceConstructorMarkerAbsence=nil
        disposed=true;artworkGeneration += 1
        if let id=artworkPhaseID {textures.releaseIdlePhase(id)}
        artworkPhaseID=nil
        kantaIdle?.dispose(); kantaIdle = nil;mushroomSmoke?.dispose();mushroomSmoke=nil;spaceshipEngine?.dispose();spaceshipEngine=nil;honeyIdle?.dispose();honeyIdle=nil;idleFizz?.dispose();idleFizz=nil
        removeAllActions(); visual.removeAllActions(); shadow.removeAllActions()
        frames.removeAll(); onResourceReady = nil
        removeAllChildren(); removeFromParent()
    }
}
