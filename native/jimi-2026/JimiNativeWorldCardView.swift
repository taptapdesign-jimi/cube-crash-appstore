import UIKit

private final class JimiWorldRotorView: UIView { override class var layerClass: AnyClass { CATransformLayer.self } }

/// Static undecorated carved divider; UIKit redraws only when its bounds change.
private final class JimiWorldTitleDivider:UIView {
    private let mirrored:Bool
    init(mirrored:Bool){self.mirrored=mirrored;super.init(frame:.zero);backgroundColor = .clear;isOpaque=false;contentMode = .redraw}
    required init?(coder:NSCoder){fatalError("init(coder:) has not been implemented")}
    override func draw(_ rect:CGRect){
        guard let context=UIGraphicsGetCurrentContext(),bounds.width>0 else{return}
        context.saveGState();defer{context.restoreGState()}
        if mirrored {context.translateBy(x:bounds.width,y:0);context.scaleBy(x:-1,y:1)}
        let w=bounds.width,mid=bounds.midY
        let stem=UIBezierPath();stem.move(to:CGPoint(x:1,y:mid+1));stem.addCurve(to:CGPoint(x:w-1,y:mid),controlPoint1:CGPoint(x:w*0.32,y:mid+0.8),controlPoint2:CGPoint(x:w*0.7,y:mid-0.8))
        context.saveGState();context.translateBy(x:0,y:1)
        UIColor(red:1,green:0.98,blue:0.92,alpha:0.95).setStroke();stem.lineWidth=1.8;stem.stroke();context.restoreGState()
        UIColor(red:0.81,green:0.66,blue:0.49,alpha:0.65).setStroke();stem.lineWidth=0.9;stem.stroke()

    }
}

/// Circular continuation whose exposed rim is resolved against the live slab outline.
private final class JimiWorldStoneCloseSurface:UIView {
    let texture=UIImageView()
    private let face=UIView(),material=UIView()
    private let bevel=CAGradientLayer(),blend=CAGradientLayer()
    private let bevelMask=CAShapeLayer(),faceMask=CAShapeLayer()
    private var joinedPanelOutline:CGPath?
    override init(frame:CGRect){
        super.init(frame:frame);isUserInteractionEnabled=false;backgroundColor = .clear
        addSubview(face);face.addSubview(material);material.addSubview(texture)
        face.layer.mask=faceMask;texture.layer.mask=blend;material.layer.addSublayer(bevel)
        texture.contentMode = .scaleToFill;texture.layer.minificationFilter = .trilinear
        texture.layer.allowsEdgeAntialiasing=true
        // The inner neck disappears into the slab rather than outlining a separate coin.
        blend.colors=[UIColor.clear.cgColor,UIColor.white.cgColor,UIColor.white.cgColor]
        blend.locations=[0,0.48,1];blend.startPoint=CGPoint(x:0,y:1);blend.endPoint=CGPoint(x:1,y:0)
        bevel.colors=[UIColor(red:1,green:0.985,blue:0.94,alpha:0.95).cgColor,UIColor(red:0.97,green:0.93,blue:0.86,alpha:0.85).cgColor,UIColor(red:0.74,green:0.61,blue:0.47,alpha:0.42).cgColor]
        bevel.locations=[0,0.52,1];bevel.startPoint=CGPoint(x:0,y:0);bevel.endPoint=CGPoint(x:1,y:1);bevel.mask=bevelMask
        bevel.name="native.world.card.close.stone-bevel"
        face.accessibilityIdentifier="native.world.card.close.flush-face"
    }
    required init?(coder:NSCoder){fatalError("init(coder:) has not been implemented")}
    func setTexture(_ image:UIImage?){texture.image=image}
    func join(panel:JimiWorldInfoPanelView) {
        var translation=CGAffineTransform(translationX:panel.frame.minX-frame.minX,y:panel.frame.minY-frame.minY)
        joinedPanelOutline=panel.shadowOutline.copy(using:&translation)
        setNeedsLayout()
    }
    override func layoutSubviews(){
        super.layoutSubviews();CATransaction.begin();CATransaction.setDisableActions(true)
        // A true circle; the main slab already supplies the inside part of its silhouette.
        // Never add a rectangular patch or a guessed connector over the slab's top edge.
        face.frame=bounds;material.frame=face.bounds
        faceMask.frame=face.bounds;faceMask.path=UIBezierPath(ovalIn:face.bounds).cgPath
        texture.frame=CGRect(x:-244,y:-35,width:326,height:506)
        blend.frame=CGRect(x:244,y:35,width:bounds.width,height:bounds.height)
        bevel.frame=material.bounds;bevelMask.frame=bevel.bounds
        let center=CGPoint(x:bounds.midX,y:bounds.midY),radius=bounds.width/2
        let exposed=UIBezierPath();var previousWasExposed=false
        for step in 0...360 {
            let angle=CGFloat(step)*2 * .pi/360
            let point=CGPoint(x:center.x+cos(angle)*radius,y:center.y+sin(angle)*radius)
            let outside = !(joinedPanelOutline?.contains(point) ?? false)
            if outside {
                if previousWasExposed {exposed.addLine(to:point)}else{exposed.move(to:point)}
            }
            previousWasExposed=outside
        }
        // Five-point visible sculpted rim, meeting the actual slab edge at both ends.
        bevelMask.path=exposed.cgPath.copy(strokingWithWidth:10,lineCap:.round,lineJoin:.round,miterLimit:2)
        CATransaction.commit()
    }
}

/// Finite milestone using the source modal's pauseable compositor clock.
@MainActor private final class JimiWorldStatExitReceipt:NSObject,CAAnimationDelegate {
    private let layer=CALayer()
    private var completion:(()->Void)?
    init(parent:CALayer,completion:@escaping()->Void){
        self.completion=completion;super.init();parent.addSublayer(layer)
        let mark=CABasicAnimation(keyPath:"opacity");mark.fromValue=1;mark.toValue=1
        mark.duration=0.65*0.6;mark.delegate=self;layer.add(mark,forKey:"history.entry-ready")
    }
    func animationDidStop(_ animation:CAAnimation,finished:Bool){
        guard finished else{return};let done=completion;completion=nil;layer.removeFromSuperlayer();done?()
    }
    func cancel(){completion=nil;layer.removeAllAnimations();layer.removeFromSuperlayer()}
}

private final class JimiWorldCameraStage: UIView {
    override func hitTest(_ point:CGPoint,with event:UIEvent?) -> UIView? {
        let hit = super.hitTest(point,with:event);return hit === self ? nil : hit
    }
}

/// Info-back only: one textured sculpted slab, including its rounded thickness.
/// No painted border/stroke. The collectible illustration remains untouched.
@MainActor
private final class JimiWorldInfoPanelView:UIImageView {
    override init(frame:CGRect){
        super.init(frame:frame)
        accessibilityIdentifier = "native.world.card.info-panel"
        contentMode = .scaleToFill;isUserInteractionEnabled = false
        layer.allowsEdgeAntialiasing = true
        layer.minificationFilter = .trilinear
    }
    required init?(coder:NSCoder){fatalError("init(coder:) has not been implemented")}
    private func outline(in rect:CGRect)->UIBezierPath {
        let scale = rect.width/326, r = 30*scale
        let x = rect.minX,y = rect.minY,w = rect.width,h = rect.height
        let top = 6*scale,bottom = 11*scale,shoulder = 40*scale
        let path = UIBezierPath()
        // Every join has the same tangent on both sides. The bottom is one
        // continuous rolled silhouette, with no corner ears or folded tabs.
        path.move(to:CGPoint(x:x,y:y+shoulder))
        path.addCurve(to:CGPoint(x:x+r,y:y+top),controlPoint1:CGPoint(x:x,y:y+22*scale),controlPoint2:CGPoint(x:x+10*scale,y:y+top))
        path.addCurve(to:CGPoint(x:x+w/2,y:y),controlPoint1:CGPoint(x:x+75*scale,y:y+top),controlPoint2:CGPoint(x:x+w/2-45*scale,y:y))
        path.addCurve(to:CGPoint(x:x+w-r,y:y+top),controlPoint1:CGPoint(x:x+w/2+45*scale,y:y),controlPoint2:CGPoint(x:x+w-75*scale,y:y+top))
        path.addCurve(to:CGPoint(x:x+w,y:y+shoulder),controlPoint1:CGPoint(x:x+w-10*scale,y:y+top),controlPoint2:CGPoint(x:x+w,y:y+22*scale))
        path.addLine(to:CGPoint(x:x+w,y:y+h-shoulder))
        path.addCurve(to:CGPoint(x:x+w-r,y:y+h-bottom),controlPoint1:CGPoint(x:x+w,y:y+h-22*scale),controlPoint2:CGPoint(x:x+w-10*scale,y:y+h-bottom))
        path.addCurve(to:CGPoint(x:x+w/2,y:y+h),controlPoint1:CGPoint(x:x+w-75*scale,y:y+h-bottom),controlPoint2:CGPoint(x:x+w/2+45*scale,y:y+h))
        path.addCurve(to:CGPoint(x:x+r,y:y+h-bottom),controlPoint1:CGPoint(x:x+w/2-45*scale,y:y+h),controlPoint2:CGPoint(x:x+75*scale,y:y+h-bottom))
        path.addCurve(to:CGPoint(x:x,y:y+h-shoulder),controlPoint1:CGPoint(x:x+10*scale,y:y+h-bottom),controlPoint2:CGPoint(x:x,y:y+h-22*scale))
        path.close();return path
    }
    var shadowOutline:CGPath {outline(in:bounds).cgPath}
}

/// Static leased artwork. The existing card rotor owns entry/exit and retirement.
/// Values remain live labels; the user explicitly removed number recesses.
@MainActor
private final class JimiWorldStatTileView: UIView {
    var onTap:(()->Void)?
    @objc private func tappedStat(){onTap?()}
    let icon = UIImageView(), value = UILabel(), caption = UILabel()
    private let surface = UIImageView()
    var idleSurfaceLayer:CALayer {surface.layer}
    struct IdleProfile {
        let duration:Double,phase:Double,lift:Double,drift:Double,rotation:Double,stoneScale:Double
        init(index:Int) {
            // Disjoint tempo bands prevent mirrored/synchronous stat-card motion.
            duration=Double.random(in:index == 0 ? 5.2...6.2:6.6...7.8)
            phase=Double.random(in:0...(2 * .pi))
            lift=Double.random(in:0.9...1.6);drift=Double.random(in:0.25...0.65)
            rotation=Double.random(in:0.10...0.22) * .pi/180 * (Bool.random() ? 1:-1)
            stoneScale=Double.random(in:0.004...0.007)
        }
        func wave(_ progress:Double,offset:Double=0)->Double {
            (sin(2 * .pi * progress+phase+offset)-sin(phase+offset))/2
        }
    }
    let idleProfile:IdleProfile
    init(index:Int, text:String, assets:JimiV9Artwork, resources:JimiNativeWorldResources, boardID:Int) {
        idleProfile=IdleProfile(index:index)
        super.init(frame:.zero)
        accessibilityIdentifier = "native.world.card.stat.\(index)"
        isUserInteractionEnabled = true;isOpaque = false;backgroundColor = .clear
        surface.image = resources.image(JimiNativeWorldCardView.statTileBackgroundPaths[index],owner:boardID)
        surface.contentMode = .scaleToFill;surface.isUserInteractionEnabled = false
        surface.accessibilityIdentifier = "native.world.card.stat.\(index).wood-surface"
        // Density-specific authored alpha preserves the thin cream stone edge.
        surface.layer.allowsEdgeAntialiasing = true
        surface.layer.minificationFilter = .trilinear
        addSubview(surface)
        // The authored cream edge is the complete depth; no extra pedestal.
        layer.shadowOpacity = 0
        icon.image = resources.image(index == 0 ? "assets/highscore-icon.png" : "assets/combo-icon.png",owner:boardID)
        icon.contentMode = .scaleAspectFit;icon.accessibilityIdentifier = "native.world.card.stat.\(index).icon"
        value.text = text;value.font = assets.font(size:34,weight:"Bold")
        value.textColor = UIColor(red:236/255,green:112/255,blue:69/255,alpha:1)
        value.accessibilityIdentifier = "native.world.card.stat.\(index).value"
        caption.text = index == 0 ? "High score" : "Best combo"
        caption.font = assets.font(size:18,weight:"Regular")
        caption.textColor = NativeTextPalette.subtitle
        caption.accessibilityIdentifier = "native.world.card.stat.\(index).caption"
        for label in [value,caption] {
            label.textAlignment = .center;label.numberOfLines = 1
            label.adjustsFontSizeToFitWidth = true;label.minimumScaleFactor = 0.7
            label.baselineAdjustment = .alignCenters
        }
        addSubview(icon);addSubview(value);addSubview(caption)
        addGestureRecognizer(UITapGestureRecognizer(target:self,action:#selector(tappedStat)))
    }
    required init?(coder:NSCoder) {fatalError("init(coder:) has not been implemented")}
    override func layoutSubviews() {
        super.layoutSubviews()
        let scale = min(bounds.width/138,bounds.height/176)
        CATransaction.begin();CATransaction.setDisableActions(true)
        surface.bounds = bounds;surface.center = CGPoint(x:bounds.midX,y:bounds.midY)
        surface.layer.contentsRect = CGRect(x:0,y:0,width:1,height:1)
        surface.transform = .identity
        CATransaction.commit()
        let side = 86*0.8*scale
        icon.frame = CGRect(x:(bounds.width-side)/2,y:18*scale,width:side,height:side)
            .insetBy(dx:-side*0.05,dy:-side*0.05)
        value.frame = CGRect(x:6*scale,y:86*scale,width:max(0,bounds.width-12*scale),height:42*scale)
        caption.frame = CGRect(x:6*scale,y:127*scale,width:max(0,bounds.width-12*scale),height:24*scale)
    }
}

/// Two leased images let the empty star shrink independently of its earned replacement.
@MainActor
private final class JimiWorldStarSlotView:UIView {
    let artwork:UIImageView,empty:UIImageView?
    init(index:Int,earned:Bool,resources:JimiNativeWorldResources,owner:Int) {
        artwork=UIImageView(image:resources.image(earned ? "assets/modals/star.png":"assets/modals/star-empty.png",owner:owner))
        empty=earned ? UIImageView(image:resources.image("assets/modals/star-empty.png",owner:owner)):nil
        super.init(frame:.zero);isUserInteractionEnabled=false
        artwork.accessibilityIdentifier="native.world.card.star.\(index)"
        for image in [empty,artwork].compactMap({$0}) {
            image.contentMode = .scaleAspectFit;image.layer.allowsEdgeAntialiasing=true
            image.layer.minificationFilter = .trilinear;addSubview(image)
        }
        empty?.accessibilityIdentifier="native.world.card.star.\(index).empty"
        if earned {artwork.transform=CGAffineTransform(scaleX:0,y:0)}
        widthAnchor.constraint(equalToConstant:31.45).isActive=true
        heightAnchor.constraint(equalToConstant:31.45).isActive=true
    }
    required init?(coder:NSCoder){fatalError("init(coder:) has not been implemented")}
    override func layoutSubviews(){
        super.layoutSubviews()
        for image in [empty,artwork].compactMap({$0}) {image.bounds=bounds;image.center=CGPoint(x:bounds.midX,y:bounds.midY)}
    }
}

/// One physical carrier/rotor, separate spatial and face transforms. No game rules.
@MainActor
final class JimiNativeWorldCardView: UIView, UIGestureRecognizerDelegate {
    static let statTileBackgroundPaths = ["assets/ui/right score card.png", "assets/ui/left score card.png"]
    static let infoPanelBackgroundPaths = (1...3).map { String(format:"assets/ui/stage-info-card-%02d.png",$0) }
    static let infoPanelBottomExtension:CGFloat = 24
    let infoPanelAssetPath:String
    let boardID: Int
    private var starMotionEpoch:CFTimeInterval?
    private var starPulseBeginTimes:[Int:CFTimeInterval]=[:]
    private let earnedStarCount:Int
    var onFeedback: ((String) -> Void)?
    var onPrepareGameplayAssets:(()->Void)?
    private var gameplayPreparation:DispatchWorkItem?
    var hasScheduledGameplayPreparation:Bool {gameplayPreparation != nil}
    var onRequest: ((String) -> Void)?
    private let cameraStage = JimiWorldCameraStage()
    private let carrier = JimiWorldRotorView(), dragShell = JimiWorldRotorView(), effectShell = JimiWorldRotorView(), pinchShell = JimiWorldRotorView(), rotorShell = JimiWorldRotorView()
    private var rotor: CALayer { rotorShell.layer }
    private let front = UIImageView(), back = UIView()
    private let frontFloat = JimiWorldRotorView(), backFloat = JimiWorldRotorView()
    private let panel = JimiWorldInfoPanelView(frame:.zero)
    private let closeButton = JimiV9PlainButton(type:.custom), backdrop = UIButton(type:.custom)
    private let closePaper = JimiWorldStoneCloseSurface(frame:.zero), closeIcon = UIImageView()
    private var closeTexture:UIImageView {closePaper.texture}
    private let title = UILabel(), stats = UIStackView(), stars = UIStackView()
    private let titleDividers = [JimiWorldTitleDivider(mirrored:false),JimiWorldTitleDivider(mirrored:true)]
    private let cta = JimiV9PlainButton(type:.custom)
    private var angle: Double = 0
    var stableFaceAngle: Double {angle}
    private var animating = false
    private var generation = 0
    private var frontDrag = false
    private var dragAxis: String?
    private var dragStartAngle: Double = 0
    private let originRotation: CGFloat
    private let tilt: CGFloat
    private let backTilt: CGFloat
    private var base = CGRect.zero
    private let duration = 0.520 / 0.98
    private var entryFlipReceipt:JimiWorldAnimationStart?
    private var effects: JimiNativeWorldCardEffects?
    private var active = true, disposed = false, closing = false, pinching = false
    private var flipGeneration = 0
    private var manualFlipInFlight = false
    var acceptsCardPan:Bool {active && !disposed && !closing && !pinching && (!animating || manualFlipInFlight)}
    private var stableCTAEnabled = false
    private weak var resources: JimiNativeWorldResources?
    private let cardArt2x: String?
    private var newRibbon:UIImageView?

    init(unit:JimiNativeWorldSnapshot.Unit,assets:JimiV9Artwork,resources:JimiNativeWorldResources,worldTitle:String = "Forest",presentationHasNewRibbon:Bool? = nil,coachSession:JimiNativeWorldCardCoachPolicy? = nil,infoPanelVariant:Int? = nil) {
        let variants=Self.infoPanelBackgroundPaths
        let variant=infoPanelVariant.flatMap {variants.indices.contains($0) ? $0:nil} ?? Int.random(in:variants.indices)
        infoPanelAssetPath=variants[variant]
        earnedStarCount=unit.stars
        boardID = unit.boardID
        self.resources = resources;cardArt2x = unit.cardArt2x
        originRotation = unit.parts.first(where:{$0.role == "card"})?.rotation ?? 0
        let direction: CGFloat = Bool.random() ? 1 : -1
        tilt = CGFloat.random(in:4.75...6.25) * .pi / 180 * direction
        backTilt = CGFloat.random(in:2...3.25) * .pi / 180 * -direction
        super.init(frame:.zero)
        accessibilityIdentifier = "native.world.card.modal"
        rotorShell.accessibilityIdentifier = "native.world.card.rotor"
        backdrop.backgroundColor = JimiNativeModalV10.backdropColor;backdrop.alpha = 0
        backdrop.addTarget(self,action:#selector(requestClose),for:.touchUpInside)
        cameraStage.accessibilityIdentifier = "native.world.card.camera"
        addSubview(backdrop);addSubview(cameraStage);cameraStage.addSubview(carrier);carrier.addSubview(dragShell);dragShell.addSubview(effectShell);effectShell.addSubview(pinchShell);pinchShell.addSubview(rotorShell)
        rotorShell.addSubview(frontFloat);frontFloat.addSubview(front);rotorShell.addSubview(backFloat);backFloat.addSubview(back)
        frontFloat.accessibilityIdentifier = "native.world.card.game-float"
        backFloat.accessibilityIdentifier = "native.world.card.info-float"
        front.image = resources.image(unit.cardArt,owner:boardID); front.contentMode = .scaleAspectFit
        if presentationHasNewRibbon ?? unit.newRibbon {
            let ribbon = JimiNativeWorldRibbon.make(image:resources.image("assets/journey assets/orange-ribbon.png",owner:boardID),assets:assets,cardSize:.zero,scale:1,portal:true)
            (ribbon as? JimiNativeNewRibbonView)?.setCardRotation(tilt)
            newRibbon = ribbon; front.addSubview(ribbon)
        }
        front.layer.isDoubleSided = false; back.layer.isDoubleSided = false
        front.layer.transform = CATransform3DMakeTranslation(0,0,0.6)
        back.layer.transform = CATransform3DTranslate(CATransform3DMakeRotation(-.pi,0,1,0),0,0,0.6)
        back.addSubview(panel)
        panel.image = resources.image(infoPanelAssetPath,owner:boardID)
        title.accessibilityIdentifier = "native.world.card.stage-title"
        title.text = String(format:"Stage %02d",(boardID-1)%10+1); title.font = assets.font(size:28,weight:"ExtraBold"); title.textAlignment = .center; title.textColor = NativeTextPalette.modalTitle; back.addSubview(title)
        stars.axis = .horizontal; stars.spacing = 8; stars.alignment = .center
        stars.accessibilityIdentifier = "native.world.card.stars"
        for index in 0..<3 {
            let slot=JimiWorldStarSlotView(index:index,earned:index<unit.stars,resources:resources,owner:boardID)
            slot.transform=index == 1 ? CGAffineTransform(translationX:0,y:-8):CGAffineTransform(rotationAngle:index == 0 ? -8 * .pi/180:8 * .pi/180)
            stars.addArrangedSubview(slot)
        }
        back.addSubview(stars)
        for (index,divider) in titleDividers.enumerated() {
            divider.accessibilityIdentifier = "native.world.card.title-divider.\(index)"
            divider.isUserInteractionEnabled = false;back.addSubview(divider)
        }
        stats.axis = .horizontal;stats.spacing = 12;stats.distribution = .fillEqually
        stats.accessibilityIdentifier = "native.world.card.stats"
        for (index,pair) in unit.stats.prefix(2).enumerated() {
            let tile=JimiWorldStatTileView(index:index,text:pair.1,assets:assets,resources:resources,boardID:boardID)
            tile.onTap={ [weak self,weak tile] in
                guard let self,let tile,self.active,!self.disposed,!self.closing,!self.animating,!self.historyVisible,self.isBackFacing else{return}
                NativeHubBackpackFeedback.play(on:tile);self.onFeedback?("cta")
                self.onRequest?(index==0 ? "scoreHistory":"comboHistory")
            }
            stats.addArrangedSubview(tile)
        }
        back.addSubview(stats)
        let action = unit.actions.contains("continue") ? "continue" : "play"
        cta.accessibilityIdentifier = "native.world.card.\(action)"
        cta.setTitle(action == "continue" ? "Continue" : "Play",for:.normal)
        cta.applyModalCTA(artwork:assets)
        stableCTAEnabled = unit.actions.contains(action);cta.isEnabled = stableCTAEnabled; cta.addAction(UIAction { [weak self] _ in guard let self,self.active,!self.disposed,!self.closing,!self.animating,!self.pinching else {return}; self.onFeedback?("cta"); self.onRequest?(action) },for:.touchUpInside); back.addSubview(cta);cta.enableCartoonBounce()
        closePaper.setTexture(panel.image);back.addSubview(closePaper);back.bringSubviewToFront(closeButton)
        closeIcon.image = assets.image("assets/close-icon.png",densityAware:true);closeIcon.contentMode = .scaleAspectFit;closeIcon.alpha = 0.8;closeIcon.isUserInteractionEnabled = false;closeButton.addSubview(closeIcon);closeButton.enableArtworkTapFeedback(on:closeIcon)
        closeTexture.accessibilityIdentifier = "native.world.card.close.stone-texture"
        closePaper.accessibilityIdentifier = "native.world.card.close.stone-circle"
        closeButton.layer.shadowColor = UIColor(red:0.83,green:0.71,blue:0.59,alpha:1).cgColor
        closeButton.layer.shadowOpacity = 0;closeButton.layer.shadowRadius = 3;closeButton.layer.shadowOffset = CGSize(width:0,height:2)
        closeButton.accessibilityIdentifier = "native.world.card.close"; closeButton.addTarget(self,action:#selector(requestClose),for:.touchUpInside); back.addSubview(closeButton)
        // Face changes are drag/swipe only; stat taps own their detail route.
        let pan = UIPanGestureRecognizer(target:self,action:#selector(drag(_:)));pan.delegate = self;pan.maximumNumberOfTouches = 1;carrier.addGestureRecognizer(pan)
        let pinch = UIPinchGestureRecognizer(target:self,action:#selector(pinched(_:)));pinch.delegate = self;carrier.addGestureRecognizer(pinch)
        cta.addTarget(self,action:#selector(pressCTA),for:[.touchDown,.touchDragEnter])
        cta.addTarget(self,action:#selector(releaseCTA),for:[.touchUpInside,.touchUpOutside,.touchCancel,.touchDragExit])
        var perspective = CATransform3DIdentity; perspective.m34 = -1/1050; cameraStage.layer.sublayerTransform = perspective
        for face in [front as UIView,back] {face.layer.shadowColor = UIColor(red:165/255,green:124/255,blue:98/255,alpha:1).cgColor;face.layer.shadowOpacity = 0.86;face.layer.shadowRadius = 18;face.layer.shadowOffset = CGSize(width:0,height:14)}
        effects = JimiNativeWorldCardEffects(front:front,impact:effectShell,overlay:self,assets:assets,resources:resources,boardID:boardID,rarity:unit.cardRarity,coachSession:coachSession)

    }
    required init?(coder:NSCoder) {fatalError("init(coder:) has not been implemented")}
    override func layoutSubviews() {
        super.layoutSubviews(); backdrop.frame = bounds;cameraStage.frame = bounds
        closeButton.bounds = CGRect(x:0,y:0,width:52,height:52)
        closeButton.center = CGPoint(x:carrier.bounds.width-20,y:36)
        closeButton.transform = CGAffineTransform(rotationAngle:-backTilt*2)
        closePaper.bounds = CGRect(x:0,y:0,width:56,height:56)
        closePaper.center = closeButton.center
        closeButton.layer.shadowPath = UIBezierPath(ovalIn:closeButton.bounds.insetBy(dx:-2,dy:-2)).cgPath
        closeIcon.frame = CGRect(x:14,y:14,width:24,height:24)
        let size = carrier.bounds.size;dragShell.frame = carrier.bounds;effectShell.frame = carrier.bounds;pinchShell.frame = carrier.bounds;rotorShell.frame = carrier.bounds
        frontFloat.bounds = carrier.bounds;frontFloat.center = CGPoint(x:size.width/2,y:size.height/2);front.bounds = carrier.bounds;front.center = CGPoint(x:size.width/2,y:size.height/2);backFloat.bounds = carrier.bounds;backFloat.center = front.center;back.bounds = carrier.bounds;back.center = front.center;panel.frame = carrier.bounds
        // Keep the existing carrier/front and every live control fixed. Only the
        // info artwork extends24pt downward, scaled with narrow/short viewports.
        // User's exact nominal stage card:326x481.76pt. Narrow/short viewports
        // scale spacing/art first, keeping the original labels and CTA owner.
        let layoutScale = min(size.width/326,size.height/481.76)
        panel.frame = CGRect(x:0,y:0,width:size.width,height:size.height+Self.infoPanelBottomExtension*layoutScale)
        let ctaWidth:CGFloat = min(238*layoutScale,size.width-32)
        cta.setCartoonBounceFrame(CGRect(x:(size.width-ctaWidth)/2,y:size.height-38*layoutScale-JimiV9PlainButton.primaryCTAHeight,width:ctaWidth,height:JimiV9PlainButton.primaryCTAHeight))
        let starSide = 40*layoutScale
        stars.spacing = 8*layoutScale
        let starsWidth = starSide*3+stars.spacing*2
        stars.frame = CGRect(x:(size.width-starsWidth)/2,y:56*layoutScale,width:starsWidth,height:starSide)
        for (index,star) in stars.arrangedSubviews.enumerated() {
            star.constraints.first(where:{$0.firstAttribute == .width})?.constant = starSide
            star.constraints.first(where:{$0.firstAttribute == .height})?.constant = starSide
            star.transform = index == 1 ? CGAffineTransform(translationX:0,y:-8*layoutScale) : CGAffineTransform(rotationAngle:index == 0 ? -8 * .pi/180 : 8 * .pi/180)
        }
        let titleWidth = min(ceil(title.intrinsicContentSize.width),max(0,size.width-72))
        title.frame = CGRect(x:(size.width-titleWidth)/2,y:118*layoutScale,width:titleWidth,height:36*layoutScale)
        let sideInset:CGFloat = 24*layoutScale
        let lineGap:CGFloat = 12
        let oldLineWidth = max(0,title.frame.minX-sideInset-lineGap)*0.8
        let lineWidth = oldLineWidth*0.9*0.85,trim = (oldLineWidth-lineWidth)/2
        titleDividers[0].frame = CGRect(x:title.frame.minX-lineGap-oldLineWidth+trim,y:title.frame.midY-5,width:lineWidth,height:10)
        titleDividers[1].frame = CGRect(x:title.frame.maxX+lineGap+trim,y:title.frame.midY-5,width:lineWidth,height:10)
        stats.spacing = 2*layoutScale
        stats.frame = CGRect(x:sideInset,y:166*layoutScale,width:max(0,size.width-2*sideInset),height:max(0,min(176*layoutScale,cta.cartoonBounceFrame.minY-12-166*layoutScale)))
        stats.setNeedsLayout();stats.layoutIfNeeded()
        stars.setNeedsLayout();stars.layoutIfNeeded()
        panel.setNeedsLayout();panel.layoutIfNeeded()
        closePaper.join(panel:panel);closePaper.layoutIfNeeded()
        back.layer.shadowPath = panel.shadowOutline
        cta.layer.shadowPath = UIBezierPath(roundedRect:cta.bounds,cornerRadius:32).cgPath
        if let newRibbon {JimiNativeWorldRibbon.layout(newRibbon,cardSize:front.bounds.size,scale:1,portal:true,compact:bounds.width<=768)}
        effects?.layout()
    }
    private var destination:CGRect {
        let scale = min(1,max(0,(bounds.width-40)/326),max(0,(bounds.height-96)/481.76))
        let width = 326*scale
        let height = 481.76*scale
        return CGRect(x:(bounds.width-width)/2,y:(bounds.height-height)/2,width:width,height:height)
    }
    private func spatialProgress(_ time:Double,returning:Bool) -> Double {
        if returning {return 1-spatialProgress(1-time,returning:false)}
        let frames:[(Double,Double)] = [(0,0),(0.58,1.105),(0.76,0.965),(0.9,1.022),(1,1)]
        for index in 1..<frames.count where time <= frames[index].0 {
            let t = (time-frames[index-1].0)/(frames[index].0-frames[index-1].0), smooth = t*t*(3-2*t)
            return frames[index-1].1+(frames[index].1-frames[index-1].1)*smooth
        }
        return 1
    }
    private func fly(from:CGRect,to:CGRect,returning:Bool,gameplay:Bool = false,contactDuration:Double = 0,returnOffset:((Double)->CGPoint)? = nil,completion:@escaping () -> Void) {
        generation += 1; let token = generation; animating = true
        let launch = gameplay ? 0.100/0.98 : 0, travel = gameplay ? 0.500/0.98 : duration, total = contactDuration+launch+travel
        let startPose = carrier.layer.presentation()?.transform ?? carrier.layer.transform
        let startRotation = returning ? atan2(startPose.m12,startPose.m11) : originRotation
        let count = Int(ceil(total*240)); let animation = CAKeyframeAnimation(keyPath:"transform")
        animation.values = (0...count).map { index -> NSValue in
            let time = Double(index)*total/Double(count)
            let progress = max(0,min(1,(time-contactDuration-launch)/travel))
            // PWA Play/Continue decelerates into the Unit before its resident
            // landing punch/collapse. Back-in belongs to that later collapse,
            // not the portal's spatial return.
            let p = gameplay ? progress*progress*(3-2*progress) : spatialProgress(progress,returning:returning)
            let offset=returnOffset?(time) ?? .zero
            let dx = to.midX+offset.x-from.midX,dy = to.midY+offset.y-from.midY,distance = hypot(dx,dy)
            let arcProgress = gameplay ? p : min(1,max(0,p))
            let arc = distance < 1 ? 0 : min(34,max(14,distance*0.075))*sin(.pi*arcProgress)
            let direction:CGFloat = dx >= 0 ? 1 : -1
            let x = from.midX+dx*p-base.midX+(distance < 1 ? 0 : -dy/distance*arc*direction), y = from.midY+dy*p-base.midY+(distance < 1 ? 0 : dx/distance*arc*direction)
            // Match the PWA's up/down launch bounce, retaining the previously
            // accepted 60% reduction of Native inflation. It returns to 1 before
            // travel, so the portal and resident Unit share the exact landing pose.
            let launchProgress = launch > 0 ? min(1,time/launch) : 1
            let punch = gameplay ? 1+0.06*0.4*(1-abs(2*launchProgress-1)) : 1
            func dimension(_ start:CGFloat,_ end:CGFloat)->CGFloat {
                (start+(end-start)*p)*punch
            }
            let width = dimension(from.width,to.width), height = dimension(from.height,to.height)
            let rotation = returning ? startRotation+(originRotation-startRotation)*p : originRotation+(backTilt-originRotation)*p
            // The same visible carrier first plays the complete shared contact
            // at the Unit's origin. Travel/flip then start without hiding the
            // squeeze inside their enlargement. Return/Reduced Motion omit it.
            let contact = contactDuration > 0 ? NativeHUDTapMotion.pose(at:time) : NativeHUDTapMotion.Pose(x:1,y:1,offset:0)
            var transform = CATransform3DMakeTranslation(x,y+contact.offset,0); transform = CATransform3DRotate(transform,rotation,0,0,1); transform = CATransform3DScale(transform,width/base.width*contact.x,height/base.height*contact.y,1)
            return NSValue(caTransform3D:transform)
        }
        animation.duration = UIAccessibility.isReduceMotionEnabled ? 0.18 : total
        animation.fillMode = .both; animation.isRemovedOnCompletion = false
        CATransaction.begin(); CATransaction.setCompletionBlock { [weak self] in guard let self,self.generation == token else {return}; self.animating = false; completion() }
        carrier.layer.add(animation,forKey:"card.flight"); CATransaction.commit()
    }
    private func transitionBackdrop(to opacity:Float,duration:Double) {
        let animation = CABasicAnimation(keyPath:"opacity")
        animation.fromValue = backdrop.layer.presentation()?.opacity ?? backdrop.layer.opacity;animation.toValue = opacity
        animation.duration = UIAccessibility.isReduceMotionEnabled ? 0.18 : duration
        animation.timingFunction = CAMediaTimingFunction(controlPoints:0.4,0,0.2,1)
        CATransaction.begin();CATransaction.setDisableActions(true);backdrop.layer.opacity = opacity;backdrop.layer.add(animation,forKey:"card.backdrop.fade");CATransaction.commit()
    }
    func enter(from origin:CGRect) {
        (newRibbon as? JimiNativeNewRibbonView)?.enter()
        scheduleGameplayPreparation()
        transitionBackdrop(to:1,duration:duration)
        base = destination; carrier.frame = base; layoutIfNeeded();effects?.layout();cta.isEnabled = false
        let contactDuration=UIAccessibility.isReduceMotionEnabled ? 0 : NativeHUDTapMotion.duration
        animateBackStats(entering:true,delay:contactDuration+duration*0.5)
        let entryToken=generation+1
        angle = -.pi;rotate(from:0,to:-.pi,duration:duration,flight:true,lead:contactDuration,onStart:{[weak self] in
            guard let self,!self.disposed,!self.closing,self.active,self.generation == entryToken else{return}
            self.onFeedback?("card-entry-flip")
        })
        // Schedule on the existing paused CA subtree, 300ms before entry lands.
        // Backwards fills keep all placeholders intact until that future boundary.
        if !UIAccessibility.isReduceMotionEnabled {
            setStarMotionPaused(false)
            playStarMotion(reducedMotion:false,delay:max(0,contactDuration+duration-0.3))
        }
        fly(from:origin,to:base,returning:false,contactDuration:contactDuration) { [weak self] in
            guard let self,!self.disposed,!self.closing else {return};CATransaction.begin();CATransaction.setDisableActions(true);self.carrier.layer.transform = CATransform3DMakeRotation(self.backTilt,0,0,1);self.carrier.layer.removeAnimation(forKey:"card.flight");CATransaction.commit();self.cta.isEnabled = self.stableCTAEnabled;self.effects?.present(frontFacing:!self.isBackFacing,opening:true);self.playInfoMotion();(self.newRibbon as? JimiNativeNewRibbonView)?.setForeground(self.active && !self.isBackFacing)
            if let path = self.cardArt2x,let resources = self.resources {let token = self.generation;resources.prepare([path],owner:self.boardID,required:false) { [weak self,weak resources] accepted in guard accepted,let self,self.generation == token else {return};if let image = resources?.image(path,owner:self.boardID) {self.front.image = image;self.effects?.layout()} } }
        }
    }
    /// v9 detail-modal preload: one captured 2400ms settled window, with at
    /// most eight900ms retries while the card is moving. No recurring ticker.
    func scheduleGameplayPreparation(delay:TimeInterval=2.4,attempt:Int=0) {
        gameplayPreparation?.cancel();gameplayPreparation=nil
        guard active,!disposed,!closing,onPrepareGameplayAssets != nil else{return}
        let token=generation
        let task=DispatchWorkItem{[weak self] in
            guard let self,self.generation==token,self.active,!self.disposed,!self.closing else{return}
            self.gameplayPreparation=nil
            let gesturing=self.carrier.gestureRecognizers?.contains{ $0.state == .began || $0.state == .changed } == true
            guard !self.animating,!self.pinching,!gesturing else{
                if attempt<8 {self.scheduleGameplayPreparation(delay:0.9,attempt:attempt+1)}
                return
            }
            self.onPrepareGameplayAssets?()
        }
        gameplayPreparation=task;DispatchQueue.main.asyncAfter(deadline:.now()+delay,execute:task)
    }
    private func cancelGameplayPreparation(){gameplayPreparation?.cancel();gameplayPreparation=nil}
    private func rotate(from:Double,to:Double,duration:Double,flight:Bool = false,lead:Double = 0,onStart:(()->Void)? = nil) {
        let animation = CAKeyframeAnimation(keyPath:"transform.rotation.y")
        animation.values = (0...128).map { index in
            let t=Double(index)/128
            let u = min(1,max(0,(t-0.32)/0.36))
            return from+(to-from)*(flight ? u*u*(3-2*u) : JimiV9Motion.Ease.powerOut(2).value(t))
        }
        animation.duration = UIAccessibility.isReduceMotionEnabled ? 0.18 : duration; animation.fillMode = .both; animation.isRemovedOnCompletion = false
        animation.beginTime=rotor.convertTime(CACurrentMediaTime(),from:nil)+lead
        entryFlipReceipt=onStart.map {JimiWorldAnimationStart($0)}
        animation.delegate=entryFlipReceipt
        rotor.add(animation,forKey:"card.flip")
        CATransaction.begin(); CATransaction.setDisableActions(true); rotor.transform = CATransform3DMakeRotation(to,0,1,0); CATransaction.commit()
    }
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        guard active,!disposed,!closing,(!animating || (gestureRecognizer is UIPanGestureRecognizer && manualFlipInFlight)) else {return false}
        var view = touch.view
        while let current = view {if current is UIControl {return false};view = current.superview}
        return true
    }
    private var infoMotionLayers:[CALayer] {
        stats.arrangedSubviews.flatMap {view in [view.layer]+((view as? JimiWorldStatTileView).map{[$0.idleSurfaceLayer]} ?? [])}+stars.arrangedSubviews.compactMap{$0 as? JimiWorldStarSlotView}.flatMap{[$0.empty,$0.artwork].compactMap{$0?.layer}}
    }
    private func stopInfoMotion(preserveStars:Bool = false){
        frontFloat.layer.removeAnimation(forKey:"card.game.float")
        backFloat.layer.removeAnimation(forKey:"card.info.float")
        infoMotionLayers.forEach{layer in
            for key in preserveStars ? ["card.info.joy"] : ["card.info.joy","card.info.star.intro","card.info.star.pulse","card.info.star.empty-exit"] {layer.removeAnimation(forKey:key)}
        }
    }
    /// Finite tile beat and one-shot earned-star swap. The parent clock pauses in
    /// background; hidden faces pause their exact local star clocks without replacing tracks.
    func playInfoMotion(reducedMotion:Bool = UIAccessibility.isReduceMotionEnabled){
        stopInfoMotion(preserveStars:true)
        guard !disposed,!closing else{stopInfoMotion();return}
        guard active,!animating,!pinching else{setStarMotionPaused(true);return}
        guard isBackFacing else {
            setStarMotionPaused(true)
            if !reducedMotion {JimiNativeModalV10.startIdle(on:frontFloat,key:"card.game.float",amplitude:3.0,duration:7.6,depth:false,rigid:true)}
            return
        }
        setStarMotionPaused(false)
        if reducedMotion {stopInfoMotion();playStarMotion(reducedMotion:true);return}
        JimiNativeModalV10.startIdle(on:backFloat,key:"card.info.float",amplitude:3.0,duration:7.6,depth:false,rigid:true)
        for (index,view) in stats.arrangedSubviews.enumerated(){
            guard let tile=view as? JimiWorldStatTileView else{continue}
            let profile=tile.idleProfile,duration=profile.duration,delay=Double(index)*0.28
            let times=(0...120).map{Double($0)/120}
            // One captured random recipe per tile; never randomize during playback/layout.
            // Content remains rigid: translation and a tiny lean, never live-glyph scale.
            let lift=CAKeyframeAnimation(keyPath:"transform.translation.y")
            let drift=CAKeyframeAnimation(keyPath:"transform.translation.x")
            let rock=CAKeyframeAnimation(keyPath:"transform.rotation.z")
            lift.values=times.map{profile.lift*profile.wave($0)}
            drift.values=times.map{profile.drift*profile.wave($0,offset:1.3)}
            rock.values=times.map{profile.rotation*profile.wave($0,offset:2.6)}
            for track in [lift,drift,rock] {
                track.keyTimes=times.map{NSNumber(value:$0)};track.isAdditive=true
                track.duration=duration;track.calculationMode = .linear
            }
            let float=CAAnimationGroup();float.animations=[lift,drift,rock]
            float.duration=duration;float.repeatCount=3
            float.beginTime=tile.layer.convertTime(CACurrentMediaTime(),from:nil)+delay
            tile.layer.add(float,forKey:"card.info.joy")
            // Only the leased stone artwork breathes; content keeps its exact shape.
            let stretch=CAKeyframeAnimation(keyPath:"transform.scale.x")
            let squeeze=CAKeyframeAnimation(keyPath:"transform.scale.y")
            stretch.values=times.map{profile.stoneScale*profile.wave($0,offset:0.7)};squeeze.values=times.map{-profile.stoneScale*profile.wave($0,offset:0.7)}
            for track in [stretch,squeeze] {
                track.keyTimes=lift.keyTimes;track.isAdditive=true
                track.duration=duration;track.calculationMode = .linear
            }
            let stone=CAAnimationGroup();stone.animations=[stretch,squeeze]
            stone.duration=duration;stone.repeatCount=3
            stone.beginTime=tile.idleSurfaceLayer.convertTime(CACurrentMediaTime(),from:nil)+delay
            tile.idleSurfaceLayer.add(stone,forKey:"card.info.joy")
        }
        playStarMotion(reducedMotion:reducedMotion)
    }
    /// The entry CA timeline admits staggered gray-exit/gold-enter pairs once.
    /// Later face visits retain the exact local reveal and idle phase.
    private func playStarMotion(reducedMotion:Bool,delay:Double = 0) {
        guard active,!disposed,!closing else{return}
        let opening=starMotionEpoch == nil
        let epoch=starMotionEpoch ?? (CACurrentMediaTime()+delay)
        starMotionEpoch=epoch
        let grayExit=JimiV9Motion.homeExit(.hero)
        let goldDelay=grayExit.duration
        let starStagger=grayExit.duration*0.5
        let goldDuration=0.56
        // Include the exact inflate/collapse junction alongside the dense samples.
        let exitTimes=Array(Set((0...124).map{Double($0)*grayExit.duration/124}
            + grayExit.tweens.map{$0.begin} + [grayExit.duration])).sorted()
        for (index,view) in stars.arrangedSubviews.enumerated() where index<earnedStarCount {
            guard let slot=view as? JimiWorldStarSlotView else{continue}
            let target=slot.artwork.layer,delay=Double(index)*starStagger
            let begin=target.convertTime(epoch,from:nil)+delay
            CATransaction.begin();CATransaction.setDisableActions(true)
            target.transform=CATransform3DIdentity;slot.empty?.layer.transform=CATransform3DMakeScale(0,0,1)
            CATransaction.commit()
            if opening {starPulseBeginTimes[index]=begin+goldDelay+goldDuration}
            guard !reducedMotion else{continue}
            if opening {
                let exit=CAKeyframeAnimation(keyPath:"transform")
                exit.values=exitTimes.map {time in
                    let pose=grayExit.pose(at:time)
                    return NSValue(caTransform3D:CATransform3DMakeScale(pose.scaleX,pose.scaleY,1))
                }
                exit.keyTimes=exitTimes.map{NSNumber(value:$0/grayExit.duration)}
                exit.duration=grayExit.duration;exit.beginTime=begin;exit.calculationMode = .linear
                exit.fillMode = .backwards;slot.empty?.layer.add(exit,forKey:"card.info.star.empty-exit")
                let intro=CAKeyframeAnimation(keyPath:"transform.scale")
                intro.duration=goldDuration;intro.calculationMode = .linear
                intro.values=(0...48).map {max(0,JimiV9Motion.Ease.backOut(1.8).value(Double($0)/48))}
                // Each gold starts only after its own gray has completely disappeared.
                intro.beginTime=begin+goldDelay;intro.fillMode = .backwards
                target.add(intro,forKey:"card.info.star.intro")
            }
            // Core Animation may retain an expired key alongside a newer scale track.
            // Re-entry retires that completed reveal without touching the idle phase.
            for (layer,key) in [(target,"card.info.star.intro"),(slot.empty?.layer,"card.info.star.empty-exit")] {
                guard let layer,let reveal=layer.animation(forKey:key) else{continue}
                if layer.convertTime(CACurrentMediaTime(),from:nil)>=reveal.beginTime+reveal.duration {layer.removeAnimation(forKey:key)}
            }
            guard target.animation(forKey:"card.info.star.pulse") == nil else{continue}
            let pulse=CAKeyframeAnimation(keyPath:"transform.scale")
            pulse.duration=2.5;pulse.repeatCount = .infinity;pulse.calculationMode = .linear;pulse.timingFunction=CAMediaTimingFunction(name:.linear)
            pulse.values=(0...300).map {sample -> Double in
                let wave=sin(2 * Double.pi * Double(sample)/300)
                return 1+(wave>=0 ? 0.25*0.8:0.12)*wave*abs(wave)
            }
            pulse.beginTime=starPulseBeginTimes[index] ?? begin
            target.add(pulse,forKey:"card.info.star.pulse")
        }
    }
    /// Freeze the exact slot clock through swipe/front visits; resume without replacing tracks.
    private func setStarMotionPaused(_ paused:Bool) {
        CATransaction.begin();CATransaction.setDisableActions(true)
        for slot in stars.arrangedSubviews {
            let clock=slot.layer
            if paused,clock.speed != 0 {
                let time=clock.convertTime(CACurrentMediaTime(),from:nil)
                clock.speed=0;clock.timeOffset=time
            } else if !paused,clock.speed == 0 {
                let time=clock.timeOffset
                clock.speed=1;clock.timeOffset=0;clock.beginTime=0
                clock.beginTime=clock.convertTime(CACurrentMediaTime(),from:nil)-time
            }
        }
        CATransaction.commit()
    }
    private func animateBackStats(entering:Bool,delay:Double) {
        if !entering {stopInfoMotion()}
        let views = stats.arrangedSubviews
        for (index,view) in views.enumerated() {
            let animation = CAKeyframeAnimation(keyPath:"transform.scale")
            let count = 48
            animation.values = (0...count).map { step in
                let t = Double(step)/Double(count)
                let curve = JimiV9Motion.Ease.cubicBezier(0.55,0.06,0.68,0.19)
                return entering ? JimiV9Motion.Ease.backOut(1.9).value(t) : 1-curve.value(t)
            }
            animation.duration = UIAccessibility.isReduceMotionEnabled ? 0.001 : entering ? 0.34:0.2
            animation.beginTime = view.layer.convertTime(CACurrentMediaTime(),from:nil)+delay+Double(entering ? index : views.count-1-index)*0.025
            animation.fillMode = .both;animation.isRemovedOnCompletion = false
            view.layer.add(animation,forKey:"card.stats.presentation")
        }
    }
    @objc private func pressCTA() {
        guard active,!disposed,!closing,!animating else{return}
        animateCTA(pressed:true)
    }
    @objc private func releaseCTA() {animateCTA(pressed:false)}
    /// Same sampled press/rebound recipe as Homepage; rapid re-press starts at the painted pose.
    private func animateCTA(pressed:Bool) {
        let layer = cta.layer,from = cta.layer.presentation()?.transform ?? cta.layer.transform
        let scale = pressed ? 0.84 : 1.0,y = pressed ? 4.0 : 0.0
        let ease:JimiV9Motion.Ease = pressed ? .powerOut(2) : .backOut(2.1)
        let animation = CAKeyframeAnimation(keyPath:"transform")
        animation.values = (0...30).map {step in
            let t = ease.value(Double(step)/30)
            let s = Double(from.m11)+(scale-Double(from.m11))*t
            let offset = Double(from.m42)+(y-Double(from.m42))*t
            return NSValue(caTransform3D:CATransform3DScale(CATransform3DMakeTranslation(0,offset,0),s,s,1))
        }
        animation.duration = pressed ? 0.12 : 0.26
        CATransaction.begin();CATransaction.setDisableActions(true)
        layer.removeAnimation(forKey:"card.cta.press");layer.removeAnimation(forKey:"card.cta.release")
        layer.transform = CATransform3DScale(CATransform3DMakeTranslation(0,y,0),scale,scale,1)
        layer.add(animation,forKey:pressed ? "card.cta.press" : "card.cta.release")
        CATransaction.commit()
    }

    func tapToFlip() {guard active,!disposed,!closing,!animating,!pinching else{return};interactiveFlip(direction:isBackFacing ? -1 : 1)}
    private var isBackFacing:Bool {abs(cos(angle)) > 0.001 && cos(angle) < 0}
    private func interactiveFlip(direction:Double? = nil,from incoming:Double? = nil) {
        guard active,!disposed,!closing,!animating,!pinching else{return}
        stopInfoMotion(preserveStars:true);setStarMotionPaused(true);effects?.cancel();onFeedback?("card-manual-flip");animating = true;manualFlipInFlight = true;cta.isEnabled = false
        flipGeneration += 1;let token = flipGeneration
        let sampled = incoming ?? angle
        let from = sampled+((angle-sampled)/(2 * .pi)).rounded()*2 * .pi
        let canonical = isBackFacing ? 0.0 : -Double.pi
        let candidates = [-2*Double.pi,0,2*Double.pi].map {canonical+$0}
        let directed = direction.map{d in candidates.filter{($0-from)*d > 0}} ?? candidates
        let choices = directed.isEmpty ? candidates : directed
        let to = choices.dropFirst().reduce(choices.first ?? canonical) {nearest,candidate in abs(candidate-from)<abs(nearest-from) ? candidate : nearest}
        angle = to
        (newRibbon as? JimiNativeNewRibbonView)?.setCardRotation(canonical < 0 ? backTilt:tilt)
        animateFaceTilt(canonical < 0 ? backTilt : tilt)
        let animation = CAKeyframeAnimation(keyPath:"transform.rotation.y")
        animation.values = [from,to,to+(to>=from ? 1 : -1)*12 * .pi/180,to]
        animation.keyTimes = [0.0,0.20/0.46,(0.20+0.26*0.38)/0.46,1].map {NSNumber(value:$0)}
        animation.timingFunctions = [.init(name:.linear),.init(controlPoints:0.45,0,0.55,1),.init(controlPoints:0.22,1,0.36,1)]
        animation.duration = UIAccessibility.isReduceMotionEnabled ? 0.001 : 0.46
        CATransaction.begin();CATransaction.setCompletionBlock{[weak self] in guard let self,self.flipGeneration == token,!self.disposed,!self.closing else{return};self.rotor.removeAnimation(forKey:"card.flip");self.angle = canonical;CATransaction.begin();CATransaction.setDisableActions(true);self.rotor.transform = CATransform3DMakeRotation(canonical,0,1,0);CATransaction.commit();self.animating = false;self.manualFlipInFlight = false;self.cta.isEnabled = self.stableCTAEnabled && self.isBackFacing;self.effects?.present(frontFacing:!self.isBackFacing);self.playInfoMotion();(self.newRibbon as? JimiNativeNewRibbonView)?.setForeground(self.active && !self.isBackFacing)}
        CATransaction.setDisableActions(true);rotor.transform = CATransform3DMakeRotation(to,0,1,0);rotor.add(animation,forKey:"card.flip");CATransaction.commit()
    }
    private func animateFaceTilt(_ target:CGFloat) {
        let from = carrier.layer.presentation()?.transform ?? carrier.layer.transform
        let animation = CABasicAnimation(keyPath:"transform");animation.fromValue = NSValue(caTransform3D:from)
        let final = CATransform3DMakeRotation(target,0,0,1);animation.toValue = NSValue(caTransform3D:final)
        animation.duration = UIAccessibility.isReduceMotionEnabled ? 0.001 : 0.52
        animation.timingFunction = CAMediaTimingFunction(controlPoints:0.22,1,0.36,1)
        CATransaction.begin();CATransaction.setDisableActions(true);carrier.layer.transform = final;carrier.layer.add(animation,forKey:"card.face.tilt");CATransaction.commit()
    }
    @objc private func requestClose() {guard active,!disposed,!closing else{return};closeButton.playArtworkTapFeedback();onFeedback?("back");onRequest?("close")}
    private func setDrag(_ y:CGFloat) {CATransaction.begin();CATransaction.setDisableActions(true);dragShell.layer.transform = CATransform3DMakeTranslation(0,y,0);CATransaction.commit()}
    private func settleDrag() {
        let from = dragShell.layer.presentation()?.transform ?? dragShell.layer.transform
        CATransaction.begin();CATransaction.setDisableActions(true);dragShell.layer.transform = CATransform3DIdentity
        let settle = CABasicAnimation(keyPath:"transform");settle.fromValue = NSValue(caTransform3D:from);settle.toValue = NSValue(caTransform3D:CATransform3DIdentity);settle.duration = 0.2;settle.timingFunction = CAMediaTimingFunction(controlPoints:0.22,1,0.36,1);dragShell.layer.add(settle,forKey:"card.drag.settle");CATransaction.commit()
    }
    @objc private func drag(_ pan:UIPanGestureRecognizer) {
        guard acceptsCardPan else{return}
        switch pan.state {
        case .began:
            stopInfoMotion(preserveStars:true);setStarMotionPaused(true);captureCardForPan()
            effects?.cancel();frontDrag = !isBackFacing;dragAxis = nil;dragStartAngle = angle;rotor.removeAnimation(forKey:"card.flip")
        case .changed:
            let delta = pan.translation(in:self)
            if dragAxis == nil, max(abs(delta.x),abs(delta.y)) > 7 {dragAxis = abs(delta.y)>abs(delta.x)*1.15 ? "vertical" : "horizontal"}
            if dragAxis == "vertical" {
                let available = delta.y < 0 ? max(0,base.minY) : max(0,bounds.height-base.maxY),limit = available*0.7,resisted = abs(delta.y)*0.72
                setDrag(limit > 0 ? (delta.y < 0 ? -1 : 1)*limit*resisted/(limit+resisted) : 0)
            } else if dragAxis == "horizontal" {
                let scrub = dragStartAngle+min(180,max(-180,Double(delta.x/bounds.width)*180)) * .pi/180
                CATransaction.begin();CATransaction.setDisableActions(true);rotor.transform = CATransform3DMakeRotation(scrub,0,1,0);CATransaction.commit();effects?.dragReflection(angle:scrub*180 / .pi)
            }
        case .ended,.cancelled:
            let delta = pan.translation(in:self)
            if dragAxis == "vertical",pan.state == .ended,abs(delta.y)>max(88,min(140,base.height*0.22)) {onFeedback?("back");onRequest?("close")}
            else if dragAxis == "horizontal",pan.state == .ended,abs(delta.x)>=bounds.width*0.1 {let current = (rotor.value(forKeyPath:"transform.rotation.y") as? NSNumber)?.doubleValue ?? dragStartAngle;frontDrag = false;interactiveFlip(from:current)}
            else {frontDrag = false;rotate(from:(rotor.value(forKeyPath:"transform.rotation.y") as? NSNumber)?.doubleValue ?? angle,to:angle,duration:0.18);settleDrag();effects?.present(frontFacing:!isBackFacing);playInfoMotion()}
        default:break
        }
    }
    /// Transfer the painted manual-flip pose to input before retiring its completion.
    func captureCardForPan() {
        guard acceptsCardPan,manualFlipInFlight else{return}
        let painted=rotor.presentation() ?? rotor
        let sampled=(painted.value(forKeyPath:"transform.rotation.y") as? NSNumber)?.doubleValue ?? angle
        flipGeneration += 1;manualFlipInFlight=false;animating=false
        angle=sampled+((angle-sampled)/(2 * .pi)).rounded()*2 * .pi
        CATransaction.begin();CATransaction.setDisableActions(true)
        rotor.transform=CATransform3DMakeRotation(angle,0,1,0);rotor.removeAnimation(forKey:"card.flip")
        CATransaction.commit();cta.isEnabled=stableCTAEnabled && isBackFacing
    }
    @objc private func pinched(_ pinch:UIPinchGestureRecognizer) {
        guard active,!disposed,!closing,!animating else{return}
        switch pinch.state {
        case .began:pinching = true;effects?.cancel()
        case .changed:
            let raw = max(1,pinch.scale),over = raw-1.2
            let scale = raw <= 1.2 ? raw : 1.2+(0.24*over*0.9)/(0.24+over*0.9)
            CATransaction.begin();CATransaction.setDisableActions(true);pinchShell.layer.transform = CATransform3DMakeScale(scale,scale,1);CATransaction.commit()
        case .ended,.cancelled:
            pinching = false;let from = pinchShell.layer.transform;let animation = CABasicAnimation(keyPath:"transform");animation.fromValue = NSValue(caTransform3D:from);animation.toValue = NSValue(caTransform3D:CATransform3DIdentity);animation.duration = 0.36;animation.timingFunction = CAMediaTimingFunction(controlPoints:0.22,1,0.36,1)
            CATransaction.begin();CATransaction.setDisableActions(true);pinchShell.layer.transform = CATransform3DIdentity;pinchShell.layer.add(animation,forKey:"card.pinch.return");CATransaction.commit();effects?.present(frontFacing:!isBackFacing)
        default:break
        }
    }
    func close(to destination:CGRect,gameplay:Bool = false,returnOffset:((Double)->CGPoint)? = nil,completion:@escaping () -> Void) {
        cancelGameplayPreparation()
        guard !disposed,!closing else {completion();return};closing = true;flipGeneration += 1;effects?.cancel(handoff:false)
        (newRibbon as? JimiNativeNewRibbonView)?.exit(fadeOnly:true);newRibbon = nil
        if frontDrag {onFeedback?("modal-exit")}
        onFeedback?(frontDrag ? "card-manual-flip" : "card-return-flip")
        transitionBackdrop(to:0,duration:gameplay ? 0.600/0.98 : duration)
        closeButton.isEnabled = false;cta.isEnabled = false;isUserInteractionEnabled = false;animateBackStats(entering:false,delay:max(0,duration*0.5-0.225))
        if !frontDrag {
            let painted = (rotor.presentation()?.value(forKeyPath:"transform.rotation.y") as? NSNumber)?.doubleValue ?? angle
            let paintedUnwrapped = painted+((angle-painted)/(2 * .pi)).rounded()*2 * .pi
            let paintedBack = cos(paintedUnwrapped) < 0
            let neutral = ((paintedUnwrapped+(paintedBack ? .pi : 0))/(2 * .pi)).rounded()*2 * .pi
            let target = paintedBack ? neutral : neutral-2 * .pi
            rotate(from:paintedUnwrapped,to:target,duration:duration,flight:true); angle = target
        }
        let transform = carrier.layer.presentation()?.transform ?? carrier.layer.transform
        let painted = CGRect(x:base.midX+transform.m41-base.width*hypot(transform.m11,transform.m12)/2,y:base.midY+transform.m42-base.height*hypot(transform.m21,transform.m22)/2,width:base.width*hypot(transform.m11,transform.m12),height:base.height*hypot(transform.m21,transform.m22))
        fly(from:painted,to:destination,returning:true,gameplay:gameplay,returnOffset:returnOffset) { [weak self] in self?.backdrop.alpha = 0; completion() }
    }
    private var historyVisible=false
    private var historyEntryReceipt:JimiWorldStatExitReceipt?
    private var historyEntryReady:(()->Void)?
    private var historyEntryMilestoneReached=false
    private func deliverHistoryEntry(){
        guard active,!disposed,historyVisible,historyEntryMilestoneReached else{return}
        let ready=historyEntryReady;historyEntryReady=nil;ready?()
    }
    @discardableResult func hideForStatHistory(onReady:(()->Void)?=nil)->Bool {
        guard active,!disposed,!closing,!animating,!historyVisible else{return false}
        historyVisible=true;historyEntryReady=onReady;historyEntryMilestoneReached=false
        isUserInteractionEnabled=false;cancelGameplayPreparation();effects?.setActive(false)
        CATransaction.begin();CATransaction.setCompletionBlock{[weak self] in
            guard let self,!self.disposed,self.historyVisible else{return}
            self.historyEntryMilestoneReached=true;self.deliverHistoryEntry()
            self.carrier.isHidden=true
            let time=self.carrier.layer.convertTime(CACurrentMediaTime(),from:nil)
            self.carrier.layer.speed=0;self.carrier.layer.timeOffset=time
        }
        if !UIAccessibility.isReduceMotionEnabled {
            animateStatHistoryExit()
            if onReady != nil {
                historyEntryReceipt=JimiWorldStatExitReceipt(parent:layer){[weak self] in
                    guard let self,!self.disposed,self.historyVisible else{return}
                    self.historyEntryMilestoneReached=true;self.deliverHistoryEntry();self.historyEntryReceipt=nil
                }
            }
        } else {historyEntryMilestoneReached=true;deliverHistoryEntry()}
        CATransaction.commit();return true
    }
    private func animateStatHistoryExit(){
        JimiNativeModalV10.exit(dragShell,flip:false,key:"history.exit")
        JimiNativeModalV10.exit(pinchShell,flip:true,key:"history.flip.exit")
    }
    func restoreFromStatHistory(){
        guard !disposed,historyVisible else{return};historyVisible=false
        historyEntryReady=nil;historyEntryReceipt?.cancel();historyEntryReceipt=nil
        if carrier.layer.speed==0 {
            let paused=carrier.layer.timeOffset;carrier.layer.speed=1;carrier.layer.timeOffset=0;carrier.layer.beginTime=0
            carrier.layer.beginTime=carrier.layer.convertTime(CACurrentMediaTime(),from:nil)-paused
        }
        carrier.isHidden=false;dragShell.layer.removeAnimation(forKey:"history.exit");pinchShell.layer.removeAnimation(forKey:"history.flip.exit")
        CATransaction.begin();CATransaction.setCompletionBlock{[weak self] in
            guard let self,!self.disposed,!self.historyVisible else{return};self.isUserInteractionEnabled=true;self.effects?.setActive(self.active);self.scheduleGameplayPreparation()
        }
        CATransaction.setDisableActions(true)
        dragShell.layer.transform=CATransform3DIdentity;pinchShell.layer.transform=CATransform3DIdentity
        if !UIAccessibility.isReduceMotionEnabled {JimiNativeModalV10.enter(card:dragShell,flip:pinchShell,key:"history.return")}
        CATransaction.commit()
    }
    func setActive(_ value:Bool) {front.subviews.compactMap{$0 as? JimiNativeNewRibbonView}.forEach{$0.setForeground(value && !isBackFacing && !historyVisible)};
        guard !disposed,active != value else{return};active = value;effects?.setActive(value && !historyVisible)
        if value,!historyVisible {scheduleGameplayPreparation()}else{cancelGameplayPreparation()}
        if !value {CATransaction.begin();CATransaction.setDisableActions(true);cta.layer.removeAllAnimations();cta.layer.transform = CATransform3DIdentity;CATransaction.commit()}
        guard (layer.speed == 0) == value else {return}
        if value {let paused = layer.timeOffset; layer.speed = 1;layer.timeOffset = 0;layer.beginTime = 0;layer.beginTime = layer.convertTime(CACurrentMediaTime(),from:nil)-paused}
        else {let paused = layer.convertTime(CACurrentMediaTime(),from:nil);layer.speed = 0;layer.timeOffset = paused}
        if value,historyVisible {deliverHistoryEntry()}
        if value,!animating,!historyVisible {
            let faceFloat=isBackFacing ? backFloat.layer.animation(forKey:"card.info.float") : frontFloat.layer.animation(forKey:"card.game.float")
            if starMotionEpoch == nil || faceFloat == nil {playInfoMotion()}
        }
    }
    func cleanup() {guard !disposed else{return};historyEntryReady=nil;historyEntryReceipt?.cancel();historyEntryReceipt=nil;stopInfoMotion();front.subviews.compactMap{$0 as? JimiNativeNewRibbonView}.forEach{$0.quiesce()};cancelGameplayPreparation();onPrepareGameplayAssets=nil;disposed = true;active = false;entryFlipReceipt=nil;generation += 1;flipGeneration += 1;effects?.cleanup();effects = nil;[carrier,dragShell,effectShell,pinchShell,rotorShell,frontFloat,backFloat,cta,backdrop].forEach{$0.layer.removeAllAnimations()};carrier.gestureRecognizers?.forEach{carrier.removeGestureRecognizer($0)};stats.arrangedSubviews.forEach{$0.layer.removeAllAnimations()};onRequest = nil;onFeedback = nil;isUserInteractionEnabled = false}
}


/// Canonical new-card eligibility now paints the shared alert on the physical face.
@MainActor
enum JimiNativeWorldRibbon {
    static func make(image:UIImage?,assets:JimiV9Artwork,cardSize:CGSize,scale:CGFloat,portal:Bool,compact:Bool = true)->UIImageView {
        let ribbon = JimiNativeNewRibbonView(image:opaqueAlert(assets.image("assets/nav/new.png",densityAware:true)))
        // Legendary foil is at local Z1.2. Keep the entire alert in front.
        ribbon.layer.zPosition=3;ribbon.layer.isDoubleSided=false
        ribbon.layer.opacity=0;ribbon.contentMode = .scaleAspectFit
        ribbon.accessibilityIdentifier = "native.world.ribbon";ribbon.accessibilityLabel="New card";ribbon.isUserInteractionEnabled=false
        layout(ribbon,cardSize:cardSize,scale:scale,portal:portal,compact:compact)
        return ribbon
    }
    /// Original PNG body is alpha253; normalize only its solid interior.
    /// Preserve the authored antialiased transparent silhouette and source bytes.
    static func opaqueAlert(_ source:UIImage?)->UIImage? {
        guard let source,let image=source.cgImage else{return source}
        let width=image.width,height=image.height,stride=width*4
        var pixels=[UInt8](repeating:0,count:stride*height)
        let result:CGImage?=pixels.withUnsafeMutableBytes { bytes in
            guard let context=CGContext(data:bytes.baseAddress,width:width,height:height,bitsPerComponent:8,bytesPerRow:stride,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue) else{return nil}
            context.draw(image,in:CGRect(x:0,y:0,width:width,height:height))
            let data=bytes.bindMemory(to:UInt8.self)
            for offset in Swift.stride(from:0,to:data.count,by:4) {
                let alpha=Int(data[offset+3])
                guard alpha>=250 else{continue}
                for channel in 0..<3 {data[offset+channel]=UInt8(min(255,(Int(data[offset+channel])*255+alpha/2)/alpha))}
                data[offset+3]=255
            }
            return context.makeImage()
        }
        return result.map{UIImage(cgImage:$0,scale:source.scale,orientation:source.imageOrientation)} ?? source
    }
    static func layout(_ ribbon:UIImageView,cardSize:CGSize,scale:CGFloat,portal:Bool,compact:Bool = true) {
        let side=portal ? cardSize.width*0.44*0.60:56*scale
        ribbon.bounds=CGRect(x:0,y:0,width:side,height:side)
        (ribbon as? JimiNativeNewRibbonView)?.layoutOnCard(width:cardSize.width,portal:portal)

    }
}

/// Finite face-local decoration. World/modal owns visible admission and parent
/// clocks; replacing/removing the view invalidates its completion receipt.
@MainActor
final class JimiNativeNewRibbonView:UIImageView,CAAnimationDelegate {
    let alert=NativeBackpackAlertView()
    private var foreground=true
    convenience init(){self.init(image:nil)}
    override init(image:UIImage?){
        super.init(image:nil);alert.image=image;alert.isHidden=false;alert.alpha=1;addSubview(alert)
    }
    required init?(coder:NSCoder){fatalError("Use alert image")}
    override func layoutSubviews(){super.layoutSubviews();alert.bounds=bounds;alert.center=CGPoint(x:bounds.midX,y:bounds.midY)}
    private var cardWidth:CGFloat=0,portal=false,leftEdge=false
    func layoutOnCard(width:CGFloat,portal:Bool){cardWidth=width;self.portal=portal;positionOnEdge()}
    private func positionOnEdge(){
        let side=bounds.width,right=portal ? cardWidth-side*0.5+min(20,side*0.25):cardWidth-side*0.25
        center=CGPoint(x:leftEdge ? cardWidth-right:right,y:side*0.25)
    }
    func setCardRotation(_ angle:CGFloat){leftEdge=angle>0;alert.clockwise = !leftEdge;positionOnEdge()}
    func setForeground(_ value:Bool){foreground=value;alert.setActive(value && entered && !removing && layer.animation(forKey:"ribbon.motion")==nil)}
    private var epoch=0,entered=false,removing=false
    func enter(delay:Double=0,replay:Bool=false) {
        if replay {entered=false}
        guard !entered,!removing else{return};entered=true
        play(entering:true,delay:delay,remove:false)
    }
    func exit(remove:Bool=true,delay:Double=0,fadeOnly:Bool=false){removing=remove;entered=false;play(entering:false,delay:delay,remove:remove,fadeOnly:fadeOnly)}
    private func play(entering:Bool,delay:Double,remove:Bool,fadeOnly:Bool=false) {
        alert.setActive(false)
        epoch += 1;let receipt=epoch
        let reduced=UIAccessibility.isReduceMotionEnabled,duration=reduced ? 0.12 : entering ? 0.36:0.24
        let visible=layer.presentation() ?? layer
        let startScale=entering ? 0.0:(visible.value(forKeyPath:"transform.scale") as? NSNumber)?.doubleValue ?? 1
        let startY=entering ? 0.0:Double(visible.transform.m42),startAlpha=entering ? 0.0:Double(visible.opacity)
        layer.removeAnimation(forKey:"ribbon.motion")
        let transform=CAKeyframeAnimation(keyPath:"transform"),opacity=CAKeyframeAnimation(keyPath:"opacity")
        let times=(0...60).map{Double($0)/60}
        transform.values=times.map{t -> NSValue in
            let p=reduced ? t : (entering ? JimiV9Motion.Ease.backOut(1.8):.backIn(1.5)).value(t)
            if fadeOnly {return NSValue(caTransform3D:visible.transform)}
            let scale=startScale+((entering ? 1:0.72)-startScale)*p
            var pose=CATransform3DMakeTranslation(0,startY+((entering ? 0:-8)-startY)*p,0)
            pose=CATransform3DScale(pose,scale,scale,1);return NSValue(caTransform3D:pose)
        }
        opacity.values=times.map{t in entering ? 1:startAlpha*(1-JimiV9Motion.Ease.powerOut(1).value(t))}
        for animation in [transform,opacity] {animation.keyTimes=times.map{NSNumber(value:$0)};animation.duration=duration}
        let group=CAAnimationGroup();group.animations=[transform,opacity];group.duration=duration;group.beginTime=layer.convertTime(CACurrentMediaTime(),from:nil)+delay;group.fillMode = .backwards;group.delegate=self
        group.setValue(receipt,forKey:"ribbonEpoch");group.setValue(remove,forKey:"ribbonRemove")
        CATransaction.begin();CATransaction.setDisableActions(true)
        layer.opacity=entering ? 1:0;layer.transform=CATransform3DIdentity;layer.add(group,forKey:"ribbon.motion");CATransaction.commit()
    }
    nonisolated func animationDidStop(_ animation:CAAnimation,finished:Bool) {
        MainActor.assumeIsolated {
            guard finished,(animation.value(forKey:"ribbonEpoch") as? Int)==epoch else{return}
            if animation.value(forKey:"ribbonRemove") as? Bool == true {epoch += 1;alert.setActive(false);layer.removeAllAnimations();removeFromSuperview()}
            else if entered && !removing {alert.setActive(foreground)}
        }
    }
    func deferUntilReturn(){alert.setActive(false);epoch += 1;entered=false;removing=false;layer.removeAllAnimations();layer.opacity=0}
    func quiesce() {
        alert.setActive(false)
        epoch += 1;layer.removeAllAnimations()
        CATransaction.begin();CATransaction.setDisableActions(true);layer.transform=CATransform3DIdentity;layer.opacity=entered && !removing ? 1:0;CATransaction.commit()
        if removing,superview != nil {removeFromSuperview()}
    }
    override func didMoveToWindow(){super.didMoveToWindow();if window==nil {quiesce()}}
}
