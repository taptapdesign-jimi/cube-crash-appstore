import SpriteKit
import StackToSixGameplay

/// One selected board presentation, without an engine, input, saves or audio.
/// The visible SKView owns cadence; hidden/retired previews own no rendering.
@MainActor final class NativeBackpackDicePreview:SKView {
    private final class PreviewScene:SKScene {
        weak var owner:NativeBackpackDicePreview?
        override func update(_ currentTime:TimeInterval){owner?.advance(currentTime)}
    }
    private let textures:NativeBoardTextures
    private let canvas=PreviewScene(size:CGSize(width:320,height:320))
    private(set) var dieNode:NativeDiceNode?
    private var disposed=false,active=false,lastTime:TimeInterval?,bodyRect=CGRect(x:-64,y:-64,width:128,height:128)
    private let resourceRoot:URL
    private(set) var fishOwner:NativeFishIdleOwner?
    private(set) var groundedBodyY:CGFloat?,highestBodyY:CGFloat?
    private var presentationRect=CGRect(x:-64,y:-64,width:128,height:128)
    var presentationHeightRatio:CGFloat {max(1,presentationRect.height/max(1,bodyRect.height))}
    private var previewElapsed:TimeInterval=0
    private var pollen:[SKShapeNode]=[]
    private(set) var ready=false
    var onReady:(()->Void)?
    var isPlaying:Bool {ready && active && !isPaused && !disposed}
    var artworkFrame:CGRect?
    private let referenceBounds:CGRect
    let identity:NativeBackpackCatalog.Die
    init(die:NativeBackpackCatalog.Die,root:URL,referenceBounds:CGRect=CGRect(x:0,y:0,width:1,height:1)){
        identity=die;self.resourceRoot=root;self.referenceBounds=referenceBounds;textures=NativeBoardTextures(root:root)
        super.init(frame:.zero)
        backgroundColor = .clear;allowsTransparency=true;isOpaque=false;isUserInteractionEnabled=false
        preferredFramesPerSecond=["bee","honey","fish"].contains(die.id) ? 60:30;isPaused=true
        canvas.backgroundColor = .clear;canvas.scaleMode = .resizeFill;canvas.owner=self
        prepare()
    }
    required init?(coder:NSCoder){fatalError("Use selected die")}
    private func prepare(){
        let variant=NativeSpecialDiceRegistry.variants[identity.id]
        let kind=variant?.archetype.rawValue ?? (identity.id=="tnt" ? "wild-tnt":identity.id=="wild-star" ? "wild":identity.id)
        var artwork=identity.id=="barell" ? NativeDiceArtwork(path:"assets/shop/barell/barell.png",idleSheet:.barrel):identity.artwork
        if identity.id=="cubero" {artwork.idleSheet = .cuberoCollection}
        // Ball's independent base and atlas preparation overlap. The existing
        // readiness barrier still requires both before the first modal frame.
        let parallelBallSheet=identity.id=="beach-ball" ? artwork.idleSheet:nil
        var earlySheetReady=false
        var earlySheetCompletion:(()->Void)?
        if let sheet=parallelBallSheet {
            textures.prepareArtworkSheetForPresentation(sheet,includeMotionBounds:true){_ in
                earlySheetReady=true
                let completion=earlySheetCompletion;earlySheetCompletion=nil;completion?()
            }
        }
        // Materialize the base before constructing the exact board visual.
        let base=identity.id=="barell" ? "assets/shop/barell/barell.png":identity.artwork.path
        textures.prepareDensityAwareArtwork(base){[weak self] _ in
            guard let self,!self.disposed else{return}
            let node=NativeDiceNode(id:"backpack-\(self.identity.id)",value:6,kind:kind,variant:variant?.id,depth:1,locked:false,textures:self.textures,deferSourceIdle:true,artworkOverride:["barell","cubero"].contains(self.identity.id) ? artwork:nil)
            self.dieNode=node;self.canvas.addChild(node)
            var paths=node.resourcePaths
            if let sheet=artwork.idleSheet {paths.remove(sheet.path)}
            if self.identity.id=="bee" {paths.formUnion((1...4).map{"assets/shop/bee/bee\($0).png"})}
            let count=paths.count+(artwork.idleSheet == nil ? 0:1)
            var remaining=count
            @MainActor func complete(){
                guard !self.disposed else{return};remaining-=1
                if remaining==0 {self.finishPreparation(node)}
            }
            for path in paths {self.textures.prepareDensityAwareArtwork(path){_ in complete()}}
            if let sheet=artwork.idleSheet {
                if parallelBallSheet != nil {
                    if earlySheetReady {complete()}else{earlySheetCompletion={complete()}}
                }else{self.textures.prepareArtworkSheetForPresentation(sheet){_ in complete()}}
            }
        }
    }
    private func finishPreparation(_ node:NativeDiceNode){
        guard !disposed,dieNode === node else{return}
        node.setSourceIdleDeferred(false)
        if identity.id=="honey" {node.configureCollectionHoney()}
        if identity.id=="fish" {node.prepareFishMediaPhase()}
        textures.advanceIdlePhases();node.tick(0,suspended:false,viewportCenter:0)
        node.paintCollectionPreview(seconds:0)
        if identity.id=="flower" {
            // Three overlapping four-grain bursts; one selected-scene clock.
            for index in 0..<12 {
                let grain=SKShapeNode(ellipseOf:CGSize(width:8,height:4))
                grain.fillColor=[UIColor(red:1,green:241/255,blue:107/255,alpha:1),UIColor(red:1,green:226/255,blue:70/255,alpha:1),UIColor(red:1,green:206/255,blue:52/255,alpha:1)][index%3]
                grain.strokeColor = .clear;grain.zPosition=8;grain.alpha=0
                node.addChild(grain);pollen.append(grain)
            }
        }
        bodyRect=node.collectionBodyBounds(normalizedBounds:referenceBounds)
        if identity.id=="cubero" {bodyRect=node.collectionBodyBounds}
        // Modal spacing follows the visible body; motion/effect tails do not grow the card.
        presentationRect=bodyRect
        if identity.id=="beach-ball",let bottom=textures.lowestSheetBodyBottom(.ball),let top=textures.highestSheetBodyTop(.ball) {
            let sheet=NativeDiceSheet.ball
            let ground=(1-sheet.anchor.y-bottom)*sheet.cell.height*sheet.displayScale+sheet.offsetY
            let high=(1-sheet.anchor.y-top)*sheet.cell.height*sheet.displayScale+sheet.offsetY
            groundedBodyY=ground;highestBodyY=high
            presentationRect=CGRect(x:bodyRect.minX,y:ground,width:bodyRect.width,height:high-ground)
        }
        layoutArtwork()
        if identity.id=="fish" {
            let owner=NativeFishIdleOwner(resourceRoot:resourceRoot,preferOriginalSVG:true,minimumPaintInterval:0,svgPlaybackRate:1.625);fishOwner=owner
            owner.frame=bounds;addSubview(owner)
            owner.onPrepared={[weak self] _,_ in
                guard let self,!self.disposed else{return}
                self.dieNode?.prepareFishMediaPhase();self.paintFish(force:true)
            }
            owner.onMediaReady={[weak self] _,_,available in
                guard let self,!self.disposed else{return}
                self.dieNode?.setFishMediaReady(available)
                if available,!self.ready {self.markReady()}
            }
            paintFish(force:true)
        }else{markReady()}
    }
    private func markReady(){guard !disposed,!ready else{return};ready=true;layoutArtwork();if !active {fishOwner?.setSuspended(true)};onReady?()}
    private func paintFish(force:Bool=false){
        guard !disposed,let node=dieNode,let owner=fishOwner,
              let frame=node.fishFrame(in:canvas,visible:true) else{return}
        owner.paint([node.tileID:frame],generation:1,force:force)
    }
    func layoutArtwork(){
        guard !disposed,let node=dieNode,bodyRect.height>0 else{return}
        canvas.size=bounds.size
        let slot=artworkFrame ?? bounds.insetBy(dx:0,dy:48)
        let targetHeight=max(0,slot.height)
        let scale=targetHeight/presentationRect.height
        node.setScale(scale)
        node.position=CGPoint(x:slot.midX-bodyRect.midX*scale,y:bounds.height-slot.midY-presentationRect.midY*scale)
        fishOwner?.frame=bounds;paintFish(force:true)
    }
    override func layoutSubviews(){super.layoutSubviews();layoutArtwork()}
    func setActive(_ value:Bool,retainMediaUntilDisposal:Bool=false){
        guard !disposed else{return};active=value;lastTime=nil
        if value,ready {
            if scene == nil {presentScene(canvas)}
            isPaused=UIAccessibility.isReduceMotionEnabled
        }else{isPaused=true}
        if value || !retainMediaUntilDisposal {fishOwner?.setSuspended(!value)}

        dieNode?.reconcileSourceIdleBubbleVisibility()
    }
    private func advance(_ time:TimeInterval){
        guard active,ready,!disposed,!UIAccessibility.isReduceMotionEnabled else{return}
        let delta=lastTime.map{min(1.0/15,max(0,time-$0))} ?? 0;lastTime=time
        textures.advanceIdlePhases()
        dieNode?.tick(delta*(identity.id=="bee" ? 0.4356:1),suspended:false,viewportCenter:canvas.size.width/2,
                      beeFrameOrder:identity.id=="bee" ? [1,2,4,3]:nil)
        previewElapsed+=delta
        dieNode?.paintCollectionPreview(seconds:previewElapsed)
        for (index,grain) in pollen.enumerated() {
            let birth=Double(index/4)*0.76
            let age=(previewElapsed-birth).truncatingRemainder(dividingBy:2.28)
            guard age>=0,age<2 else{grain.alpha=0;continue}
            let p=age/2,side=Double(index%4)-1.5
            grain.position=CGPoint(x:bodyRect.midX+side*22*p+sin(p*2 * .pi+Double(index))*8*sin(.pi*p),y:bodyRect.midY+2+16*sin(.pi*p)-side*6*p)
            grain.zRotation=side*0.4+p*side
            grain.alpha=0.8*min(1,p/0.16)*min(1,(1-p)/0.28)
        }
        paintFish()
    }
    func dispose(){
        guard !disposed else{return};disposed=true;active=false;isPaused=true;onReady=nil
        fishOwner?.dispose();fishOwner=nil;pollen.removeAll();dieNode?.dispose();dieNode=nil
        canvas.owner=nil;canvas.removeAllChildren();presentScene(nil);textures.dispose()
    }
}
