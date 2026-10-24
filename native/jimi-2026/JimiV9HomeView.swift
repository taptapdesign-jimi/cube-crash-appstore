import UIKit

/// Authored feedback owns pressed visuals, never UIKit's dark highlight.
@MainActor
final class JimiV9PlainButton: UIButton {
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
    override var isHidden:Bool {didSet{cartoonSurface?.isHidden=isHidden;if isHidden{cartoonSurface?.layer.removeAnimation(forKey:NativeHubBackpackFeedback.animationKey)}}}
    override func didMoveToWindow(){super.didMoveToWindow();if window==nil{cartoonSurface?.layer.removeAnimation(forKey:NativeHubBackpackFeedback.animationKey)};ctaShimmer?.rebindVisibility()}
    private var ctaShimmer:NativeCTAShimmer?
    func setPrimaryCTAShimmer(_ enabled:Bool) {
        if enabled {
            if ctaShimmer == nil {ctaShimmer=NativeCTAShimmer(button:self)}
            ctaShimmer?.refresh()
        }else{ctaShimmer?.dispose();ctaShimmer=nil}
    }
    override var isEnabled:Bool {didSet{ctaShimmer?.refresh()}}
    private var ctaSoftShadow: CALayer?
    private let ctaShadowCaster = CALayer()
    private let ctaShadowMask = CAShapeLayer()
    func removeModalCTAPaint() {
        setPrimaryCTAShimmer(false)
        ctaSoftShadow?.removeFromSuperlayer();ctaSoftShadow = nil
        backgroundColor = .clear;layer.shadowOpacity = 0;layer.borderWidth = 0
    }
    func applyModalCTA(artwork: JimiV9Artwork,primary: Bool = true) {
        setPrimaryCTAShimmer(primary)
        let edge = primary ? UIColor(red:194/255,green:73/255,blue:33/255,alpha:1) : UIColor(red:216/255,green:199/255,blue:187/255,alpha:1)
        backgroundColor = primary ? UIColor(red:233/255,green:122/255,blue:85/255,alpha:1) : .white
        setTitleColor(primary ? UIColor(red:1,green:251/255,blue:242/255,alpha:1) : UIColor(red:173/255,green:134/255,blue:117/255,alpha:1),for:.normal)
        titleLabel?.font = artwork.font(size:28,weight:"Bold")
        titleLabel?.shadowColor = primary ? edge : nil
        titleLabel?.shadowOffset = CGSize(width:0,height:primary ? 2:0)
        layer.cornerRadius = 32;layer.shadowColor = edge.cgColor
        layer.shadowOffset = CGSize(width:0,height:8);layer.shadowOpacity = 1;layer.shadowRadius = 0
        layer.borderWidth = primary ? 0:1
        layer.borderColor = UIColor(red:234/255,green:222/255,blue:215/255,alpha:1).cgColor
        clipsToBounds = false
        let soft = ctaSoftShadow ?? CALayer()
        if ctaSoftShadow == nil {layer.insertSublayer(soft,at:0);soft.addSublayer(ctaShadowCaster);ctaSoftShadow = soft}
        ctaShadowCaster.backgroundColor = backgroundColor?.cgColor
        ctaShadowCaster.cornerRadius = 32
        ctaShadowCaster.shadowColor = (primary ? UIColor(red:112/255,green:55/255,blue:34/255,alpha:1) : UIColor(red:112/255,green:85/255,blue:73/255,alpha:1)).cgColor
        ctaShadowCaster.shadowOpacity = primary ? 0.16:0.12;ctaShadowCaster.shadowOffset = CGSize(width:0,height:13);ctaShadowCaster.shadowRadius = 11
        ctaShadowMask.fillRule = .evenOdd;soft.mask = ctaShadowMask
        setNeedsLayout()
    }
    override func layoutSubviews() {
        super.layoutSubviews()
        if let artworkOpacity {imageView?.alpha=artworkOpacity}
        ctaShimmer?.layout()
        guard let soft = ctaSoftShadow else{return}
        CATransaction.begin();CATransaction.setDisableActions(true)
        let radius = min(40,bounds.height/2)
        layer.cornerRadius = radius
        let body = UIBezierPath(roundedRect:bounds,cornerRadius:radius)
        layer.shadowPath = body.cgPath;soft.frame = bounds.insetBy(dx:-44,dy:-44)
        ctaShadowCaster.frame = bounds.offsetBy(dx:44,dy:44);ctaShadowCaster.shadowPath = body.cgPath;ctaShadowCaster.cornerRadius = radius
        // Keep the soft shadow outside the painted button body, like CSS box-shadow.
        ctaShadowMask.frame = soft.bounds
        let mask = UIBezierPath(rect:ctaShadowMask.bounds)
        mask.append(UIBezierPath(roundedRect:bounds.offsetBy(dx:44,dy:44),cornerRadius:radius))
        ctaShadowMask.path = mask.cgPath
        CATransaction.commit()
    }
    override var isHighlighted: Bool {
        get { false }
        set { /* Keep normal artwork/title colors while tracking touches. */ }
    }
}

/// TAP TAP DESIGN specular profile with the shared CTA cadence, composed by Core Animation only. One finite
/// ten-second projection per visible primary button; completion renews only while
/// eligible. No display link, timer, decoder, game clock or persistence ownership.
@MainActor
final class NativeCTAShimmer:NSObject,CAAnimationDelegate {
    static let animationKey="native.cta.shimmer"
    private weak var button:JimiV9PlainButton?
    let highlight=CAGradientLayer(),band=CAGradientLayer()
    private let edge=CAGradientLayer(),edgeMask=CAShapeLayer()
    private var observations:[NSKeyValueObservation]=[]
    private var disposed=false,foreground=true
    private(set) var running=false
    init(button:JimiV9PlainButton) {
        self.button=button
        super.init()
        highlight.name="native.cta.shimmer";highlight.opacity=0;highlight.masksToBounds=true;highlight.zPosition=1
        highlight.colors=Array(repeating:UIColor(red:1,green:225/255,blue:189/255,alpha:0.55).cgColor,count:2)
        highlight.startPoint=CGPoint(x:0.5,y:0);highlight.endPoint=CGPoint(x:0.5,y:1)
        // Same soft shoulders and narrow specular core as TAP TAP DESIGN.
        band.colors=[0.0,0.06,0.35,1,0.35,0.06,0].map{UIColor(white:1,alpha:$0).cgColor}
        band.locations=[0,0.18,0.38,0.5,0.62,0.82,1];highlight.mask=band
        button.layer.addSublayer(highlight)
        edge.name="native.cta.edge-shine";edge.zPosition=2
        edge.colors=[UIColor(red:1,green:228/255,blue:168/255,alpha:0.96).cgColor,
                     UIColor(red:1,green:201/255,blue:120/255,alpha:0.72).cgColor,
                     UIColor(red:233/255,green:139/255,blue:66/255,alpha:0.45).cgColor,
                     UIColor(red:185/255,green:67/255,blue:32/255,alpha:0.68).cgColor]
        edge.locations=[0,0.35,0.65,1];edge.startPoint=CGPoint(x:0.08,y:0);edge.endPoint=CGPoint(x:0.9,y:1)
        edgeMask.fillColor=UIColor.clear.cgColor;edgeMask.strokeColor=UIColor.white.cgColor;edgeMask.lineWidth=3.2
        edge.mask=edgeMask;button.layer.addSublayer(edge)
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
        highlight.frame=button.bounds;highlight.cornerRadius=min(40,button.bounds.height/2)
        edge.frame=button.bounds;edgeMask.frame=edge.bounds
        let rim=button.bounds.insetBy(dx:3,dy:3)
        edgeMask.path = rim.width>0 && rim.height>0 ? UIBezierPath(roundedRect:rim,cornerRadius:max(0,highlight.cornerRadius-3)).cgPath:nil
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
        NotificationCenter.default.removeObserver(self);highlight.removeFromSuperlayer();edge.removeFromSuperlayer();button=nil
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
    private var ctas: [UIButton] = []
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
    private let navIdleDirections=(0..<3).map{_ in CGPoint(x:CGFloat.random(in:-1.5...1.5),y:CGFloat.random(in:-2...2))}
    private let navIdleTilts=(0..<3).map{_ in CGFloat.random(in:-1.4...1.4)}
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
            cta.setPrimaryCTAShimmer(true)
            cta.tag = index
            cta.setTitle(titles[index], for: .normal)
            cta.titleLabel?.font = assets.font(size: 28)
            cta.setTitleColor(UIColor(red: 1, green: 251/255, blue: 242/255, alpha: 1), for: .normal)
            cta.titleLabel?.shadowColor = UIColor(red: 194/255, green: 73/255, blue: 33/255, alpha: 1)
            cta.titleLabel?.shadowOffset = CGSize(width: 0, height: 2)
            cta.backgroundColor = UIColor(red: 233/255, green: 122/255, blue: 85/255, alpha: 1)
            cta.layer.cornerRadius = 32
            cta.layer.shadowColor = UIColor(red: 194/255, green: 73/255, blue: 33/255, alpha: 1).cgColor
            cta.layer.shadowOffset = CGSize(width: 0, height: 8)
            cta.layer.shadowOpacity = 1
            cta.layer.shadowRadius = 0
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
            ctas[i].bounds = CGRect(x: 0, y: 0, width: 226, height: 64)
            ctaPressShells[i].bounds = ctas[i].bounds
            ctaIdleShells[i].bounds=ctas[i].bounds
            ctaIdleShells[i].center=CGPoint(x:width/2,y:72+height*0.0225)
            ctaPressShells[i].center = CGPoint(x:113,y:32)
            ctaCartoonShells[i].bounds=ctas[i].bounds;ctaCartoonShells[i].center=CGPoint(x:113,y:32)
            ctas[i].center = CGPoint(x: 113, y: 32)
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
                peak=CATransform3DScale(peak,0.985,0.985,1)
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
