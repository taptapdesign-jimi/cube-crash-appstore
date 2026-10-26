import UIKit

/// Authored feedback owns pressed visuals, never UIKit's dark highlight.
@MainActor
final class JimiV9PlainButton: UIButton {
    static let modalIdleKey = "native-modal-cta-idle"
    private var hasModalIdle = false
    private var pairedModalCTA = false
    private var modalIdleSuspended = false
    private var observesModalIdle = false
    // Captured once per button. The existing idle sway adds at most 1.4°,
    // keeping the complete pose within the requested three-degree limit.
    private let ctaRestTiltDegrees = CGFloat.random(in:0...1.6) * (Bool.random() ? CGFloat(1):CGFloat(-1))
    private let modalIdleDirection = CGPoint(x:CGFloat.random(in:-6...6),y:CGFloat.random(in:4...8))
    private let modalIdleTilt = CGFloat.random(in:-1.4...1.4)
    private let modalIdlePhase = Double.random(in:0.35...0.65)
    private let modalIdleDuration = Double.random(in:3.4...4.6)
    override init(frame: CGRect) {
        super.init(frame:frame)
        adjustsImageWhenHighlighted = false
        showsTouchWhenHighlighted = false
    }
    required init?(coder: NSCoder) {
        super.init(coder:coder)
        adjustsImageWhenHighlighted = false
        showsTouchWhenHighlighted = false
    }
    /// UIKit rewrites its managed image alpha during layout/state updates.
    /// Keep authored modal artwork opacity separate from the button/paper alpha.
    var artworkOpacity:CGFloat? {
        didSet {if let artworkOpacity {imageView?.alpha=artworkOpacity};setNeedsLayout()}
    }
    private weak var tapFeedbackArtwork:UIView?
    private var artworkContactStarted=false
    func enableArtworkTapFeedback(on artwork:UIView?=nil) {
        tapFeedbackArtwork=artwork
        removeTarget(self,action:#selector(artworkContactBegan),for:.touchDown)
        removeTarget(self,action:#selector(artworkContactCancelled),for:[.touchCancel,.touchUpOutside])
        addTarget(self,action:#selector(artworkContactBegan),for:.touchDown)
        addTarget(self,action:#selector(artworkContactCancelled),for:[.touchCancel,.touchUpOutside])
    }
    @objc private func artworkContactBegan() {
        guard isEnabled,isUserInteractionEnabled,!isHidden else{return}
        artworkContactStarted=true
        NativeHubBackpackFeedback.play(on:tapFeedbackArtwork ?? imageView ?? self)
    }
    @objc private func artworkContactCancelled() {artworkContactStarted=false}
    func playArtworkTapFeedback() {
        // A long press may finish its bounce before release. Never replay it
        // behind the modal exit; programmatic/backdrop dismissal still gets feedback.
        if artworkContactStarted {artworkContactStarted=false;return}
        NativeHubBackpackFeedback.play(on:tapFeedbackArtwork ?? imageView ?? self)
    }
    private weak var cartoonSurface:NativeCartoonBounceSurface?
    var cartoonBounceLayoutView:UIView {cartoonSurface ?? self}
    var cartoonBounceFrame:CGRect {cartoonSurface?.frame ?? frame}
    /// Separate compositor shell: authored press/release/route transforms stay on the button.
    func enableCartoonBounce(){
        guard cartoonSurface==nil,let parent=superview else{return}
        let original=CGRect(origin:CGPoint(x:center.x-bounds.width/2,y:center.y-bounds.height/2),size:bounds.size)
        let surface=NativeCartoonBounceSurface();parent.insertSubview(surface,aboveSubview:self)
        removeFromSuperview();surface.addSubview(self);cartoonSurface=surface
        surface.isHidden=isHidden;setCartoonBounceFrame(original)
        addTarget(self,action:#selector(cartoonContact),for:.touchDown)
    }
    @objc private func cartoonContact(){
        guard isEnabled,isUserInteractionEnabled,!isHidden,let cartoonSurface else{return}
        NativeHubBackpackFeedback.play(on:cartoonSurface)
    }
    func setCartoonBounceFrame(_ rect:CGRect){
        guard let surface=cartoonSurface else{bounds=CGRect(origin:.zero,size:rect.size);center=CGPoint(x:rect.midX,y:rect.midY);return}
        surface.bounds=CGRect(origin:.zero,size:rect.size);surface.center=CGPoint(x:rect.midX,y:rect.midY);layoutCartoonContent()
    }
    func layoutCartoonContent(){guard let surface=cartoonSurface else{return};bounds=surface.bounds;center=CGPoint(x:bounds.midX,y:bounds.midY)}
    override var isHidden:Bool {didSet{cartoonSurface?.isHidden=isHidden;if isHidden{cartoonSurface?.layer.removeAnimation(forKey:NativeHubBackpackFeedback.animationKey)};updateModalCTAIdle();ctaShimmer?.refresh()}}
    override func didMoveToWindow(){super.didMoveToWindow();if window==nil{cartoonSurface?.layer.removeAnimation(forKey:NativeHubBackpackFeedback.animationKey)};updateModalCTAIdle();ctaShimmer?.rebindVisibility()}
    deinit {NotificationCenter.default.removeObserver(self)}
    @objc private func modalCTAWillResignActive(){layer.removeAnimation(forKey:Self.modalIdleKey)}
    @objc private func modalCTADidBecomeActive(){updateModalCTAIdle()}
    private func updateModalCTAIdle() {
        guard hasModalIdle,!modalIdleSuspended,window != nil,!isHidden,UIApplication.shared.applicationState == .active,
              !UIAccessibility.isReduceMotionEnabled else {layer.removeAnimation(forKey:Self.modalIdleKey);return}
        guard layer.animation(forKey:Self.modalIdleKey)==nil else{return}
        // The button owns its sculpted content; sublayerTransform leaves the
        // button's hit box, modal route and press/contact transforms untouched.
        let settled=CATransform3DMakeRotation(ctaRestTiltDegrees * .pi/180,0,0,1)
        let strength:CGFloat=pairedModalCTA ? 0.30:1
        // Keep the established small vertical drift while making sway visible.
        let verticalStrength:CGFloat=pairedModalCTA ? 0.15:1
        var peak=CATransform3DMakeTranslation(modalIdleDirection.x*strength,modalIdleDirection.y*verticalStrength,0)
        peak=CATransform3DRotate(peak,(ctaRestTiltDegrees+modalIdleTilt*strength) * .pi/180,0,0,1)
        peak=CATransform3DScale(peak,1+0.03*strength,1+0.03*strength,1)
        let idle=CAKeyframeAnimation(keyPath:"sublayerTransform")
        idle.values=[settled,peak,settled].map{NSValue(caTransform3D:$0)}
        idle.keyTimes=[0,NSNumber(value:modalIdlePhase),1]
        idle.duration=modalIdleDuration;idle.repeatCount = .infinity
        idle.timingFunctions=Array(repeating:CAMediaTimingFunction(controlPoints:0.42,0,0.58,1),count:2)
        layer.add(idle,forKey:Self.modalIdleKey)
    }
    /// Stacked actions use thirty percent sway/scale with fifteen percent vertical
    /// float, retaining the 1.2pt vertical drift bound without moving hit boxes.
    func setPairedModalCTA() {
        pairedModalCTA=true
        layer.removeAnimation(forKey:Self.modalIdleKey)
        updateModalCTAIdle()
    }
    func setModalCTAIdleSuspended(_ value:Bool) {
        modalIdleSuspended=value;updateModalCTAIdle()
    }
    private var ctaShimmer:NativeCTAShimmer?
    func setPrimaryCTAShimmer(_ enabled:Bool) {
        if enabled,let face=sculptedFace {
            if ctaShimmer==nil {ctaShimmer=NativeCTAShimmer(button:self,faceLayer:face.layer)}
            ctaShimmer?.layout()
        } else {ctaShimmer?.dispose();ctaShimmer=nil}
    }
    override var isEnabled:Bool {didSet{ctaShimmer?.refresh()}}
    var onSculptedFacePrepared:(()->Void)?
    var isSculptedFacePrepared:Bool {sculptedFace?.isPrepared ?? false}
    func setSculptedFacePreparationSuspended(_ value:Bool){sculptedFace?.setPreparationSuspended(value)}
    func retireSculptedFacePreparation(){sculptedFace?.retirePreparation()}
    /// Explicit visible-entry readiness; UIKit may have retired a face during
    /// reparenting without marking its unchanged geometry for another layout.
    func prepareSculptedFaceForEntrance() {
        setNeedsLayout();layoutIfNeeded();sculptedFace?.prepareForEntrance()
    }
    #if DEBUG
    var sculptedFacePreparationSnapshotForTesting:String {sculptedFace?.preparationSnapshotForTesting ?? "no-face"}
    func sculptedFaceRasterForTesting(original:Bool=false)->CGImage? {
        sculptedFace?.rasterForTesting(original:original)
    }
    #endif
    private var sculptedFace:NativeSculptedCTAFace?
    func applyPrimaryCTAStyle(artwork:JimiV9Artwork,shapeKey:String?=nil) {
        applySculptedCTAStyle(artwork:artwork,shapeKey:shapeKey,primary:true)
    }
    private func applySculptedCTAStyle(artwork:JimiV9Artwork,shapeKey:String?=nil,primary:Bool) {
        setBackgroundImage(nil,for:.normal);layer.borderWidth=0;layer.shadowPath=nil
        CATransaction.begin();CATransaction.setDisableActions(true)
        layer.sublayerTransform=CATransform3DMakeRotation(ctaRestTiltDegrees * .pi/180,0,0,1)
        CATransaction.commit()
        sculptedShapeKey=shapeKey
        backgroundColor = .clear
        if sculptedFace==nil {
            let face=NativeSculptedCTAFace();face.isUserInteractionEnabled=false
            face.backgroundColor = .clear;face.isOpaque=false
            face.accessibilityIdentifier="native.cta.sculpted-face"
            insertSubview(face,at:0);sculptedFace=face
        }
        sculptedFace?.secondary = !primary
        setPrimaryCTAShimmer(primary)
        titleLabel?.font=artwork.font(size:28,weight:"ExtraBold")
        setTitleColor(UIColor(red:1,green:246/255,blue:225/255,alpha:1),for:.normal)
        let font=artwork.font(size:28,weight:"ExtraBold")
        let cream=UIColor(red:1,green:246/255,blue:225/255,alpha:1)
        let title=title(for:.normal) ?? ""
        let glyphLight=UIGraphicsImageRenderer(size:CGSize(width:1,height:font.lineHeight)).image { renderer in
            let colors=[UIColor(red:1,green:252/255,blue:237/255,alpha:1).cgColor,
                cream.cgColor,UIColor(red:247/255,green:232/255,blue:206/255,alpha:1).cgColor]
            let gradient=CGGradient(colorsSpace:CGColorSpaceCreateDeviceRGB(),colors:colors as CFArray,locations:[0,0.52,1])!
            renderer.cgContext.drawLinearGradient(gradient,start:.zero,end:CGPoint(x:0,y:font.lineHeight),options:[])
        }
        setAttributedTitle(NSAttributedString(string:title,attributes:[.font:font,.foregroundColor:UIColor(patternImage:glyphLight)]),for:.normal)
        // Live glyph fill only: outlines previously bridged the dot on lowercase i.
        titleLabel?.shadowColor=nil
        titleLabel?.layer.shadowColor=UIColor(red:164/255,green:65/255,blue:31/255,alpha:1).cgColor
        titleLabel?.layer.shadowOffset=CGSize(width:0,height:-1)
        titleLabel?.layer.shadowOpacity=0;titleLabel?.layer.shadowRadius=0
        if !primary {
            // Ordinary flat live title, without bevel, shadow or glyph overlays.
            let ink=UIColor(red:176/255,green:137/255,blue:121/255,alpha:1)
            setTitleColor(ink,for:.normal)
            setAttributedTitle(NSAttributedString(string:title,attributes:[.font:font,.foregroundColor:ink]),for:.normal)
        }
        layer.shadowOpacity=0;layer.cornerRadius=0
        setNeedsLayout()
    }
    static let ctaWidthScale:CGFloat=1.05
    static let primaryCTAHeight:CGFloat=80.64
    /// All sculpted action buttons share the fuller silhouette; live type stays unchanged.
    /// Width follows live title width so both side insets retain the same percentage.
    func primaryCTASize(maxWidth:CGFloat)->CGSize {
        let font=titleLabel?.font ?? UIFont.systemFont(ofSize:28,weight:.heavy)
        let reference=("Journey" as NSString).size(withAttributes:[.font:font]).width
        let text=((title(for:.normal) ?? "") as NSString).size(withAttributes:[.font:font]).width
        return CGSize(width:min(maxWidth,max(72,176*text/max(1,reference))*Self.ctaWidthScale),height:Self.primaryCTAHeight)
    }
    static let pairedModalCTAHeight:CGFloat=84
    static let pairedModalCTAGap:CGFloat=6
    /// Pre-redesign modal action width, independent of the live title.
    static func modalCTAWidth(_ buttons:[JimiV9PlainButton],maxWidth:CGFloat)->CGFloat {
        min(249,maxWidth)
    }
    private var sculptedShapeKey:String?
    override func setTitle(_ title:String?,for state:UIControl.State) {
        super.setTitle(title,for:state)
        guard state == .normal,sculptedFace != nil else{return}
        func updated(_ prior:NSAttributedString?)->NSAttributedString? {
            guard let title,let prior,prior.length>0 else{return nil}
            return NSAttributedString(string:title,attributes:prior.attributes(at:0,effectiveRange:nil))
        }
        setAttributedTitle(updated(attributedTitle(for:.normal)),for:.normal)
        setNeedsLayout()
    }
    private func removeSculptedCTA() {
        setPrimaryCTAShimmer(false)
        hasModalIdle=false;layer.removeAnimation(forKey:Self.modalIdleKey)
        CATransaction.begin();CATransaction.setDisableActions(true);layer.sublayerTransform=CATransform3DIdentity;CATransaction.commit()
        sculptedFace?.removeFromSuperview();sculptedFace=nil
        setAttributedTitle(nil,for:.normal);sculptedShapeKey=nil
    }
    func removeModalCTAPaint() {
        removeSculptedCTA()
        backgroundColor = .clear;layer.shadowOpacity=0;layer.borderWidth=0
    }
    func applyModalCTA(artwork:JimiV9Artwork,primary:Bool=true,preparesSculptedFaceOffMain:Bool=false) {
        applySculptedCTAStyle(artwork:artwork,primary:primary)
        sculptedFace?.preparesOffMain=preparesSculptedFaceOffMain
        sculptedFace?.bundledRasterRoot=preparesSculptedFaceOffMain ? artwork.resourceRoot:nil
        sculptedFace?.onPrepared={ [weak self] in self?.onSculptedFacePrepared?() }
        hasModalIdle=true
        if !observesModalIdle {
            observesModalIdle=true
            NotificationCenter.default.addObserver(self,selector:#selector(modalCTAWillResignActive),name:UIApplication.willResignActiveNotification,object:nil)
            NotificationCenter.default.addObserver(self,selector:#selector(modalCTADidBecomeActive),name:UIApplication.didBecomeActiveNotification,object:nil)
        }
        updateModalCTAIdle()
    }
    override func layoutSubviews() {
        super.layoutSubviews()
        updateModalCTAIdle()
        if let artworkOpacity {imageView?.alpha=artworkOpacity}

        if let sculptedFace {
            // Small static CTA surfaces render at 2x display density, then the
            // compositor downsamples during authored press/idle transforms.
            let displayScale=max(1,window?.screen.scale ?? traitCollection.displayScale)
            for surface in [sculptedFace,titleLabel].compactMap({$0}) {
                let scale=displayScale*2
                if surface.contentScaleFactor != scale {surface.contentScaleFactor=scale;surface.setNeedsDisplay()}
                surface.layer.allowsEdgeAntialiasing=true
                surface.layer.minificationFilter = .trilinear
                surface.layer.magnificationFilter = .linear
            }
            sculptedFace.shapeKey=sculptedShapeKey ?? accessibilityIdentifier ?? title(for:.normal) ?? "primary"
            sculptedFace.frame=bounds
            sculptedFace.layoutIfNeeded();ctaShimmer?.layout()
            titleLabel?.center=CGPoint(x:bounds.midX,y:bounds.midY-NativeSculptedCTAFace.depth/2)
        }
    }
    override var isHighlighted: Bool {
        get { false }
        set { /* Keep normal artwork/title colors while tracking touches. */ }
    }
}

@MainActor
final class NativeCTAShimmer:NSObject,CAAnimationDelegate {
    static let animationKey="native.cta.shimmer"
    private weak var button:JimiV9PlainButton?
    let highlight=CAGradientLayer(),band=CAGradientLayer()
    private var observations:[NSKeyValueObservation]=[]
    private var disposed=false,foreground=true
    private(set) var running=false
    init(button:JimiV9PlainButton,faceLayer:CALayer) {
        self.button=button
        super.init()
        highlight.name="native.cta.shimmer";highlight.opacity=0;highlight.masksToBounds=true;highlight.zPosition=1
        highlight.colors=Array(repeating:UIColor(red:1,green:225/255,blue:189/255,alpha:0.55).cgColor,count:2)
        highlight.startPoint=CGPoint(x:0.5,y:0);highlight.endPoint=CGPoint(x:0.5,y:1)
        // Same soft shoulders and narrow specular core as TAP TAP DESIGN.
        band.colors=[0.0,0.06,0.35,1,0.35,0.06,0].map{UIColor(white:1,alpha:$0).cgColor}
        band.locations=[0,0.18,0.38,0.5,0.62,0.82,1];highlight.mask=band
        faceLayer.addSublayer(highlight)
        let center=NotificationCenter.default
        center.addObserver(self,selector:#selector(background),name:UIApplication.willResignActiveNotification,object:nil)
        center.addObserver(self,selector:#selector(active),name:UIApplication.didBecomeActiveNotification,object:nil)
        center.addObserver(self,selector:#selector(motionChanged),name:UIAccessibility.reduceMotionStatusDidChangeNotification,object:nil)
        foreground=UIApplication.shared.applicationState != .background
        rebindVisibility()
    }
    deinit {NotificationCenter.default.removeObserver(self)}
    @objc private func background(){foreground=false;refresh()}
    @objc private func active(){foreground=true;refresh()}
    @objc private func motionChanged(){refresh()}
    func rebindVisibility() {
        observations.removeAll()
        var view:UIView?=button
        while let current=view {
            let layer=current.layer
            observations.append(layer.observe(\.isHidden,options:[.new]){[weak self] _,_ in MainActor.assumeIsolated{self?.refresh()}})
            observations.append(layer.observe(\.opacity,options:[.new]){[weak self] _,_ in MainActor.assumeIsolated{self?.refresh()}})
            observations.append(layer.observe(\.position,options:[.new]){[weak self] _,_ in MainActor.assumeIsolated{self?.refresh()}})
            observations.append(layer.observe(\.bounds,options:[.new]){[weak self] _,_ in MainActor.assumeIsolated{self?.refresh()}})
            observations.append(current.observe(\.isUserInteractionEnabled,options:[.new]){[weak self] _,_ in MainActor.assumeIsolated{self?.refresh()}})
            observations.append(layer.observe(\.transform,options:[.new]){[weak self] _,_ in MainActor.assumeIsolated{self?.refresh()}})
            view=current.superview
        }
        layout()
    }
    private var eligible:Bool {
        guard !disposed,foreground,!UIAccessibility.isReduceMotionEnabled,
              let button,button.isEnabled,let window=button.window,!window.isHidden,
              button.bounds.width>0,button.bounds.height>0 else{return false}
        var view:UIView?=button
        while let current=view {
            guard !current.isHidden,current.alpha>0.01 else{return false}
            if current !== button && !current.isUserInteractionEnabled {return false}
            let rect=button.convert(button.bounds,to:current)
            if current.clipsToBounds && !current.bounds.intersects(rect) {return false}
            view=current.superview
        }
        return button.convert(button.bounds,to:window).intersects(window.bounds)
    }
    func layout() {
        guard let button,!disposed else{return}
        let changed=highlight.bounds.size != button.bounds.size
        if changed {stop()}
        CATransaction.begin();CATransaction.setDisableActions(true)
        highlight.frame=button.bounds;highlight.cornerRadius=0
        let w=button.bounds.width*1.62,h=button.bounds.height
        // Overscan the tilted stripe so its shoulders/core span the complete
        // button height. Only the outer rounded body clips it; no vertical fade.
        band.bounds=CGRect(x:0,y:0,width:w,height:3*h+w)
        band.position=CGPoint(x:-0.85*button.bounds.width,y:h/2)
        band.startPoint=CGPoint(x:0,y:0.5);band.endPoint=CGPoint(x:1,y:0.5)
        band.transform=CATransform3DMakeRotation(-20 * .pi/180,0,0,1)
        CATransaction.commit();refresh()
    }
    func refresh() {
        guard eligible else{stop();return}
        guard !running,let button else{return}
        running=true
        let opacity=CAKeyframeAnimation(keyPath:"opacity")
        opacity.values=[0,0,0.62,0.62,0,0,0,0.52,0.52,0,0,0]
        opacity.keyTimes=[0,0.12,0.12+0.04/1.3,0.12+0.15/1.3,0.12+0.20/1.3,0.33,0.38,0.38+0.04/1.3,0.38+0.15/1.3,0.38+0.20/1.3,0.59,1].map{NSNumber(value:$0)}
        opacity.duration=10;opacity.delegate=self
        opacity.timingFunctions=Array(repeating:CAMediaTimingFunction(controlPoints:0.42,0,0.58,1),count:11)
        let sweep=CAKeyframeAnimation(keyPath:"position.x")
        sweep.values=[-0.85,-0.85,1.85,-0.85,-0.85,1.85,1.85].map{$0*button.bounds.width}
        sweep.keyTimes=[0,0.12,0.12+0.20/1.3,0.33,0.38,0.38+0.20/1.3,1].map{NSNumber(value:$0)};sweep.duration=10
        sweep.timingFunctions=Array(repeating:CAMediaTimingFunction(controlPoints:0.42,0,0.58,1),count:6)
        highlight.add(opacity,forKey:Self.animationKey);band.add(sweep,forKey:Self.animationKey)
    }
    func animationDidStop(_ anim:CAAnimation,finished flag:Bool) {
        guard flag,running,!disposed else{return};running=false;refresh()
    }
    private func stop() {
        running=false;highlight.removeAnimation(forKey:Self.animationKey);band.removeAnimation(forKey:Self.animationKey)
    }
    func dispose() {
        guard !disposed else{return};disposed=true;stop();observations.removeAll()
        NotificationCenter.default.removeObserver(self);highlight.removeFromSuperlayer();button=nil
    }
}

/// Rebase the accepted SIX lighting profile onto the requested #F6875B face.
/// Each channel retains its fraction toward white (light) or black (shade).
/// Ivory glyph material stays separate; its orange recess/reflection use this palette.
private enum NativeSculptedCTAPalette {
    static func tone(_ r:CGFloat,_ g:CGFloat,_ b:CGFloat,secondary:Bool=false)->UIColor {
        func channel(_ value:CGFloat,_ reference:CGFloat,_ target:CGFloat)->CGFloat {
            let mapped=value<=reference ? target*value/reference
                : target+(255-target)*(value-reference)/(255-reference)
            return mapped.rounded()/255
        }
        return UIColor(red:channel(r,239,secondary ? 250:246),green:channel(g,147,secondary ? 239:135),blue:channel(b,106,secondary ? 218:91),alpha:1)
    }
}

/// Static UIKit vector paint; the existing button/idle shells own all motion.
private nonisolated final class NativeSculptedCTAPaintCancellation:@unchecked Sendable {
    private let lock=NSLock()
    private var value=false
    var cancelled:Bool {lock.lock();defer{lock.unlock()};return value}
    func cancel(){lock.lock();value=true;lock.unlock()}
}
private nonisolated struct NativeSculptedCTAPaintImage:@unchecked Sendable {let image:CGImage?}
/// Immutable Core Graphics commands. No UIKit/Scene/layer access on the worker.
private nonisolated struct NativeSculptedCTAPaintPlan:@unchecked Sendable {
    enum Command {case fill(CGPath,CGColor),gradient(CGPath,CGGradient,CGPoint,CGPoint),rightHighlight([Command],CGFloat,CGFloat)}
    let size:CGSize,scale:CGFloat,commands:[Command]
    func paint(into context:CGContext,cancelled:()->Bool) {
        context.setAllowsAntialiasing(true);context.setShouldAntialias(true)
        for command in commands {
            guard !cancelled() else{return}
            switch command {
            case let .fill(path,color):
                context.addPath(path);context.setFillColor(color);context.fillPath()
            case let .gradient(path,gradient,start,end):
                context.saveGState();context.addPath(path);context.clip()
                context.drawLinearGradient(gradient,start:start,end:end,options:[.drawsBeforeStartLocation,.drawsAfterEndLocation])
                context.restoreGState()
            case let .rightHighlight(commands,startX,endX):
                // One static masked paint pass restores the original light edge
                // on the right, with no seam at the early left-side transition.
                context.saveGState();context.beginTransparencyLayer(auxiliaryInfo:nil)
                NativeSculptedCTAPaintPlan(size:size,scale:scale,commands:commands).paint(into:context,cancelled:cancelled)
                context.setBlendMode(.destinationIn)
                let mask=CGGradient(colorsSpace:CGColorSpaceCreateDeviceRGB(),colors:[CGColor(red:1,green:1,blue:1,alpha:0),CGColor(red:1,green:1,blue:1,alpha:1)] as CFArray,locations:nil)!
                context.drawLinearGradient(mask,start:CGPoint(x:startX,y:0),end:CGPoint(x:endX,y:0),options:[.drawsBeforeStartLocation,.drawsAfterEndLocation])
                context.endTransparencyLayer();context.restoreGState()
            }
        }
    }
    func render(cancellation:NativeSculptedCTAPaintCancellation)->NativeSculptedCTAPaintImage {
        guard !cancellation.cancelled else{return .init(image:nil)}
        let width=Int(ceil(size.width*scale)),height=Int(ceil(size.height*scale))
        guard width>0,height>0,width<=8192,height<=8192,
              let space=CGColorSpace(name:CGColorSpace.sRGB),
              let context=CGContext(data:nil,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:space,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{return .init(image:nil)}
        context.translateBy(x:0,y:CGFloat(height));context.scaleBy(x:scale,y:-scale)
        paint(into:context,cancelled:{cancellation.cancelled})
        guard !cancellation.cancelled else{return .init(image:nil)}
        return .init(image:context.makeImage())
    }
}
private final class NativeSculptedCTAFace:UIView {
    private static let paintQueue=DispatchQueue(label:"com.taptapdesign.stacktosix.cta-paint",qos:.userInitiated)
    var preparesOffMain=false {didSet{if oldValue != preparesOffMain {retirePaint();setNeedsLayout();setNeedsDisplay()}}}
    var onPrepared:(()->Void)?
    var bundledRasterRoot:URL? {didSet{if oldValue != bundledRasterRoot {retirePaint();setNeedsLayout();setNeedsDisplay()}}}
    var isPrepared:Bool {!preparesOffMain || preparedImage != nil || fallbackOriginalRaster}
    private var preparedImage:CGImage?
    private var preparationSuspended=false,fallbackOriginalRaster=false
    private var paintKey:String?
    private var paintCancellation:NativeSculptedCTAPaintCancellation?
    private func retirePaint(){paintCancellation?.cancel();paintCancellation=nil;paintKey=nil;preparedImage=nil;fallbackOriginalRaster=false}
    func retirePreparation(){preparationSuspended=true;retirePaint();onPrepared=nil}
    func setPreparationSuspended(_ value:Bool){
        guard preparationSuspended != value else{return}
        preparationSuspended=value
        if value {
            paintCancellation?.cancel();paintCancellation=nil
            if preparedImage == nil && !fallbackOriginalRaster {paintKey=nil}
        } else {setNeedsLayout()}
    }
    #if DEBUG
    var preparationSnapshotForTesting:String {
        "width=\(String(format:"%.17g",Double(bounds.width))) height=\(String(format:"%.17g",Double(bounds.height))) scale=\(contentScaleFactor) shape=\(shapeKey) secondary=\(secondary) suspended=\(preparationSuspended) window=\(window != nil) prepared=\(isPrepared) image=\(preparedImage?.width ?? 0)x\(preparedImage?.height ?? 0) key=\(paintKey ?? "nil") queued=\(paintCancellation != nil)"
    }
    func rasterForTesting(original:Bool)->CGImage? {
        if !original {return preparedImage}
        let format=UIGraphicsImageRendererFormat();format.scale=contentScaleFactor
        format.opaque=false;format.preferredRange = .standard
        let plan=makePaintPlan()
        return UIGraphicsImageRenderer(size:bounds.size,format:format).image {plan.paint(into:$0.cgContext,cancelled:{false})}.cgImage
    }
    #endif
    func prepareForEntrance(){prepareIfNeeded()}
    private func prepareIfNeeded(){
        guard preparesOffMain,!preparationSuspended,bounds.width>0,bounds.height>0 else{return}
        let key="\(bounds.size)|\(contentScaleFactor)|\(shapeKey)|\(secondary)"
        guard key != paintKey else{return}
        retirePaint();paintKey=key
        // Only the two fixed Exit roles use recipe-derived bundled faces.
        // Resolve during layout before visible entry: no worker-ready gate on
        // the common path, no global image cache, and live text stays untouched.
        if let image=bundledFace() {
            preparedImage=image;setNeedsDisplay();onPrepared?();return
        }
        guard window != nil else{paintKey=nil;return}
        let cancellation=NativeSculptedCTAPaintCancellation();paintCancellation=cancellation
        let plan=makePaintPlan()
        Self.paintQueue.async { [weak self] in
            let result=plan.render(cancellation:cancellation)
            guard !cancellation.cancelled else{return}
            DispatchQueue.main.async { [weak self] in
                guard let self,!cancellation.cancelled,!self.preparationSuspended,self.paintKey==key,self.window != nil else{return}
                self.paintCancellation=nil;self.preparedImage=result.image
                // Allocation failure preserves the original full-resolution
                // vector paint rather than leaving a permanently empty CTA.
                self.fallbackOriginalRaster=result.image == nil
                self.setNeedsDisplay();self.onPrepared?()
            }
        }
    }
    private func bundledFace()->CGImage? {
        // UIKit can round a transformed descendant's bounds by fractions of
        // a point. Match only numerical noise, not a different action size.
        let fuller=abs(bounds.height-JimiV9PlainButton.pairedModalCTAHeight)<0.0001
        guard let root=bundledRasterRoot,
              let scale=[CGFloat(4),6].first(where:{abs(contentScaleFactor-$0)<0.000001}) else{return nil}
        if fuller {
            guard let width=[CGFloat(240),249].first(where:{abs(bounds.width-$0)<0.0001}) else{return nil}
            let role=shapeKey=="native.end-run.restart" && !secondary ? "restart":(shapeKey=="native.end-run.exit" && secondary ? "exit":"")
            guard !role.isEmpty else{return nil}
            let name="\(role)-\(width==240 ? "240":"249")-\(Int(scale))x.png"
            let path=root.appendingPathComponent("assets/ui/native-end-run-cta-balanced-v1").appendingPathComponent(name).path
            guard let image=UIImage(contentsOfFile:path)?.preparingForDisplay()?.cgImage,
                  image.width==Int(ceil(width*scale)),image.height==Int(ceil(JimiV9PlainButton.pairedModalCTAHeight*scale)) else{return nil}
            return image
        }
        guard abs(bounds.height-80)<0.0001,
              let width=[CGFloat(240),249].first(where:{abs(bounds.width-$0)<0.0001}) else{return nil}
        let role:String
        if shapeKey=="native.end-run.restart",!secondary {role="restart"}
        else if shapeKey=="native.end-run.exit",secondary {role="exit"}
        else{return nil}
        let name="\(role)-\(Int(width))-\(Int(scale))x.png"
        let directory=secondary ? "assets/ui/native-end-run-cta-soft-top-v3":"assets/ui/native-end-run-cta"
        let path=root.appendingPathComponent(directory).appendingPathComponent(name).path
        guard let source=UIImage(contentsOfFile:path),
              let image=(source.preparingForDisplay() ?? source).cgImage,
              image.width==Int(width*scale),image.height==Int(80*scale) else{return nil}
        return image
    }
    override func didMoveToWindow(){super.didMoveToWindow();if window == nil {retirePaint()}else{setNeedsLayout()}}

    var secondary=false {didSet{if secondary != oldValue{setNeedsDisplay()}}}
    static let depth:CGFloat=9.6
    var shapeKey="home.journey" {didSet{if shapeKey != oldValue{setNeedsDisplay();setNeedsLayout()}}}
    private var variation:(CGFloat,CGFloat) {
        guard shapeKey != "home.journey" else{return (0,0)}
        let hash=shapeKey.utf8.reduce(UInt64(1469598103934665603)){($0 ^ UInt64($1)) &* 1099511628211}
        return (CGFloat(hash%997)/498-1,CGFloat((hash/997)%991)/495-1)
    }
    private let silhouetteMask=CAShapeLayer()
    private var frontRect:CGRect {bounds.insetBy(dx:1,dy:1).inset(by:UIEdgeInsets(top:0,left:0,bottom:Self.depth,right:0))}
    // One contour family owns the shoulder and wall. Depth changes only
    // the lower half; top corners never slide when the wall is extended.
private func contour(inset:CGFloat=0,depth:CGFloat=0)->UIBezierPath {
        let front=frontRect
        let (lean,bow)=variation
        let r=front.insetBy(dx:inset,dy:inset),w=r.width,h=r.height,p=UIBezierPath()
        func q(_ x:CGFloat,_ y:CGFloat,_ d:CGFloat=0)->CGPoint {
            let px=x+lean*0.009*sin(.pi*y)+bow*0.007*sin(.pi*x)*sin(.pi*y)
            let py=y+lean*0.014*(x-0.5)+bow*0.009*sin(.pi*x)
            return CGPoint(x:r.minX+px*w,y:r.minY+py*h+d*depth)
        }
        p.move(to:q(0.135,0.025))
        p.addCurve(to:q(0.862,0.022),controlPoint1:q(0.35,-0.012),controlPoint2:q(0.66,0.002))
        p.addCurve(to:q(0.993,0.39),controlPoint1:q(0.963,0.022),controlPoint2:q(0.994,0.105))
        p.addCurve(to:q(0.864,0.953,1),controlPoint1:q(1.001,0.77,0.5),controlPoint2:q(0.979,0.927,1))
        p.addCurve(to:q(0.132,0.956,1),controlPoint1:q(0.685,1.007,1),controlPoint2:q(0.309,1.009,1))
        p.addCurve(to:q(0.008,0.49),controlPoint1:q(0.023,0.941,1),controlPoint2:q(0.002,0.785,0.5))
        p.addCurve(to:q(0.135,0.025),controlPoint1:q(0.009,0.177),controlPoint2:q(0.037,0.042))
        p.close();return p
    }
    #if DEBUG
    private var hudLatencyDrawCount=0
    #endif
    override func draw(_ rect:CGRect) {
        #if DEBUG
        let traceDraw=ProcessInfo.processInfo.arguments.contains("-native-hud-latency-trace") && hudLatencyDrawCount<3
        let traceStart=traceDraw ? CACurrentMediaTime():0
        if traceDraw {
            hudLatencyDrawCount+=1
            NSLog("[CC_NATIVE_HUD_LATENCY] cta-draw-begin t=%.6f key=%@ bounds=%.1fx%.1f density=%.2f secondary=%d",traceStart,shapeKey,bounds.width,bounds.height,contentScaleFactor,secondary ? 1:0)
        }
        defer {
            if traceDraw {
                let end=CACurrentMediaTime()
                NSLog("[CC_NATIVE_HUD_LATENCY] cta-draw-end t=%.6f key=%@ elapsedMs=%.3f",end,shapeKey,(end-traceStart)*1000)
            }
        }
        #endif
        guard let ctx=UIGraphicsGetCurrentContext(),bounds.width>0,bounds.height>0 else{return}
        if preparesOffMain && !fallbackOriginalRaster {
            guard let preparedImage else{return}
            ctx.saveGState();ctx.translateBy(x:0,y:bounds.height);ctx.scaleBy(x:1,y:-1)
            ctx.draw(preparedImage,in:bounds);ctx.restoreGState()
        } else {makePaintPlan().paint(into:ctx,cancelled:{false})}
    }
    private func makePaintPlan()->NativeSculptedCTAPaintPlan {
        func color(_ r:CGFloat,_ g:CGFloat,_ b:CGFloat)->UIColor{NativeSculptedCTAPalette.tone(r,g,b,secondary:secondary)}
        let front=frontRect
        var commands:[NativeSculptedCTAPaintPlan.Command]=[]
        func mix(_ a:UIColor,_ b:UIColor,_ t:CGFloat)->UIColor {
            var ar:CGFloat=0,ag:CGFloat=0,ab:CGFloat=0,aa:CGFloat=0
            var br:CGFloat=0,bg:CGFloat=0,bb:CGFloat=0,ba:CGFloat=0
            a.getRed(&ar,green:&ag,blue:&ab,alpha:&aa);b.getRed(&br,green:&bg,blue:&bb,alpha:&ba)
            return UIColor(red:ar+(br-ar)*t,green:ag+(bg-ag)*t,blue:ab+(bb-ab)*t,alpha:1)
        }
        func sample(_ stops:[(CGFloat,UIColor)],_ t:CGFloat)->UIColor {
            for i in 1..<stops.count where t<=stops[i].0 {
                let a=stops[i-1],b=stops[i];return mix(a.1,b.1,(t-a.0)/(b.0-a.0))
            }
            return stops.last!.1
        }
        // Filled contour slices follow the bowed underside at every x: warm
        // shoulder, reflected peach, rounded underside. No screen-flat seam.
        // Reference secondary material: flat #DFC3B0 underside beneath white.
        let secondaryShadow=UIColor(red:223/255,green:195/255,blue:176/255,alpha:1)
        let wall:[(CGFloat,UIColor)]=secondary
            ? [(0,secondaryShadow),(1,secondaryShadow)]
            : [(0,color(222,128,89)),(0.24,color(207,113,79)),
               (0.66,color(211,123,87)),(0.81,color(214,128,92)),(1,color(203,115,82))]
        for step in stride(from:48,through:0,by:-1) {
            let t=CGFloat(step)/48
            commands.append(.fill(contour(depth:Self.depth*t).cgPath,sample(wall,t).cgColor))
        }
        // A broad convex shoulder, painted as filled nested surfaces rather
        // than a stroked outline. The warm crest peaks inside the silhouette.
        // Secondary retains the warm bevel and wall, while its broad front
        // returns to the original white CTA material.
        let white=UIColor.white
        // Retain the one-percent inset, then add 1pt above and 2pt at the left.
        let highlightInset=bounds.height*0.01+1
        let top:[(CGFloat,UIColor)]=secondary
            ? [(0,UIColor(red:228/255,green:215/255,blue:204/255,alpha:1)),
               (0.65,UIColor(red:244/255,green:239/255,blue:234/255,alpha:1)),
               (1.35,white),(2.1,white),(3.5,white),(5.5,white)]
            : [(0,color(235,143,101)),(0.65+highlightInset,color(248,181,132)),
               (1.35+highlightInset,color(255,205,157)),(2.1+highlightInset,color(251,187,137)),(3.5+highlightInset,color(244,163,115)),(6.5,color(239,147,106))]
        let leftStops=secondary ? top : top.map { ($0.0 == 0 ? 0:$0.0+1,$0.1) }
        let bottom:[(CGFloat,UIColor)]=secondary
            ? [(0,secondaryShadow),(1,mix(secondaryShadow,white,0.55)),
               (2.4,mix(secondaryShadow,white,0.9)),(4.5,white),(5.5,white)]
            : [(0,color(219,125,86)),(1,color(224,129,89)),
               (2.4,color(235,140,98)),(4.5,color(239,147,106)),(5.5,color(239,147,106))]
        let core=secondary ? white : color(239,147,106)
        let originalSecondaryTop:[(CGFloat,UIColor)]=[(0,color(235,143,101)),(0.65,UIColor(red:1,green:0.98,blue:0.94,alpha:1)),(1.35,white),(5.5,white)]
        var rightHighlight:[NativeSculptedCTAPaintPlan.Command]=[]
        for step in 0...(secondary ? 44:60) {
            let inset=CGFloat(step)/8
            let clip=contour(inset:inset).cgPath
            let upper=sample(top,inset),lower=sample(bottom,inset)
            let gradient=CGGradient(colorsSpace:CGColorSpaceCreateDeviceRGB(),colors:[upper.cgColor,core.cgColor,lower.cgColor] as CFArray,locations:[0,0.42,1])!
            commands.append(.gradient(clip,gradient,CGPoint(x:front.minX,y:front.minY),CGPoint(x:front.minX,y:front.maxY)))
            if secondary {
                let originalUpper=sample(originalSecondaryTop,inset)
                let restored=CGGradient(colorsSpace:CGColorSpaceCreateDeviceRGB(),colors:[originalUpper.cgColor,core.cgColor,lower.cgColor] as CFArray,locations:[0,0.42,1])!
                rightHighlight.append(.gradient(clip,restored,CGPoint(x:front.minX,y:front.minY),CGPoint(x:front.minX,y:front.maxY)))
            }
            // Left roll receives a warmer, broader light than the right wall.
            let left=sample(leftStops,inset)
            let glow=CGGradient(colorsSpace:CGColorSpaceCreateDeviceRGB(),colors:[left.withAlphaComponent(0.7).cgColor,left.withAlphaComponent(0).cgColor] as CFArray,locations:nil)!
            commands.append(.gradient(clip,glow,CGPoint(x:front.minX,y:0),CGPoint(x:front.minX+14,y:0)))
        }
        if secondary {commands.append(.rightHighlight(rightHighlight,front.minX+front.width*0.12,front.minX+front.width*0.4))}
        return NativeSculptedCTAPaintPlan(size:bounds.size,scale:contentScaleFactor,commands:commands)
    }
    private var paintedSize:CGSize = .zero
    private var maskedShapeKey=""
    private var maskedScale:CGFloat=0
    override func layoutSubviews(){
        super.layoutSubviews()
        // Window attachment can reset UIView's scale to screen density before
        // the parent button lays out. Preserve the authored2x face density so
        // that transient scale cannot enqueue an unnecessary fallback paint.
        if preparesOffMain,let window {
            let scale=max(1,window.screen.scale)*2
            if contentScaleFactor != scale {contentScaleFactor=scale;setNeedsDisplay()}
        }
        // Apply silhouette coverage once, after all material layers. Repeated
        // overlapping fills must not accumulate opacity at the outer edge.
        if paintedSize != bounds.size || maskedShapeKey != shapeKey || maskedScale != contentScaleFactor {
            CATransaction.begin();CATransaction.setDisableActions(true)
            if layer.mask !== silhouetteMask {layer.mask=silhouetteMask}
            silhouetteMask.frame=bounds
            silhouetteMask.contentsScale=contentScaleFactor
            silhouetteMask.fillColor=UIColor.black.cgColor
            silhouetteMask.path=contour(depth:Self.depth).cgPath
            CATransaction.commit()
            maskedShapeKey=shapeKey;maskedScale=contentScaleFactor
        }
        if paintedSize != bounds.size {paintedSize=bounds.size;setNeedsDisplay()}
        prepareIfNeeded()
    }
}

/// CSS overflow:visible keeps the translated CTA's complete hit region.
private final class JimiV9OverflowView: UIView {
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        if super.point(inside: point, with: event) { return true }
        return subviews.contains { child in
            !child.isHidden && child.alpha > 0.01 && child.isUserInteractionEnabled
                && child.point(inside: child.convert(point, from: self), with: event)
        }
    }
}

/// Settled Homepage presentation plus owned artwork compositor idle. No route,
/// persistence, audio or timer lives here; controller grants visible motion/input leases.
@MainActor
final class JimiV9HomeView: UIView, UIGestureRecognizerDelegate {
    var onSlideSelected: ((Int) -> Void)?
    var onActivate: ((Int) -> Void)?
    var onHeroContact:(()->Void)?
    var onNavigation: ((String) -> Void)?
    var onPanBegan: (() -> Bool)?
    var onPanEnded: ((Int, Bool) -> Void)?
    private(set) var selectedSlide = 0

    let navView = UIView()
    let sliderTrack = UIView()
    let logoView = UIView()
    let logoIdleView=UIView()
    private let logoIdleDirection=CGPoint(x:CGFloat.random(in:-4...4),y:CGFloat.random(in:-5...5))
    private let logoIdleTilt=CGFloat.random(in:-1.2...1.2)
    private let logoIdleDuration=Double.random(in:5.4...6.4)
    private let viewport = UIView()
    private let logoImage: UIImageView
    private let shards: [UIImageView]
    private let shardShells = (0..<4).map { _ in UIView() }
    private let shardIdleDirections=(0..<4).map{index in CGPoint(x:CGFloat.random(in:1...3)*(index%2==0 ? -1:1),y:CGFloat.random(in:1...3)*(index<2 ? -1:1))}
    private let shardIdleTilts=(0..<4).map{index in CGFloat.random(in:0.4...1.2)*(index%2==0 ? 1:-1)}
    private let shardIdleDurations=(0..<4).map{index in 3.1+Double(index)*0.65+Double.random(in:0...0.3)}
    private let shardIdlePhases=(0..<4).map{_ in Double.random(in:0.32...0.68)}
    private let shardIdleScales=(0..<4).map{_ in CGFloat.random(in:0.96...0.98)}
    private let bottomShadow: UIImageView
    private var panels: [UIView] = []
    private var heroes: [UIButton] = []
    private(set) var heroImages: [UIImageView] = []
    private var heroCartoonShells:[UIView]=[]
    static let heroArtworkScale: CGFloat = 1.05
    private var idleSlide: Int?
    private var ctas: [JimiV9PlainButton] = []
    private var ctaContainers: [UIView] = []
    private var ctaPressShells: [UIView] = []
    private var ctaCartoonShells: [UIView] = []
    private var ctaIdleShells:[UIView]=[]
    private let ctaIdleDirections=(0..<3).map{_ in CGPoint(x:CGFloat.random(in:-6...6),y:CGFloat.random(in:4...8))}
    private let ctaIdleTilts=(0..<3).map{_ in CGFloat.random(in:-1.4...1.4)}
    private let ctaIdleRates=(0..<3).map{_ in Double.random(in:1.13...1.29)}
    private let ctaIdlePhases=(0..<3).map{_ in Double.random(in:0.35...0.65)}
    var ctaIdleView:UIView {ctaIdleShells[selectedSlide]}
    private var ctaPressGeneration = [0, 0, 0]
    private var ctaActivationPending = false
    private var navButtons: [UIButton] = []
    private var navImages: [UIImageView] = []
    private var navIdleShells:[UIView]=[]
    private let navIdleDirections=(0..<3).map{index in CGPoint(x:CGFloat.random(in:1.5...3)*(index==1 ? -1:1),y:-CGFloat.random(in:4...7))}
    private let navIdleTilts=(0..<3).map{index in CGFloat.random(in:1...2)*(index==1 ? -1:1)}
    private let navIdleDurations=(0..<3).map{index in 4.1+Double(index)*0.8+Double.random(in:0...0.3)}
    private let navIdlePhases=(0..<3).map{_ in Double.random(in:0.35...0.65)}
    private var navShadows: [UIView] = []
    private let titles = ["Journey", "Arcade", "Settings"]
    private var panGesture: UIPanGestureRecognizer!
    private var dragging = false
    private var draggedPositionX: CGFloat?
    private var dragStartPositionX: CGFloat = 0
    private var dragRecognitionTranslation: CGFloat = 0
    var sliderSelectionStartX: CGFloat { draggedPositionX ?? sliderTrack.layer.presentation()?.position.x ?? sliderTrack.layer.position.x }

    var heroView: UIView { heroes[selectedSlide] }
    var logoImageView: UIImageView { logoImage }
    var shardViews: [UIView] { shardShells }
    var ctaView: UIButton { ctas[selectedSlide] }
    var ctaContainerView: UIView { ctaContainers[selectedSlide] }
    var navigationIconViews: [UIImageView] { navImages }
    var navigationButtonViews: [UIButton] { navButtons }
    var navigationShadowViews: [UIView] { navShadows }
    var navigationLayoutTargets: [(view: UIView, slideIndex: Int)] {
        navButtons.indices.flatMap { index in
            [(navButtons[index] as UIView, index), (navImages[index] as UIView, index), (navShadows[index], index)]
        }
    }
    var fixedShadowView: UIImageView { bottomShadow }
    var animationUnits: [UIView] { [logoView, heroView, ctas[selectedSlide], bottomShadow, navView] }

    init(frame: CGRect, assets: JimiV9Artwork) {
        // bootstrap-ui.ts:134–185: the logo is the original 1x source; its
        // lower-right shard is the mirrored lower-left asset, not dole desni.
        logoImage = UIImageView(image: assets.image("assets/logo-cube-crash.png"))
        shards = ["gore ljevo shards", "shards gore desno", "dole ljevi shards", "dole ljevi shards"].map {
            UIImageView(image: assets.image("assets/logo addons/\($0).png"))
        }
        bottomShadow = UIImageView(image: assets.image("assets/home-shadow.png"))
        super.init(frame: frame)
        accessibilityIdentifier = "native.home"
        backgroundColor = .clear
        clipsToBounds = true
        viewport.clipsToBounds = true
        addSubview(viewport)
        viewport.addSubview(sliderTrack)
        addSubview(logoView)
        for i in shards.indices {
            shards[i].contentMode = .scaleAspectFit
            shardShells[i].addSubview(shards[i])
            logoView.addSubview(shardShells[i])
        }
        shards[3].transform = CGAffineTransform(scaleX: -1, y: 1)
        logoImage.contentMode = .scaleAspectFit
        logoView.addSubview(logoIdleView);logoIdleView.addSubview(logoImage)
        logoView.isUserInteractionEnabled = false
        bottomShadow.contentMode = .scaleAspectFill
        bottomShadow.alpha = 0.55
        addSubview(bottomShadow)
        addSubview(navView)
        navView.accessibilityIdentifier = "native.home.navigation"

        let paths = ["journey", "crash-cubes-homepage", "settings-slider"]
        let icons = ["stats-nav", "cube-nav", "settings-nav"]
        for index in 0..<3 {
            let panel = UIView()
            sliderTrack.addSubview(panel)
            panels.append(panel)
            let hero = JimiV9PlainButton(type: .custom)
            hero.tag = index
            hero.accessibilityLabel = titles[index]
            hero.accessibilityIdentifier = "native.home.hero.\(index)"
            hero.addTarget(self, action: #selector(activate(_:)), for: .touchUpInside)
            let art = UIImageView(image: assets.image("assets/\(paths[index]).png", densityAware: true))
            art.contentMode = .scaleAspectFit
            let cartoon=UIView();cartoon.isUserInteractionEnabled=false
            hero.addSubview(cartoon);cartoon.addSubview(art);heroCartoonShells.append(cartoon)
            panel.addSubview(hero)
            heroes.append(hero)
            heroImages.append(art)

            let cta = JimiV9PlainButton(type: .custom)
            cta.tag = index
            cta.setTitle(titles[index], for: .normal)
            cta.applyPrimaryCTAStyle(artwork:assets,shapeKey:index==0 ? "home.journey":"home.\(titles[index])")
            cta.accessibilityIdentifier = "native.home.cta.\(index)"
            cta.addTarget(self, action: #selector(activate(_:)), for: .touchUpInside)
            cta.addTarget(self, action: #selector(pressCTA(_:)), for: [.touchDown, .touchDragEnter])
            cta.addTarget(self, action: #selector(cancelCTA(_:)), for: [.touchCancel, .touchUpOutside, .touchDragExit])
            let ctaContainer = JimiV9OverflowView()
            let pressShell = JimiV9OverflowView()
            let previewShell=JimiV9OverflowView()
            previewShell.addSubview(cta);pressShell.addSubview(previewShell)
            ctaCartoonShells.append(previewShell)
            let idleShell=JimiV9OverflowView();idleShell.accessibilityIdentifier="native.home.cta-idle.\(index)"
            idleShell.addSubview(pressShell);ctaContainer.addSubview(idleShell);ctaIdleShells.append(idleShell)
            panel.addSubview(ctaContainer)
            ctaPressShells.append(pressShell)
            ctaContainers.append(ctaContainer)
            ctas.append(cta)

            let nav = JimiV9PlainButton(type: .custom)
            nav.tag = index
            nav.accessibilityLabel = titles[index]
            nav.accessibilityIdentifier = "native.home.slide.\(index)"
            nav.addTarget(self, action: #selector(selectTab(_:)), for: .touchUpInside)
            let shadow = UIView()
            // v10 active-icon shadow: a blurred ellipse, not a rounded pill.
            shadow.backgroundColor = .clear
            shadow.layer.shadowColor = UIColor(red: 238/255, green: 218/255, blue: 202/255, alpha: 1).cgColor
            shadow.layer.shadowOpacity = 0.8
            shadow.layer.shadowRadius = 3
            shadow.layer.shadowOffset = .zero
            shadow.isUserInteractionEnabled = false
            let image = UIImageView(image: assets.image("assets/nav/\(icons[index]).png"))
            image.contentMode = .scaleAspectFit
            nav.addSubview(shadow)
            let idle=UIView();idle.isUserInteractionEnabled=false
            nav.addSubview(idle);idle.addSubview(image);navIdleShells.append(idle)
            navView.addSubview(nav)
            navButtons.append(nav)
            navImages.append(image)
            navShadows.append(shadow)
        }
        panGesture = UIPanGestureRecognizer(target: self, action: #selector(pan(_:)))
        panGesture.maximumNumberOfTouches = 1
        panGesture.cancelsTouchesInView = true
        panGesture.delegate = self
        viewport.addGestureRecognizer(panGesture)
        selectSlide(0, animated: false)
    }

    required init?(coder: NSCoder) { fatalError("Use init(frame:assets:)") }

    /// Applies only the settled state; `animated` is deliberately a controller
    /// concern. Call inside the controller's owned animation transaction.
    func selectSlide(_ index: Int, animated: Bool) {
        guard titles.indices.contains(index) else { return }
        if index != selectedSlide { stopHeroIdle(preserveLogoIdle:true) }
        resetCTAFeedback()
        draggedPositionX = nil
        selectedSlide = index
        for i in panels.indices {
            panels[i].accessibilityElementsHidden = i != index
            panels[i].isUserInteractionEnabled = i == index
            ctas[i].accessibilityIdentifier = i == index ? "native.home.cta" : "native.home.cta.\(i)"
            navButtons[i].isSelected = i == index
            navButtons[i].accessibilityTraits = i == index ? [.button, .selected] : [.button]
        }
        setNeedsLayout()
        layoutIfNeeded()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        let width = bounds.width
        let height = bounds.height
        let topInset = max(safeAreaInsets.top, 44)
        let innerInset = safeAreaInsets.top
        // Phone v9 CSS: Home top padding, content safeTop+2vh, logo -30,
        // logo127 + bottom20 + gap16, slider -10vh + slide8vh -16 + hero36.
        // Percentage Journey relative-top with an auto-height container is 0.
        let logoTop = topInset + innerInset + height * 0.02 - 30
        logoView.bounds = CGRect(x: 0, y: 0, width: 208, height: 127)
        logoView.center = CGPoint(x: width/2, y: logoTop + 63.5)
        // Route motion writes a collapsed model transform before playback.
        // UIView.frame is undefined under that transform (including scale 0);
        // layout must not resize the logo out from under its authored track.
        logoIdleView.bounds=logoView.bounds;logoIdleView.center=CGPoint(x:104,y:63.5)
        logoImage.bounds = CGRect(x: 0, y: 0, width: 208, height: 127)
        logoImage.center = CGPoint(x: 104, y: 55.5)
        let shardCenters = [
            CGPoint(x: -208*0.12 + 29.5, y: -127*0.16 + 29.5 - 8),
            CGPoint(x: 208 + 208*0.08 - 29.5 + 8, y: -127*0.16 + 29.5 - 8),
            CGPoint(x: -208*0.032 + 29.5 + 2, y: 127 - 127*0.023 - 29.5 - 16),
            CGPoint(x: 208 + 208*0.018 - 29.5 - 8, y: 127 + 127*0.019 - 29.5 - 14),
        ]
        for i in shards.indices {
            shardShells[i].bounds = CGRect(x: 0, y: 0, width: 59, height: 59)
            shardShells[i].center = shardCenters[i]
            shards[i].bounds = shardShells[i].bounds
            shards[i].center = CGPoint(x: 29.5, y: 29.5)
        }

        viewport.frame = bounds
        sliderTrack.bounds = CGRect(x: 0, y: 0, width: width*3, height: height)
        sliderTrack.center = CGPoint(x: draggedPositionX ?? (width*1.5 - CGFloat(selectedSlide)*width), y: height/2)
        // v10 mobile: the 336px image overflows its 280px shell by 28px
        // and relative top:5% adds 14px, leaving a net -14px displacement.
        // Its CTA has the same net correction (-34 text + 12px margin).
        let heroTop = topInset + innerInset + 139
        // Shared Settings width plus 5% of that width on each side of the text.
        let settingsSize=ctas[2].primaryCTASize(maxWidth:width-48)
        let homeCTASize=CGSize(width:min(width-48,settingsSize.width*1.10),height:settingsSize.height)
        for i in panels.indices {
            panels[i].frame = CGRect(x: CGFloat(i)*width, y: 0, width: width, height: height)
            heroes[i].bounds = CGRect(x: 0, y: 0, width: 336, height: 336)
            // The route/selection owner changes the pivot to 54%/65% with
            // position compensation. Reapplying a 50%-based UIView.center
            // during that motion undoes the compensation (13.44pt on exit).
            // Preserve the authored rest rectangle at the current anchor.
            heroes[i].layer.position = CGPoint(
                x: width/2 + (heroes[i].layer.anchorPoint.x - 0.5) * 336,
                y: heroTop + heroes[i].layer.anchorPoint.y * 336)
            let artSize = 336 * Self.heroArtworkScale
            heroImages[i].bounds = CGRect(x:0,y:0,width:artSize,height:artSize)
            heroCartoonShells[i].bounds=CGRect(x:0,y:0,width:336,height:336)
            heroCartoonShells[i].center=CGPoint(x:168,y:168)
            heroImages[i].center = CGPoint(x:168,y:168)
            ctaContainers[i].bounds = CGRect(x: 0, y: 0, width: width, height: 104)
            ctaContainers[i].center = CGPoint(x: width/2, y: heroTop + 360)
            ctas[i].bounds = CGRect(origin:.zero,size:homeCTASize)
            ctaPressShells[i].bounds = ctas[i].bounds
            ctaIdleShells[i].bounds=ctas[i].bounds
            ctaIdleShells[i].center=CGPoint(x:width/2,y:72+height*0.0225)
            ctaPressShells[i].center = CGPoint(x:ctas[i].bounds.midX,y:ctas[i].bounds.midY)
            ctaCartoonShells[i].bounds=ctas[i].bounds;ctaCartoonShells[i].center=CGPoint(x:ctas[i].bounds.midX,y:ctas[i].bounds.midY)
            ctas[i].center = CGPoint(x:ctas[i].bounds.midX,y:ctas[i].bounds.midY)
            ctas[i].layer.shadowPath = UIBezierPath(roundedRect: ctas[i].bounds, cornerRadius: 32).cgPath
        }
        bottomShadow.bounds = CGRect(x: 0, y: 0, width: width * 1.2 - 96, height: 49)
        bottomShadow.center = CGPoint(x: 40 - width * 0.1 + bottomShadow.bounds.width/2, y: height - 81 - 24.5)
        navView.bounds = CGRect(x: 0, y: 0, width: width, height: 120)
        navView.center = CGPoint(x: width/2, y: height - 60)
        let rowWidth = (width - 32) * 0.935
        let left = (width - rowWidth)/2 + 12
        let sizes = navButtons.indices.map { CGFloat($0 == selectedSlide ? 72 : 64) }
        let gap = (rowWidth - 24 - sizes.reduce(0, +))/2
        var x = left
        for i in navButtons.indices {
            let size = sizes[i]
            navButtons[i].bounds = CGRect(x: 0, y: 0, width: size, height: size)
            navButtons[i].center = CGPoint(x: x + size/2, y: 92 - size/2)
            navIdleShells[i].bounds=navButtons[i].bounds;navIdleShells[i].center=CGPoint(x:size/2,y:size/2)
            navImages[i].frame = CGRect(x: 0, y: i == selectedSlide ? -12 : 0, width: size, height: size)
            navShadows[i].frame = CGRect(x: (size-60)/2, y: size-19, width: 60, height: 15)
            navShadows[i].layer.shadowPath = UIBezierPath(ovalIn: navShadows[i].bounds).cgPath
            navShadows[i].isHidden = i != selectedSlide
            x += size + gap
        }
    }

    /// journey-fluidity-v10 slider-optimized.css: only active artwork advances.
    /// Inner artwork owns idle; route/selection motion remains on the hero button.
    func startHeroIdle() {
        guard !isHidden, UIApplication.shared.applicationState == .active, !UIAccessibility.isReduceMotionEnabled else {stopHeroIdle();return}
        let layer = heroImages[selectedSlide].layer
        if idleSlide == selectedSlide, layer.animation(forKey:"native-hero-idle") != nil {
            for target in ([layer,ctaIdleView.layer,logoIdleView.layer]+shards.map{$0.layer}+navIdleShells.map{$0.layer}) where target.speed == 0 {
                let offset=target.timeOffset;target.speed=1;target.timeOffset=0;target.beginTime=0
                target.beginTime=target.convertTime(CACurrentMediaTime(),from:nil)-offset
            }
            return
        }
        stopHeroIdle(preserveLogoIdle:true)
        let duration = [4.0,3.0,3.5][selectedSlide]
        let y = [-6.0,-8.0,-7.0][selectedSlide]
        let rotation = [-1.0,1.0,2.0][selectedSlide]
        let scale = [1.05,1.02,1.03][selectedSlide]
        var peak = CATransform3DMakeTranslation(0,y,0)
        peak = CATransform3DRotate(peak,rotation * .pi/180,0,0,1)
        peak = CATransform3DScale(peak,scale,scale,1)
        let animation = CAKeyframeAnimation(keyPath:"transform")
        animation.values = [CATransform3DIdentity,peak,CATransform3DIdentity].map{NSValue(caTransform3D:$0)}
        animation.keyTimes = [0,0.5,1];animation.duration = duration;animation.repeatCount = .infinity
        animation.timingFunctions = Array(repeating:CAMediaTimingFunction(controlPoints:0.42,0,0.58,1),count:2)
        layer.add(animation,forKey:"native-hero-idle");idleSlide = selectedSlide
        // Independent inner shell keeps idle away from route, press and contact
        // transforms. Capture directions once per Home lifetime, never per frame.
        let direction=ctaIdleDirections[selectedSlide]
        var ctaPeak=CATransform3DMakeTranslation(direction.x,direction.y,0)
        ctaPeak=CATransform3DRotate(ctaPeak,ctaIdleTilts[selectedSlide] * .pi/180,0,0,1)
        ctaPeak=CATransform3DScale(ctaPeak,scale,scale,1)
        let drift=CAKeyframeAnimation(keyPath:"transform")
        drift.values=[CATransform3DIdentity,ctaPeak,CATransform3DIdentity].map{NSValue(caTransform3D:$0)}
        drift.keyTimes=[0,NSNumber(value:ctaIdlePhases[selectedSlide]),1]
        drift.duration=duration*ctaIdleRates[selectedSlide];drift.repeatCount = .infinity
        drift.timingFunctions=animation.timingFunctions
        ctaIdleView.layer.add(drift,forKey:"native-home-cta-idle")
        let logoLayer=logoIdleView.layer
        if logoLayer.animation(forKey:"native-home-logo-idle") == nil {
            var logoPeak=CATransform3DMakeTranslation(logoIdleDirection.x,logoIdleDirection.y,0)
            logoPeak=CATransform3DRotate(logoPeak,logoIdleTilt * .pi/180,0,0,1)
            logoPeak=CATransform3DScale(logoPeak,1.025,1.025,1)
            let float=CAKeyframeAnimation(keyPath:"transform")
            float.values=[CATransform3DIdentity,logoPeak,CATransform3DIdentity].map{NSValue(caTransform3D:$0)}
            float.keyTimes=[0,0.57,1];float.duration=logoIdleDuration;float.repeatCount = .infinity
            float.beginTime=logoLayer.convertTime(CACurrentMediaTime(),from:nil)
            float.timingFunctions=animation.timingFunctions
            logoLayer.add(float,forKey:"native-home-logo-idle")
        }else if logoLayer.speed == 0 {
            let offset=logoLayer.timeOffset;logoLayer.speed=1;logoLayer.timeOffset=0;logoLayer.beginTime=0
            logoLayer.beginTime=logoLayer.convertTime(CACurrentMediaTime(),from:nil)-offset
        }
        for index in shards.indices {
            let layer=shards[index].layer
            if layer.animation(forKey:"native-home-shard-idle") == nil {
                let base=CATransform3DMakeScale(index==3 ? -1:1,1,1)
                let direction=shardIdleDirections[index]
                var peak=CATransform3DMakeTranslation(direction.x,direction.y,0)
                peak=CATransform3DRotate(peak,shardIdleTilts[index] * .pi/180,0,0,1)
                let scale=shardIdleScales[index]
                peak=CATransform3DScale(peak,index==3 ? -scale:scale,scale,1)
                let float=CAKeyframeAnimation(keyPath:"transform")
                float.values=[base,peak,base].map{NSValue(caTransform3D:$0)}
                float.keyTimes=[0,NSNumber(value:shardIdlePhases[index]),1]
                float.duration=shardIdleDurations[index];float.repeatCount = .infinity
                float.beginTime=layer.convertTime(CACurrentMediaTime(),from:nil)
                float.timingFunctions=animation.timingFunctions
                layer.add(float,forKey:"native-home-shard-idle")
            }else if layer.speed == 0 {
                let offset=layer.timeOffset;layer.speed=1;layer.timeOffset=0;layer.beginTime=0
                layer.beginTime=layer.convertTime(CACurrentMediaTime(),from:nil)-offset
            }
        }
        for index in navIdleShells.indices {
            let layer=navIdleShells[index].layer
            if layer.animation(forKey:"native-home-nav-idle") == nil {
                let direction=navIdleDirections[index]
                var peak=CATransform3DMakeTranslation(direction.x,direction.y,0)
                peak=CATransform3DRotate(peak,navIdleTilts[index] * .pi/180,0,0,1)
                peak=CATransform3DScale(peak,1.025,1.025,1)
                let drift=CAKeyframeAnimation(keyPath:"transform")
                drift.values=[CATransform3DIdentity,peak,CATransform3DIdentity].map{NSValue(caTransform3D:$0)}
                drift.keyTimes=[0,NSNumber(value:navIdlePhases[index]),1]
                drift.duration=navIdleDurations[index];drift.repeatCount = .infinity
                drift.beginTime=layer.convertTime(CACurrentMediaTime(),from:nil);drift.timingFunctions=animation.timingFunctions
                layer.add(drift,forKey:"native-home-nav-idle")
            }else if layer.speed == 0 {
                let offset=layer.timeOffset;layer.speed=1;layer.timeOffset=0;layer.beginTime=0
                layer.beginTime=layer.convertTime(CACurrentMediaTime(),from:nil)-offset
            }
        }
    }
    func pauseHeroIdle(preserveLogoIdle:Bool=false) {
        heroCartoonShells.forEach{$0.layer.removeAnimation(forKey:NativeHubBackpackFeedback.animationKey)}
        var layers:[CALayer]=preserveLogoIdle ? []:([logoIdleView.layer]+shards.map{$0.layer}+navIdleShells.map{$0.layer})
        if let i=idleSlide {layers += [heroImages[i].layer,ctaIdleShells[i].layer]}
        for layer in layers where layer.speed != 0 {
            let time=layer.convertTime(CACurrentMediaTime(),from:nil);layer.speed=0;layer.timeOffset=time
        }
    }
    func stopHeroIdle(preservePaintedPose:Bool = false,preserveLogoIdle:Bool=false) {
        if !preservePaintedPose {heroCartoonShells.forEach{$0.layer.removeAnimation(forKey:NativeHubBackpackFeedback.animationKey)}}
        CATransaction.begin();CATransaction.setDisableActions(true)
        for image in heroImages {
            let layer = image.layer
            let painted = preservePaintedPose ? layer.presentation()?.transform ?? layer.transform : CATransform3DIdentity
            layer.removeAnimation(forKey:"native-hero-idle");layer.speed = 1;layer.timeOffset = 0;layer.beginTime = 0;layer.transform = painted
        }
        for shell in ctaIdleShells {
            let layer=shell.layer
            let painted=preservePaintedPose ? layer.presentation()?.transform ?? layer.transform:CATransform3DIdentity
            layer.removeAnimation(forKey:"native-home-cta-idle");layer.speed=1;layer.timeOffset=0;layer.beginTime=0;layer.transform=painted
        }
        if !preserveLogoIdle {
            let layer=logoIdleView.layer
            let painted=preservePaintedPose ? layer.presentation()?.transform ?? layer.transform:CATransform3DIdentity
            layer.removeAnimation(forKey:"native-home-logo-idle");layer.speed=1;layer.timeOffset=0;layer.beginTime=0;layer.transform=painted
        }
        if !preserveLogoIdle {
            for index in shards.indices {
                let layer=shards[index].layer
                let base=CATransform3DMakeScale(index==3 ? -1:1,1,1)
                let painted=preservePaintedPose ? layer.presentation()?.transform ?? layer.transform:base
                layer.removeAnimation(forKey:"native-home-shard-idle");layer.speed=1;layer.timeOffset=0;layer.beginTime=0;layer.transform=painted
            }
        }
        if !preserveLogoIdle {
            for shell in navIdleShells {
                let layer=shell.layer
                let painted=preservePaintedPose ? layer.presentation()?.transform ?? layer.transform:CATransform3DIdentity
                layer.removeAnimation(forKey:"native-home-nav-idle");layer.speed=1;layer.timeOffset=0;layer.beginTime=0;layer.transform=painted
            }
        }
        idleSlide = nil;CATransaction.commit()
    }
    override var isHidden: Bool {didSet {if isHidden {stopHeroIdle()}}}
    override func didMoveToWindow() {super.didMoveToWindow();if window == nil {stopHeroIdle()}}

    @objc private func activate(_ button: UIButton) {
        guard !dragging, !ctaActivationPending, button.tag == selectedSlide else { return }
        guard button === ctas[selectedSlide] else {
            NativeHubBackpackFeedback.play(on:heroCartoonShells[selectedSlide])
            onHeroContact?()
            onActivate?(selectedSlide);return
        }
        onHeroContact?()
        ctaActivationPending = true
        animateCTA(button.tag, pressed: false) { [weak self] in
            self?.ctaActivationPending = false
        }
        // Release feedback and route motion have separate shells. Start the
        // route now, rather than using the 260ms rebound as an input queue.
        onActivate?(selectedSlide)
    }

    @objc private func pressCTA(_ button: UIButton) {
        guard !dragging, !ctaActivationPending else { return }
        NativeHubBackpackFeedback.play(on:ctaCartoonShells[button.tag])
        animateCTA(button.tag, pressed: true)
    }

    @objc private func cancelCTA(_ button: UIButton) {
        guard !ctaActivationPending else { return }
        animateCTA(button.tag, pressed: false)
    }

    private func animateCTA(_ index: Int, pressed: Bool, completion: (() -> Void)? = nil) {
        ctaPressGeneration[index] += 1
        let generation = ctaPressGeneration[index]
        let layer = ctaPressShells[index].layer
        let from = layer.presentation()?.transform ?? layer.transform
        let scale = pressed ? 0.84 : 1.0
        let y = pressed ? 4.0 : 0.0
        let ease: JimiV9Motion.Ease = pressed ? .powerOut(2) : .backOut(2.1)
        let animation = CAKeyframeAnimation(keyPath: "transform")
        animation.values = (0...30).map { step in
            let t = ease.value(Double(step) / 30)
            let s = Double(from.m11) + (scale - Double(from.m11)) * t
            let offset = Double(from.m42) + (y - Double(from.m42)) * t
            return NSValue(caTransform3D: CATransform3DScale(CATransform3DMakeTranslation(0, offset, 0), s, s, 1))
        }
        animation.duration = pressed ? 0.12 : 0.26
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        CATransaction.setCompletionBlock { [weak self] in
            guard let self, self.ctaPressGeneration[index] == generation else { return }
            completion?()
        }
        layer.removeAnimation(forKey: "cta-press")
        layer.transform = CATransform3DScale(CATransform3DMakeTranslation(0, y, 0), scale, scale, 1)
        layer.add(animation, forKey: "cta-press")
        CATransaction.commit()
    }

    private func resetCTAFeedback() {
        ctaActivationPending = false
        CATransaction.begin(); CATransaction.setDisableActions(true)
        for shell in ctaCartoonShells {shell.layer.removeAnimation(forKey:NativeHubBackpackFeedback.animationKey)}
        for (index, shell) in ctaPressShells.enumerated() {
            ctaPressGeneration[index] += 1
            shell.layer.removeAnimation(forKey: "cta-press")
            shell.layer.transform = CATransform3DIdentity
        }
        CATransaction.commit()
    }

    @objc private func selectTab(_ button: UIButton) {
        onSlideSelected?(button.tag)
    }

    override func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        guard gestureRecognizer === panGesture else { return true }
        let velocity = panGesture.velocity(in: viewport)
        return !isHidden && isUserInteractionEnabled && abs(velocity.x) > abs(velocity.y)*1.5
    }

    /// Route/background owner cancels without requesting another selection.
    func cancelPan(preservingCTAFeedback: Bool = false) {
        if !preservingCTAFeedback { resetCTAFeedback() }
        sliderTrack.layer.removeAnimation(forKey:"native-slide-selection")
        for node in navigationLayoutTargets {node.view.layer.removeAnimation(forKey:"native-slide-selection")}
        dragging = false
        draggedPositionX = nil
        panGesture.isEnabled = false
        panGesture.isEnabled = true
        setNeedsLayout()
    }

    @objc private func pan(_ recognizer: UIPanGestureRecognizer) {
        let translation = recognizer.translation(in: viewport).x
        switch recognizer.state {
        case .began:
            // Sample before the controller retires a previous selection owner.
            let paintedX = sliderTrack.layer.presentation()?.position.x ?? sliderTrack.layer.position.x
            guard onPanBegan?() == true else { cancelPan(); return }
            dragging = true
            dragStartPositionX = paintedX
            dragRecognitionTranslation = translation
            // UIKit has already accumulated movement before recognizing a pan.
            // Adopt the painted pose, then start finger-relative movement there;
            // adding that recognition distance would jump on the first frame.
            recognizer.setTranslation(.zero, in: viewport)
            updatePanPosition(0)
        case .changed:
            guard dragging else { return }
            updatePanPosition(translation)
        case .ended, .cancelled, .failed:
            guard dragging else { return }
            dragging = false
            let cancelled = recognizer.state != .ended
            // Commit the final touch sample before the controller captures the
            // snap's start pose. UIKit supplies filtered velocity in points/sec.
            if !cancelled { updatePanPosition(translation) }
            let destination = cancelled ? selectedSlide : JimiV9Motion.sliderDragDestination(
                selectedSlide: selectedSlide, distance: Double(translation + dragRecognitionTranslation),
                velocityPointsPerMillisecond: Double(recognizer.velocity(in: viewport).x) / 1000)
            if let complete = onPanEnded { complete(destination, cancelled) }
            else { selectSlide(selectedSlide, animated: false) }
        default: break
        }
    }

    private func updatePanPosition(_ translation: CGFloat) {
        let displacement = JimiV9Motion.sliderDragDisplacement(selectedSlide: selectedSlide, distance: Double(translation))
        let position = dragStartPositionX + CGFloat(displacement)
        draggedPositionX = position
        CATransaction.begin(); CATransaction.setDisableActions(true)
        sliderTrack.layer.position.x = position
        CATransaction.commit()
    }
}
