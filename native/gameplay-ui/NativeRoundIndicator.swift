import SpriteKit
import UIKit
import StackToSixGameplay

/// Source DOM Round pill is Arcade-only and sits outside the shaken Pixi HUD.
/// SpriteKit owns these finite actions through the visible board's lifecycle.
@MainActor
final class NativeRoundIndicator:SKNode {
    private let painted=SKNode(),content=SKNode(),label=SKLabelNode(),paper=SKSpriteNode(),lines=SKShapeNode()
    private let artwork:JimiV9Artwork?
    private var paperSurface:NativeSettingsPaperSurface?
    private var paperSize=CGSize.zero
    private static let tabletScale:CGFloat=1.4
    private let lineHeight:CGFloat
    private let captionFont:UIFont
    private var captionText:String?,captionScale:CGFloat=0
    private var round:Int?
    private var sourceDividerMaskLeases=Set<UUID>()
    var sourceDividerMaskCount:Int {sourceDividerMaskLeases.count}
    var sourceDividerLinesHidden:Bool {lines.isHidden}
    func beginSourceBackpackDividerMask()->(()->Void) {
        let id=UUID();sourceDividerMaskLeases.insert(id);lines.isHidden=true
        return { [weak self] in
            guard let self,self.sourceDividerMaskLeases.remove(id) != nil else{return}
            self.lines.isHidden = !self.sourceDividerMaskLeases.isEmpty
        }
    }
    init(font:UIFont,artwork:JimiV9Artwork?=nil) {
        self.artwork=artwork
        lineHeight=font.lineHeight
        captionFont=artwork?.font(size:17,weight:"ExtraBold") ?? font.withSize(17)
        super.init()
        name="native-game-round-indicator";zPosition=10001
        label.name="native-game-round-label"
        label.fontName=captionFont.fontName;label.fontSize=17;label.verticalAlignmentMode = .center
        label.fontColor=NativeTextPalette.modalTitle
        paper.name="native-game-round-paper";paper.alpha=0.63;paper.zPosition = -1
        lines.strokeColor=UIColor(red:237/255,green:224/255,blue:213/255,alpha:1);lines.lineWidth=2
        addChild(painted);painted.addChild(lines);painted.addChild(content);content.addChild(paper);content.addChild(label)
    }
    required init?(coder:NSCoder){fatalError("Use preserved source font")}
    /// Preserve the phone's visible bottom gap when the complete pill grows.
    func restCenter(_ base:CGPoint,viewport:CGSize,arcade:Bool)->CGPoint {
        guard arcade,NativeTabletLayout.applies(viewport) else{return base}
        return CGPoint(x:base.x,y:base.y+(lineHeight+10)*(Self.tabletScale-1)/2)
    }
    func synchronize(round:Int,arcade:Bool,viewport:CGSize,alpha:CGFloat,variant:NativeArcadeVariant = .endurance) {
        isHidden = !arcade
        guard arcade else {painted.removeAllActions();content.removeAllActions();return}
        let changed=self.round != nil && self.round != round;self.round=round
        let scale=NativeTabletLayout.applies(viewport) ? Self.tabletScale:1
        let prefix="\(variant.title) - ",text=prefix+NativeScoreDisplay.padded(max(1,round))
        if text != captionText || scale != captionScale {
            captionText=text;captionScale=scale
            let copy=NSMutableAttributedString(string:text,attributes:[.font:captionFont.withSize(17*scale),.foregroundColor:NativeTextPalette.modalTitle])
            copy.addAttribute(.foregroundColor,value:UIColor(red:231/255,green:116/255,blue:73/255,alpha:1),range:NSRange(location:(prefix as NSString).length,length:(text as NSString).length-(prefix as NSString).length))
            label.attributedText=copy
        }
        let width=label.frame.width+122*scale,height=(lineHeight+10)*scale
        updatePaper(size:CGSize(width:width,height:height),scale:scale)
        let path=CGMutablePath(),edge=viewport.width/2-23
        if edge>width/2+24*scale {
            path.move(to:CGPoint(x:-edge,y:2));path.addLine(to:CGPoint(x:-width/2-24*scale,y:2))
            path.move(to:CGPoint(x:width/2+24*scale,y:2));path.addLine(to:CGPoint(x:edge,y:2))
        }
        lines.path=path;self.alpha=alpha
        if changed,painted.action(forKey:"round-enter")==nil {
            painted.removeAllActions();painted.position = .zero;painted.alpha=1
            content.removeAllActions();content.setScale(0.88);content.position.y = -6
            content.run(.sequence([
                .group([NativeBoardMotion.scale(from:CGPoint(x:0.88,y:0.88),to:CGPoint(x:1.13,y:1.13),duration:0.2,ease:.backOut(2.2)),
                        NativeBoardMotion.move(from:CGPoint(x:0,y:-6),to:CGPoint(x:0,y:4),duration:0.2,ease:.backOut(2.2))]),
                .group([NativeBoardMotion.scale(from:CGPoint(x:1.13,y:1.13),to:CGPoint(x:1,y:1),duration:0.16,ease:.power2Out),
                        NativeBoardMotion.move(from:CGPoint(x:0,y:4),to:.zero,duration:0.16,ease:.power2Out)])
            ]),withKey:"round-value")
        }
    }
    /// One size-cached still from the existing paper renderer. No hidden Journey
    /// preparation or per-frame raster work; text/dividers keep their own opacity.
    private func updatePaper(size:CGSize,scale:CGFloat) {
        guard size != paperSize else{return}
        paperSize=size;paper.size=size
        guard let artwork else{return}
        let surface:NativeSettingsPaperSurface
        if let paperSurface {surface=paperSurface}
        else {
            surface=NativeSettingsPaperSurface(image:artwork.image("assets/modals/paper.png",densityAware:true))
            surface.renew(crop:0.5,mirrored:false,seed:0x524F554E44)
            surface.edgeDetailScale=0.4;surface.circularCorners=true
            paperSurface=surface
        }
        surface.cornerRadius=12*scale
        surface.bounds=CGRect(origin:.zero,size:size);surface.layoutIfNeeded()
        let format=UIGraphicsImageRendererFormat();format.scale=UIScreen.main.scale;format.opaque=false
        let image=UIGraphicsImageRenderer(bounds:surface.bounds,format:format).image{renderer in
            surface.layer.render(in:renderer.cgContext)
            renderer.cgContext.saveGState()
            renderer.cgContext.addPath(surface.outline);renderer.cgContext.clip()
            drawPaperFolds(in:renderer.cgContext,size:size)
            renderer.cgContext.restoreGState()
        }
        paper.texture=SKTexture(image:image);paper.texture?.filteringMode = .linear
    }
    /// Soft tapered light/shade ridges are baked into the one cached paper still.
    /// Keep the central caption quiet; stronger folds sit near the paper edges.
    private func drawPaperFolds(in context:CGContext,size:CGSize) {
        let folds:[(CGPoint,CGPoint,CGFloat)]=[
            (.init(x:0,y:0.8),.init(x:0.17,y:0.3),1),
            (.init(x:0.08,y:0.05),.init(x:0.18,y:0.58),0.8),
            (.init(x:0.16,y:0.9),.init(x:0.32,y:0.15),0.5),
            (.init(x:0.43,y:0),.init(x:0.49,y:0.4),0.3),
            (.init(x:0.58,y:0.65),.init(x:0.70,y:1),0.4),
            (.init(x:0.80,y:0.1),.init(x:0.91,y:0.85),0.8),
            (.init(x:0.87,y:0.8),.init(x:1,y:0.4),1)
        ]
        let space=CGColorSpaceCreateDeviceRGB()
        let fadeColors=[UIColor(white:1,alpha:0).cgColor,UIColor.white.cgColor,UIColor.white.cgColor,UIColor(white:1,alpha:0).cgColor]
        guard let fade=CGGradient(colorsSpace:space,colors:fadeColors as CFArray,locations:[0,0.25,0.7,1]) else{return}
        for (from,to,strength) in folds {
            let start=CGPoint(x:from.x*size.width,y:from.y*size.height)
            let dx=(to.x-from.x)*size.width,dy=(to.y-from.y)*size.height
            let length=hypot(dx,dy),spread=size.height*0.14
            let colors=[UIColor(white:1,alpha:0).cgColor,
                UIColor(red:0.57,green:0.39,blue:0.26,alpha:0.14*strength).cgColor,
                UIColor(white:1,alpha:0.25*strength).cgColor,UIColor(white:1,alpha:0).cgColor]
            guard let gradient=CGGradient(colorsSpace:space,colors:colors as CFArray,locations:[0,0.43,0.62,1]) else{continue}
            context.saveGState();context.translateBy(x:start.x,y:start.y);context.rotate(by:atan2(dy,dx))
            context.clip(to:CGRect(x:0,y:-spread,width:length,height:spread*2))
            // Isolate the ridge so its feathered ends never erase source paper.
            context.beginTransparencyLayer(auxiliaryInfo:nil)
            context.drawLinearGradient(gradient,start:.init(x:0,y:-spread),end:.init(x:0,y:spread),options:[])
            context.setBlendMode(.destinationIn)
            context.drawLinearGradient(fade,start:.zero,end:.init(x:length,y:0),options:[.drawsBeforeStartLocation,.drawsAfterEndLocation])
            context.endTransparencyLayer();context.restoreGState()
        }
    }

    func primeEntry(){painted.removeAllActions();painted.position.y = -72;painted.alpha=0}
    func enter(animated:Bool) {
        guard !isHidden else{return}
        if !animated,hasAnimatedPresentation {return}
        painted.removeAllActions()
        content.removeAllActions();content.position = .zero;content.setScale(1)
        guard animated else {painted.position = .zero;painted.alpha=1;return}
        painted.position.y = -72;painted.alpha=0
        painted.run(.customAction(withDuration:0.8){[weak self] _,time in
            guard let self else{return};let t=min(1,max(0,Double(time)/0.8))
            let p=Double(NativeBoardMotion.Ease.elasticOut(1,0.6).sample(CGFloat(t)))
            self.painted.position.y=CGFloat(-72*(1-p));self.painted.alpha=CGFloat(min(1,max(0,p)))
        },withKey:"round-enter")
    }
    static let exitDuration:TimeInterval=0.3
    func exit() {
        guard !isHidden else{return};painted.removeAllActions()
        let start=painted.position.y,alpha=painted.alpha
        painted.run(.customAction(withDuration:Self.exitDuration){[weak self] _,time in
            guard let self else{return};let t=min(1,max(0,CGFloat(time)/CGFloat(Self.exitDuration))),p=t*t*t
            self.painted.position.y=start+(-72-start)*p;self.painted.alpha=alpha*(1-p)
        },withKey:"round-exit")
    }
    var presentationReceipt:(offset:CGFloat,alpha:CGFloat,hidden:Bool,animating:Bool) {(painted.position.y,alpha*painted.alpha,isHidden,hasAnimatedPresentation)}
    var hasAnimatedPresentation:Bool {painted.hasActions() || content.hasActions()}
    func cancelExit(){painted.removeAllActions();content.removeAllActions();content.position = .zero;content.setScale(1);painted.position = .zero;painted.alpha=1}
}
