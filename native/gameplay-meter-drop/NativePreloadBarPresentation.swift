import SpriteKit
import UIKit

/// Production preload artwork. Canonical NativeWildMeterHUDOwner owns charge,
/// consumption and smoke. The existing Scene HUD action samples this finite
/// presentation; no independent clock, atlas, physics or gameplay state.
@MainActor final class NativePreloadBarPresentation {
    enum Phase {case idle,arriving,boardLeaving,gone}
    let container=SKNode()
    private let dividerResourceRoot:URL?
    private let reducedMotion:@MainActor ()->Bool
    private let initiallyPad:Bool
    private var isPad:Bool {initiallyPad || container.scene.map{NativeTabletLayout.applies($0.size)} == true}
    private var closed=false,time=0.0,phaseAt=0.0,boardEnd=0.0,maximum=0.0
    private(set) var phase=Phase.idle
    var visualMaximum:Double{maximum}
    var onMotionChanged:((Bool)->Void)?
    private var reportedMotion=false
    private func reportMotion(){
        let active = !closed && (phase == .arriving || phase == .boardLeaving)
        guard active != reportedMotion else{return};reportedMotion=active;onMotionChanged?(active)
    }
    private let homeDivider=SKSpriteNode(),dividerMotionRoot=SKNode()
    private struct ChromePose {
        var barY=0.0,barScaleX=1.0,barScaleY=1.0,barAlpha=1.0,reveal=1.0,dividerY=0.0,dividerScale=1.0,dividerAlpha=1.0
    }
    private var chromePose=ChromePose(),exitChromePose=ChromePose()
    private var restartChrome=false
    static let hudExitLead=0.05
    private static var barMotionDuration:Double{JimiV9ArchedNavigationTitle.elementDuration+2*JimiV9ArchedNavigationTitle.elementStagger}
    // Keep the early board/HUD arrival clear; divider joins the stationary mask reveal.
    private static var barEntryDelay:Double{JimiV9ArchedNavigationTitle.elementDuration}
    static let entryFillDuration=0.64
    static func holderEntryDuration(reduced:Bool=false,restart:Bool=false)->Double {
        if reduced{return JimiV9ArchedNavigationTitle.reducedDuration(entering:true)}
        return (restart ? 0:barEntryDelay)+barMotionDuration
    }
    static func chromeDuration(entering:Bool,reduced:Bool=false,restart:Bool=false)->Double {
        if reduced{return JimiV9ArchedNavigationTitle.reducedDuration(entering:entering)}
        if entering{return holderEntryDuration(restart:restart)+entryFillDuration}
        if restart{return barMotionDuration/1.3}
        return hudExitLead+3*JimiV9ArchedNavigationTitle.elementStagger+JimiV9ArchedNavigationTitle.elementDuration
    }
    private let holderShader=SKShader(source:"""
        void main() {
            float x=v_tex_coord.x*u_span-u_pad;
            float y=v_tex_coord.y*u_height-u_pad;
            float u=clamp(x/u_width,0.0,1.0);
            float dy=clamp(y-u_center-u_arch*(1.0-4.0*u*(1.0-u)),-u_radius,u_radius);
            float cap=sqrt(max(0.0,u_radius*u_radius-dy*dy))-u_radius;
            float edge=u_reveal+cap;
            float reveal=1.0-smoothstep(edge-u_feather,edge+u_feather,x);
            gl_FragColor=texture2D(u_texture,v_tex_coord)*(reveal*u_reveal_on)*v_color_mix.a;
        }
        """)
    // Canonical charge and the existing finite
    // Source lease still own progress, entry, exit and interruption.
    private let liquidRoot=SKCropNode()
    private let liquidHolderArt=SKSpriteNode(),liquidPaint=SKSpriteNode()
    private let liquidShader=SKShader(source:"""
        void main() {
            vec4 art=texture2D(u_texture,v_tex_coord);
            float x=v_tex_coord.x*u_span-u_pad;
            float y=v_tex_coord.y*u_height-u_pad;
            float u=clamp(x/u_width,0.0,1.0);
            float dy=clamp(y-u_center-u_arch*(1.0-4.0*u*(1.0-u)),-u_radius,u_radius);
            float cap=sqrt(max(0.0,u_radius*u_radius-dy*dy))-u_radius;
            // Fixed semicircular tip, matching the rounded start of the ribbon.
            float edge=u_right+cap;
            float a=smoothstep(u_left-u_feather,u_left+u_feather,x);
            float b=1.0-smoothstep(edge-u_feather,edge+u_feather,x);
            float revealEdge=u_reveal+cap;
            float reveal=1.0-smoothstep(revealEdge-u_feather,revealEdge+u_feather,x);
            gl_FragColor=art*(a*b*u_visible*reveal*u_reveal_on)*v_color_mix.a;
        }
        """)
    private let liquidBoundary=SKShapeNode()
    private var liquidSize = -1.0
    private var liquidIsPad:Bool?
    private var nativeLeft=0.0,nativeRight=0.0

    init(isPad:Bool=false,dividerResourceRoot:URL?=nil,
         reducedMotion:@escaping @MainActor ()->Bool={UIAccessibility.isReduceMotionEnabled}){
        initiallyPad=isPad;self.dividerResourceRoot=dividerResourceRoot;self.reducedMotion=reducedMotion
        container.name="native-preload-bar";container.zPosition=6000
        homeDivider.name="native-preload-divider";homeDivider.anchorPoint=CGPoint(x:0.5,y:1)
        homeDivider.isHidden=true;dividerMotionRoot.zPosition = -3
        container.addChild(dividerMotionRoot);dividerMotionRoot.addChild(homeDivider)
        liquidRoot.zPosition = -4;container.addChild(liquidRoot)
        liquidRoot.maskNode=liquidBoundary;liquidRoot.addChild(liquidHolderArt);liquidRoot.addChild(liquidPaint)
        liquidBoundary.fillColor = .white;liquidBoundary.strokeColor = .clear;liquidBoundary.lineWidth=0
        liquidShader.uniforms=["u_span","u_height","u_pad","u_left","u_right","u_center","u_feather","u_visible","u_reveal","u_reveal_on","u_width","u_arch","u_radius"].map{SKUniform(name:$0,float:0)}
        liquidPaint.shader=liquidShader
        holderShader.uniforms=["u_span","u_height","u_pad","u_center","u_feather","u_reveal","u_reveal_on","u_width","u_arch","u_radius"].map{SKUniform(name:$0,float:0)}
        liquidHolderArt.shader=holderShader
    }
    private static var dividerCache:(root:URL,width:CGFloat,density:CGFloat,texture:SKTexture)?
    private var dividerFactor:Double {
        let fitted=maximum/(390*0.88)
        return isPad ? max(fitted,(container.scene?.size.width ?? 0)/390):fitted
    }
    private func configureHomeDivider(){
        guard let root=dividerResourceRoot,maximum>0 else{homeDivider.isHidden=true;return}
        let factor=CGFloat(dividerFactor),width=390*factor,density=UIScreen.main.scale
        let texture:SKTexture
        if let cached=Self.dividerCache,cached.root==root,cached.width==width,cached.density==density {texture=cached.texture}
        else {
            let suffix=density>=3 ? "@3x":density>=2 ? "@2x":""
            guard let source=UIImage(contentsOfFile:root.appendingPathComponent("assets/home-shadow\(suffix).png").path) else{return}
            let paper=UIImage(contentsOfFile:root.appendingPathComponent("assets/hud/preload-navigation-paper.png").path)
            let format=UIGraphicsImageRendererFormat();format.scale=density;format.opaque=false
            let output=UIGraphicsImageRenderer(size:CGSize(width:width,height:180*factor),format:format).image { renderer in
                let c=renderer.cgContext;c.scaleBy(x:factor,y:factor)
                // Exact editor layer transforms; original PNG edge and lower fade stay separate.
                for (w,depth,dy,alpha,shadow,bg) in [(585.0,20.316499474725255,4.785687021114455,1.0,0.63,0.17)] {
                    let left=(390-w)/2.0,baseline=91.104
                    c.saveGState();c.translateBy(x:196.08730046562923,y:dy+baseline);c.scaleBy(x:0.86,y:0.86);c.translateBy(x:-195,y:-baseline)
                    if bg>0,let paper {
                        c.saveGState();let path=UIBezierPath();path.move(to:CGPoint(x:left,y:0));path.addLine(to:CGPoint(x:left+w,y:0));path.addLine(to:CGPoint(x:left+w,y:baseline));path.addQuadCurve(to:CGPoint(x:left,y:baseline),controlPoint:CGPoint(x:195,y:baseline+2*depth));path.close();path.addClip()
                        paper.draw(in:CGRect(x:left,y:0,width:w,height:baseline+depth),blendMode:.normal,alpha:bg);c.restoreGState()
                    }
                    for slice in 0..<64 {
                        let x0=w*Double(slice)/64,x1=w*Double(slice+1)/64
                        let drop:(Double)->Double={x in 4*depth*(x/w)*(1-x/w)}
                        let y0=drop(x0),slope=(drop(x1)-y0)/(x1-x0)
                        c.saveGState();c.clip(to:CGRect(x:left+x0,y:baseline,width:x1-x0,height:49+depth))
                        c.translateBy(x:left,y:baseline);c.concatenate(CGAffineTransform(a:1,b:slope,c:0,d:1,tx:0,ty:y0-slope*x0))
                        for (top,h,a) in [(0.0,2.0,alpha),(2.0,47.0,alpha*shadow)] {
                            c.saveGState();c.clip(to:CGRect(x:0,y:top,width:w,height:h));source.draw(in:CGRect(x:w*0.1,y:0,width:w*0.8,height:49),blendMode:.normal,alpha:a);c.restoreGState()
                        }
                        c.restoreGState()
                    }
                    c.restoreGState()
                }
            }
            texture=SKTexture(image:output);texture.filteringMode = .linear;Self.dividerCache=(root,width,density,texture)
        }
        homeDivider.texture=texture;homeDivider.size=CGSize(width:width,height:180*factor)
        homeDivider.position=CGPoint(x:maximum/2,y:107.06736002185303*Double(factor)+ribbonOffsetY)
        homeDivider.alpha=1;homeDivider.isHidden=phase == .gone
    }
    private var archDepth:Double {7.968183591401909*maximum/(390*0.88)}
    // Keep the accepted tablet meter centre and board reservation. Only the
    // ribbon ends rise with the shared arch; the divider follows the same origin.
    private var ribbonOffsetY:Double {isPad ? -5-tabletHeight/2:0}
    // Canonical NativeWildMeterHUDOwner supplies every painted gain/drain/refill
    // sample. This surface owns only art/geometry and board lifecycle opacity.
    func setNativeFill(left:Double,width:Double,maximum:Double){
        guard !closed else{return};let span=max(1,maximum)
        nativeLeft=max(0,min(1,left/span));nativeRight=max(nativeLeft,min(1.05,(left+width)/span))
        paint()
    }
    var barCenterY:Double {isPad ? -5:8.750637429882714/2*maximum/(390*0.88)}
    var lifecycleReveal:Double{chromePose.reveal}
    private var exitLiquidFraction=1.0
    var liquidFillFraction:Double {
        if phase == .gone{return 0}
        if phase == .boardLeaving{return exitLiquidFraction}
        guard phase == .arriving,!reducedMotion() else{return 1}
        let age=max(0,time-phaseAt)-Self.holderEntryDuration(restart:restartChrome)
        let t=Self.unit(age/Self.entryFillDuration)
        return 1-pow(1-t,3)
    }
    var smokeAdmitted:Bool{phase != .gone && chromePose.barAlpha>0.01 && chromePose.reveal>0 && liquidFillFraction>0}
    func smokePoint(atX x:Double,in stage:SKNode)->CGPoint{liquidRoot.convert(CGPoint(x:x,y:barCenterY),to:stage)}
    private static let liquidStartColor=color(0xEA8B57),liquidEndColor=color(0xE7744A)
    func smokeColor(_ point:CGPoint,in stage:SKNode)->UIColor{
        let local=liquidRoot.convert(point,from:stage),u=CGFloat(Self.unit(Double(local.x)/max(1,maximum)))
        var r0:CGFloat=0,g0:CGFloat=0,b0:CGFloat=0,a0:CGFloat=0
        var r1:CGFloat=0,g1:CGFloat=0,b1:CGFloat=0,a1:CGFloat=0
        Self.liquidStartColor.getRed(&r0,green:&g0,blue:&b0,alpha:&a0)
        Self.liquidEndColor.getRed(&r1,green:&g1,blue:&b1,alpha:&a1)
        return UIColor(red:r0+(r1-r0)*u,green:g0+(g1-g0)*u,blue:b0+(b1-b0)*u,alpha:0.5)
    }
    func smokeBaseline(in stage:SKNode)->CGPoint{smokePoint(atX:0,in:stage)}
    func smokeCurveOffset(_ point:CGPoint,in stage:SKNode)->CGPoint{
        let local=liquidRoot.convert(point,from:stage),u=Self.unit(Double(local.x)/max(1,maximum)),dy=archDepth*(1-4*u*(1-u))
        let a=liquidRoot.convert(CGPoint.zero,to:stage),b=liquidRoot.convert(CGPoint(x:0,y:dy),to:stage)
        return CGPoint(x:b.x-a.x,y:b.y-a.y)
    }
    private func paintLiquid(){
        guard maximum>0 else{return}
        let factor=maximum/(390*0.88),h=isPad ? tabletHeight:8.750637429882714*factor,w=maximum,pad=2.0*factor,artHeight=archDepth+h+pad*2
        if liquidSize != maximum || liquidIsPad != isPad {
            liquidSize=maximum;liquidIsPad=isPad
            let center=CGMutablePath()
            for i in 0...128 {let x=h/2+(w-h)*Double(i)/128,u=x/w,p=CGPoint(x:x,y:archDepth*(1-4*u*(1-u))+h/2);if i==0{center.move(to:p)}else{center.addLine(to:p)}}
            let ribbon=center.copy(strokingWithWidth:h,lineCap:.round,lineJoin:.round,miterLimit:1)
            liquidBoundary.path=CGPath(rect:CGRect(x:-20,y:-100,width:w+40,height:200),transform:nil)
            let format=UIGraphicsImageRendererFormat();format.scale=max(3,UIScreen.main.scale);format.opaque=false
            func texture(filled:Bool)->SKTexture {
                let image=UIGraphicsImageRenderer(size:CGSize(width:w+pad*2,height:artHeight),format:format).image{r in
                    let c=r.cgContext;c.setShouldAntialias(true);c.setAllowsAntialiasing(true);c.interpolationQuality = .high
                    c.translateBy(x:pad,y:artHeight-pad);c.scaleBy(x:1,y:-1);c.addPath(ribbon);c.clip()
                    if filled {
                        // Exactly two colors. No gloss, dark bevel or shadow.
                        let colors=[Self.liquidStartColor.cgColor,Self.liquidEndColor.cgColor] as CFArray
                        if let g=CGGradient(colorsSpace:CGColorSpaceCreateDeviceRGB(),colors:colors,locations:[0,1]){c.drawLinearGradient(g,start:.zero,end:CGPoint(x:w,y:0),options:[.drawsBeforeStartLocation,.drawsAfterEndLocation])}
                    }else{c.setFillColor(Self.color(0xF0E0D3).cgColor);c.fill(CGRect(x:-pad,y:-pad,width:w+pad*2,height:artHeight))}
                }
                let t=SKTexture(image:image);t.filteringMode = .linear;return t
            }
            liquidHolderArt.texture=texture(filled:false);liquidPaint.texture=texture(filled:true)
            for node in [liquidHolderArt,liquidPaint]{node.size=CGSize(width:w+pad*2,height:artHeight);node.anchorPoint = .zero;node.position=CGPoint(x:-pad,y:(isPad ? -5-h/2:0)-pad)}
            for (name,value) in [("u_span",w+pad*2),("u_height",artHeight),("u_pad",pad),("u_center",h/2),("u_feather",0.75/Double(UIScreen.main.scale))]{liquidShader.uniformNamed(name)?.floatValue=Float(value)}
            for (name,value) in [("u_span",w+pad*2),("u_height",artHeight),("u_pad",pad),("u_center",h/2),("u_feather",0.75/Double(UIScreen.main.scale))]{holderShader.uniformNamed(name)?.floatValue=Float(value)}
            for shader in [holderShader,liquidShader]{for (name,value) in [("u_width",w),("u_arch",archDepth),("u_radius",h/2)]{shader.uniformNamed(name)?.floatValue=Float(value)}}
        }
        let paintedRight=nativeLeft+(nativeRight-nativeLeft)*liquidFillFraction
        liquidShader.uniformNamed("u_left")?.floatValue=Float(w*nativeLeft-pad)
        liquidShader.uniformNamed("u_right")?.floatValue=Float(paintedRight>=1 ? w+h/2+pad:w*paintedRight)
        liquidShader.uniformNamed("u_visible")?.floatValue=paintedRight>nativeLeft ? 1:0
        liquidRoot.isHidden=phase == .gone
        // Whole-surface lifecycle is sampled with HUD elapsed, below.
    }
    private func paintChrome(){
        let factor=maximum/(390*0.88),elapsed=max(0,time-phaseAt),entering=phase == .arriving,leaving=phase == .boardLeaving
        var p=ChromePose()
        if phase == .gone {p.barAlpha=0;p.dividerAlpha=restartChrome ? 1:0;p.reveal=0}
        else if entering || leaving {
            let duration=max(0.001,entering ? Self.holderEntryDuration(reduced:reducedMotion(),restart:restartChrome):boardEnd),t=Self.unit(elapsed/duration)
            if restartChrome {
                let u=entering ? t:1-t
                p.reveal=u*u*(3-2*u)
                // Restart keeps the divider fixed while only the ribbon mask
                // leaves/arrives. It is the shared old/new board anchor.
                if leaving {p.reveal *= exitChromePose.reveal}
            }else if reducedMotion(){
                let a=entering ? t:1-t;p.barAlpha=a;p.dividerAlpha=a;p.reveal=entering ? 1:exitChromePose.reveal
            }else{
                let delay=entering ? Self.barEntryDelay:0
                // Exit starts before HUD and moves at1.30x the former bar speed.
                let travel=Self.barMotionDuration/(entering ? 1:1.3)
                let u=Self.unit((elapsed-delay)/travel),sampleTime=entering ? u:1-u
                p.reveal=sampleTime*sampleTime*(3-2*sampleTime)
                // Entry reveals the final-size bar in place: no competing travel,
                // scale or settling bounce while the mask unrolls.
                if leaving {
                    let sample=JimiV9Motion.worldHubElementEnter().pose(at:0.56*sampleTime)
                    p.barY=sample.y*factor;p.barScaleY=sample.scaleY
                    p.barAlpha=1-Self.unit((u-0.85)/0.15)
                    let tail=Self.unit((u-0.68)/0.32),spring=sin(tail*Double.pi*4)*pow(1-tail,2)
                    p.barScaleX=1+0.045*spring;p.barScaleY *= 1-0.12*spring;p.barY+=2.5*factor*spring
                }
                let navDelay=entering ? Self.barEntryDelay:Self.hudExitLead+JimiV9ArchedNavigationTitle.backgroundExitDelay
                let navU=Self.unit((elapsed-navDelay)/JimiV9ArchedNavigationTitle.elementDuration)
                let nav=JimiV9Motion.Ease.backOut(1.7).value(entering ? navU:1-navU)
                // Divider joins the mask reveal with a larger damped spring:
                // lift above the anchor, rebound below it, then settle exactly.
                // Reuse the finite bar clock; exit retains its authored back-out.
                p.dividerY = entering ? -16*cos(3*Double.pi*u)*pow(1-u,3):14.4*factor*(1-nav)
                p.dividerScale=1+0.025*pow(sin(Double.pi*navU),2)
                p.dividerAlpha=entering ? navU*navU*(3-2*navU):Self.unit(nav)
            }
            if leaving && !restartChrome {
                p.barY+=exitChromePose.barY;p.barScaleX*=exitChromePose.barScaleX;p.barScaleY*=exitChromePose.barScaleY;p.barAlpha*=exitChromePose.barAlpha;p.reveal*=exitChromePose.reveal
                p.dividerY+=exitChromePose.dividerY;p.dividerScale*=exitChromePose.dividerScale;p.dividerAlpha*=exitChromePose.dividerAlpha
            }
        }
        chromePose=p
        liquidRoot.position=CGPoint(x:0,y:(1-p.barScaleY)*barCenterY+p.barY);liquidRoot.xScale=p.barScaleX;liquidRoot.yScale=p.barScaleY;liquidRoot.alpha=p.barAlpha
        let pivot=CGPoint(x:maximum/2,y:-6.294517126410022*dividerFactor+ribbonOffsetY)
        dividerMotionRoot.setScale(p.dividerScale);dividerMotionRoot.position=CGPoint(x:(1-p.dividerScale)*pivot.x,y:(1-p.dividerScale)*pivot.y+p.dividerY);dividerMotionRoot.alpha=p.dividerAlpha
        let edge=p.reveal>=1 ? maximum+barCenterY+4:maximum*p.reveal
        for shader in [holderShader,liquidShader]{shader.uniformNamed("u_reveal")?.floatValue=Float(edge);shader.uniformNamed("u_reveal_on")?.floatValue=p.reveal>0 ? 1:0}
    }
    func paintBoardEntry(_ elapsed:Double){
        guard !closed,phase == .arriving else{return};time=phaseAt+max(0,elapsed)
        if elapsed>=boardEnd{phase = .idle};paint()
    }
    private var tabletHeight=10.0
    static func unit(_ v:Double)->Double{min(1,max(0,v))}
    private static func color(_ hex:Int)->UIColor{UIColor(red:CGFloat((hex>>16)&255)/255,green:CGFloat((hex>>8)&255)/255,blue:CGFloat(hex&255)/255,alpha:1)}
    func resize(maximum:Double,barHeight:CGFloat){
        guard !closed else{return};self.maximum=max(0,maximum)
        if tabletHeight != Double(barHeight){tabletHeight=Double(barHeight);liquidSize = -1}
        configureHomeDivider();paint()
    }
    private func paint(){
        guard !closed else{return}
        homeDivider.isHidden=dividerResourceRoot==nil || phase == .gone && !restartChrome
        paintLiquid();paintChrome();reportMotion()
    }
    func primeBoardEntry(restart:Bool=false){
        guard !closed else{return};restartChrome=restart;phase = .gone
        // A replacement's first paint already contains the stationary divider;
        // only the ribbon remains hidden until its existing HUD entry track.
        container.isHidden = !restart;paint()
    }
    func beginBoardEntry(restart:Bool=false){
        guard !closed else{return};restartChrome=restart;container.isHidden=false;phase = .arriving
        phaseAt=time;boardEnd=Self.chromeDuration(entering:true,reduced:reducedMotion(),restart:restart);paint()
    }
    func beginBoardExit(restart:Bool=false)->Double{
        guard !closed else{return 0};exitLiquidFraction=liquidFillFraction;restartChrome=restart;exitChromePose=chromePose;phaseAt=time
        boardEnd=Self.chromeDuration(entering:false,reduced:reducedMotion(),restart:restart);phase = .boardLeaving
        paint();return boardEnd
    }
    func paintBoardExit(_ elapsed:Double){
        guard !closed,phase == .boardLeaving else{return};time=phaseAt+max(0,elapsed)
        if elapsed>=boardEnd{phase = .gone};paint()
    }
    func cancelBoardExit(){guard !closed else{return};container.isHidden=false;phase = .idle;paint()}
    func dispose(){
        guard !closed else{return};closed=true;reportMotion();onMotionChanged=nil
        container.removeAllChildren();container.removeFromParent()
    }
    isolated deinit {container.removeFromParent()}
}
