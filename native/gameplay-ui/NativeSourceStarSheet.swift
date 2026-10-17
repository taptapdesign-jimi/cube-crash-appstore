import SpriteKit
import UIKit

/// Original generic Star shared sheet. The unchanged atlas contains bounce and
/// masked gloss. Scene delivers its existing Pixi-equivalent delta; this owner
/// has no ticker, timer, GSAP root, Math source or gameplay mutation.
@MainActor final class NativeSourceStarSheetPresentation {
    private let textures:NativeBoardTextures,current:()->Bool,paintable:()->Bool,ownsBase:()->Bool,dateNow:()->Double
    private weak var host:SKNode?,base:SKSpriteNode?,layer:SKNode?
    private var assetScope:NativeSourceMicrotaskFIFO.Scope?,foreground:NativeSourceAnimatedDiceForeground?,phaseID:Int?
    private var frames:[SKTexture]=[]
    private let originalBaseHidden:Bool
    private(set) var sprite:SKSpriteNode?
    private(set) var elapsedMilliseconds=0.0
    private(set) var frameIndex=0
    private(set) var running=false,disposed=false
    init?(textures:NativeBoardTextures,host:SKNode,base:SKSpriteNode,layer:SKNode,
        current:@escaping()->Bool,paintable:@escaping()->Bool,ownsBase:@escaping()->Bool,
        dateNow:@escaping()->Double={floor(Date().timeIntervalSince1970*1000)}) {
        guard let scene=host.scene,layer.scene === scene,current() else{return nil}
        self.textures=textures;self.host=host;self.base=base;self.layer=layer
        self.current=current;self.paintable=paintable;self.ownsBase=ownsBase;self.dateNow=dateNow
        originalBaseHidden=base.isHidden
    }
    var isCurrent:Bool {!disposed && current()}
    @discardableResult func start(tasks:NativeSourceMicrotaskAdapters)->Bool {
        guard isCurrent,assetScope==nil,let scope=tasks.fifo.makeAssetScope(boundProducer:.sourceAssetCompletionTask,isCurrent:{[weak self] in self?.isCurrent == true}) else{return false}
        assetScope=scope
        return textures.prepareSourceSharedSheet(.star,tasks:tasks,scope:scope,current:{[weak self] in self?.isCurrent == true}) {[weak self] frames in
            guard let self,self.isCurrent else{return}
            guard let frames,frames.count==NativeDiceSheet.star.frameCount,self.mount(frames:frames) else{self.dispose();return}
            let completed=self.assetScope;self.assetScope=nil;completed?.dispose()
        }
    }
    private func mount(frames:[SKTexture])->Bool {
        guard isCurrent,let host,let base,let layer else{return false}
        self.frames=frames
        let sheet=NativeDiceSheet.star,art=SKSpriteNode(texture:frames[0],size:sheet.cell)
        art.name="wild-star-composition-pixi";art.anchorPoint=sheet.anchor
        art.alpha=base.alpha;art.color=base.color;art.colorBlendFactor=base.colorBlendFactor
        art.zPosition=base.zPosition-0.01;art.isHidden=true;host.addChild(art);sprite=art
        guard let projection=NativeSourceAnimatedDiceForeground(displayObject:art,host:host,layer:layer,
            name:"wild-star-artwork-foreground",zPosition:art.zPosition,current:{[weak self] in self?.isCurrent == true}) else{return false}
        foreground=projection
        let phase=textures.reserveIdlePhase(group:"wild-star-composition",cycle:sheet.cycle,nowMilliseconds:dateNow())
        phaseID=phase.id;running=phase.running
        if running {paint()}
        return isCurrent
    }
    func tick(deltaMilliseconds:Double) {
        guard isCurrent else{dispose();return}
        guard let phaseID else{return}
        if !running {
            guard textures.advanceIdlePhase(phaseID,nowMilliseconds:dateNow()) else{return}
            running=true;elapsedMilliseconds=0;paint()
        }
        guard isCurrent else{return}
        if paintable() {
            let delta=deltaMilliseconds.isFinite && deltaMilliseconds>=0 ? min(100,deltaMilliseconds):1000/60
            elapsedMilliseconds=(elapsedMilliseconds+delta).truncatingRemainder(dividingBy:2000)
        }
        paint()
    }
    /// The Star spec explicitly animates during actual pointer drag. Registry
    /// pressure never changes this sheet's clock or ownership.
    func pointerStateChanged(){refreshCurrentPresentation()}
    /// Follow parent SKActions after evaluation even when the idle clock is
    /// suspended for board exit. Zero alpha hides the projection without
    /// retiring its resource/lifetime owner.
    func synchronizeHostPose(){guard isCurrent else{return};_ = foreground?.sync()}
    /// SpriteKit combines visible/renderable into isHidden. A Source static
    /// repaint must let this same owner reassert render suppression immediately,
    /// before publication or the next renderer frame, without advancing phase.
    func baseFacePainted(){refreshCurrentPresentation()}
    private func refreshCurrentPresentation(){guard isCurrent,running else{return};paint()}
    private func paint() {
        guard isCurrent,running,let sprite,let base else{return}
        guard paintable(),!originalBaseHidden else{
            sprite.isHidden=true
            if ownsBase(){base.isHidden=originalBaseHidden}
            return
        }
        let next=NativeDiceSheet.star.frame(at:elapsedMilliseconds/1000)
        if next != frameIndex {frameIndex=next;sprite.texture=frames[next]}
        sprite.alpha=base.alpha;sprite.color=base.color;sprite.colorBlendFactor=base.colorBlendFactor
        sprite.isHidden=false
        guard foreground?.sync()==true else{dispose();return}
        if ownsBase(){base.isHidden=true}
    }
    func dispose(){
        guard !disposed else{return};disposed=true
        let scope=assetScope;assetScope=nil;scope?.dispose()
        if let phaseID{textures.releaseIdlePhase(phaseID)};phaseID=nil
        let projection=foreground;foreground=nil;projection?.dispose(restoring:false)
        sprite?.removeFromParent();sprite=nil;frames=[]
        if ownsBase(){base?.isHidden=originalBaseHidden}
        host=nil;base=nil;layer=nil
    }
    isolated deinit{dispose()}
}
