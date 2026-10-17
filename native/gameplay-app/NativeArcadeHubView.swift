import UIKit

/// Read-only Arcade destination selection. Gameplay, saves, and scores belong
/// to the selected gameplay profile; Journey's Hub owns all island/cloud idle.
@MainActor
final class NativeArcadeHubView: UIView {
    let hub: JimiV9HubView
    var onClose: (() -> Void)?
    var onPlay: ((String) -> Void)?
    private let assets: JimiV9Artwork
    private var modal: NativeArcadeWorldModal?
    private var active = false
    private var foreground = true
    private let identifiers = ["endurance", "pureDice", "slowBurn"]

    init(frame: CGRect, assets: JimiV9Artwork) {
        self.assets = assets
        hub = JimiV9HubView(frame: frame, assets: assets, arcade: true)
        super.init(frame: frame)
        accessibilityIdentifier = "native.arcade-hub"
        let paper = NativeAppPaperSurface(artwork: assets)
        paper.frame = bounds; paper.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        addSubview(paper)
        hub.frame = bounds; hub.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        addSubview(hub)
        hub.onBack = { [weak self] in self?.onClose?() }
        hub.onWorld = { [weak self] id in
            guard let self, self.active, self.foreground, self.modal == nil,
                  let index = self.hub.worldIDs.firstIndex(of: id) else { return }
            self.open(index)
        }
    }
    required init?(coder: NSCoder) { fatalError("Use init(frame:assets:)") }
    func present() {
        active = true; isHidden = false; hub.resetIdlePose()
        hub.setContentInteractionEnabled(false)
    }
    func setContentInteractionEnabled(_ enabled: Bool) { hub.setContentInteractionEnabled(enabled) }
    func resume() {
        foreground = true
        guard active else { return }
        if modal == nil { hub.startIdle() }
    }
    func suspend() { foreground = false; hub.stopIdle(); modal?.settle() }
    func hide() {
        active = false; hub.stopIdle(); modal?.dispose(); modal = nil; isHidden = true
    }
    override var isHidden: Bool { didSet { if isHidden { hub.stopIdle() } } }
    override func didMoveToWindow() { super.didMoveToWindow(); if window == nil { hub.stopIdle() } }

    private func open(_ index: Int) {
        hub.stopIdle(); hub.accessibilityElementsHidden = true
        let sheet = NativeArcadeWorldModal(frame: bounds, assets: assets, index: index)
        sheet.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        modal = sheet; addSubview(sheet)
        sheet.onFinish = { [weak self, weak sheet] play in
            guard let self, self.modal === sheet else { return }
            self.modal?.dispose(); self.modal = nil; self.hub.accessibilityElementsHidden = false
            if play && self.active && self.foreground { self.onPlay?(self.identifiers[index]) }
            else if self.active && self.foreground { self.hub.startIdle() }
        }
        sheet.reveal()
    }

    func tracks(enter: Bool) -> [(UIView, JimiV9Motion.Track)] {
        let reduced = UIAccessibility.isReduceMotionEnabled
        let order = enter ? hub.worldUnits : hub.worldUnits.shuffled()
        var result: [(UIView, JimiV9Motion.Track)] = order.enumerated().map { i, unit in
            if enter {
                return (unit, .init(tweens: [.init(begin: (reduced ? 0 : 0.08) + Double(i)*(reduced ? 0.02 : 0.09), duration: reduced ? 0.2 : 0.56,
                    from: .scale(reduced ? 0.96 : 0.65, y: reduced ? 8 : 30, opacity: 0), to: .scale(1), ease: reduced ? .powerOut(1) : .backOut(1.8))]))
            }
            if reduced {
                return (unit, .init(tweens: [.init(begin: Double(i)*0.012, duration: 0.16, from: .scale(1), to: .scale(0.96,y:8,opacity:0), ease: .powerIn(1))]))
            }
            let peak = JimiV9Motion.Pose(scaleX:1.144,scaleY:1.12), delay = Double(i)*0.045
            return (unit,.init(tweens:[.init(begin:delay,duration:0.18,from:.scale(1),to:peak,ease:.powerIn(2)),
                .init(begin:delay+0.18,duration:0.336,from:peak,to:.scale(0),ease:.backIn(1.7))],anchorY:0.54))
        }
        result.append((hub.header, enter ? .init(tweens:[.init(begin:0,duration:reduced ? 0.2 : 0.56,from:.scale(reduced ? 0.96 : 0.65,y:reduced ? 8 : 30,opacity:0),to:.scale(1),ease:reduced ? .powerOut(1) : .backOut(1.8))]) : JimiV9Motion.journeyNavigationExit(reducedMotion:reduced)))
        return result
    }
}

/// Finite presentation only. Covered Hub is stopped until this exact sheet is
/// dismissed. Background settles the finite reveal; cleanup rejects callbacks.
@MainActor
private final class NativeArcadeWorldModal: UIView {
    var onFinish: ((Bool) -> Void)?
    private let backdrop = JimiV9PlainButton(type:.custom), card = UIView(), flip = JimiNativeModalTransformView(), paper = UIImageView()
    private let heading = UILabel(), subtitle = UILabel(), art = UIImageView(), close = JimiV9PlainButton(type:.custom)
    private let play = JimiV9PlainButton(type:.custom), assets: JimiV9Artwork
    private var closing = false, disposed = false
    private var ready = false {
        didSet { play.isEnabled = ready && !closing; accessibilityValue = ready ? "ready" : "entering" }
    }
    init(frame: CGRect, assets: JimiV9Artwork, index: Int) {
        self.assets = assets
        super.init(frame:frame)
        accessibilityViewIsModal = true; accessibilityIdentifier = "native.arcade-world-modal"
        backdrop.backgroundColor = JimiNativeModalV10.backdropColor
        backdrop.addTarget(self,action:#selector(dismissSheet),for:.touchUpInside); addSubview(backdrop)
        addSubview(card); card.addSubview(flip); flip.addSubview(paper)
        var camera = CATransform3DIdentity; camera.m34 = -1/920; layer.sublayerTransform = camera
        flip.layer.anchorPoint = CGPoint(x:0.5,y:1)
        paper.image = assets.image("assets/modals/paper.png"); paper.contentMode = .scaleToFill
        paper.layer.cornerRadius = 32; paper.clipsToBounds = true
        card.layer.shadowColor = UIColor(red:0.60,green:0.43,blue:0.32,alpha:1).cgColor
        card.layer.shadowOpacity = 0.3; card.layer.shadowRadius = 18; card.layer.shadowOffset = CGSize(width:0,height:12)
        heading.text = ["Endurance","Pure Dice","Slow Burn"][index]
        heading.font = assets.font(size:29,weight:"ExtraBold"); heading.textAlignment = .center
        heading.textColor = UIColor(red:173/255,green:135/255,blue:117/255,alpha:1)
        subtitle.numberOfLines = 0; subtitle.textAlignment = .center
        subtitle.attributedText = NativeModalTypography.attributedSubtitle([
            "Clear each board and keep going until you run out of moves. Unlock more special dice in Journey!",
            "Just you and the dice. No specials, with a gentler start before the challenge grows.",
            "Specials arrive half as often. Clear boards, build your meter, and make every special count."
        ][index],font:assets.font(size:19,weight:"Medium"))
        art.image = assets.image(["assets/arcade/endourance.png","assets/arcade/pure dice.png","assets/arcade/slow burn.png"][index],densityAware:true)
        art.contentMode = .scaleAspectFit
        play.setTitle("Play",for:.normal); play.applyModalCTA(artwork:assets)
        play.addTarget(self,action:#selector(playGame),for:.touchUpInside)
        play.accessibilityIdentifier = "native.arcade-world-modal.play"; play.isEnabled = false
        close.setImage(assets.image("assets/close-icon.png"),for:.normal)
        close.imageView?.contentMode = .scaleAspectFit; close.imageEdgeInsets = UIEdgeInsets(top:12,left:12,bottom:12,right:12)
        close.accessibilityLabel = "Close"; close.enableArtworkTapFeedback()
        close.addTarget(self,action:#selector(dismissSheet),for:.touchUpInside)
        [heading,subtitle,art,play,close].forEach { flip.addSubview($0) }
    }
    required init?(coder:NSCoder) { fatalError("Use Arcade initializer") }
    override func layoutSubviews() {
        super.layoutSubviews(); backdrop.frame = bounds
        let w = min(390,bounds.width-40), h = min(650,bounds.height-safeAreaInsets.top-safeAreaInsets.bottom-40)
        card.bounds = CGRect(x:0,y:0,width:w,height:h); card.center = CGPoint(x:bounds.midX,y:bounds.midY)
        flip.bounds = card.bounds; flip.center = CGPoint(x:w/2,y:h)
        JimiNativeModalV10.paperLayout(paper,bounds:card.bounds)
        heading.frame = CGRect(x:28,y:28,width:w-56,height:38)
        subtitle.frame = CGRect(x:28,y:78,width:w-56,height:96)
        play.frame = CGRect(x:32,y:h-100,width:w-64,height:66)
        art.frame = CGRect(x:15,y:180,width:w-30,height:max(70,play.frame.minY-194))
        close.frame = CGRect(x:w-43,y:-10,width:48,height:48)
    }
    func reveal() {
        layoutIfNeeded(); card.alpha = 1; backdrop.alpha = 0
        if UIAccessibility.isReduceMotionEnabled { ready = true; backdrop.alpha = 1; return }
        CATransaction.begin()
        CATransaction.setCompletionBlock { [weak self] in guard let self,!self.disposed,!self.closing else { return }; self.ready = true }
        JimiNativeModalV10.enter(card:card,flip:flip,key:"arcade.modal.enter")
        CATransaction.commit()
        UIView.animate(withDuration:0.5) { self.backdrop.alpha = 1 }
    }
    func settle() {
        guard !closing else { return }
        card.layer.removeAllAnimations(); flip.layer.removeAllAnimations(); backdrop.layer.removeAllAnimations()
        card.alpha = 1; backdrop.alpha = 1; card.layer.transform = CATransform3DIdentity; flip.layer.transform = CATransform3DIdentity; ready = true
    }
    func dispose() {
        guard !disposed else { return }; disposed = true; onFinish = nil
        for target in [self,card,flip,backdrop,close,play] { target.layer.removeAllAnimations() }
        removeFromSuperview()
    }
    private func finish(_ play: Bool) {
        guard ready,!closing,!disposed else { return }; closing = true; isUserInteractionEnabled = false
        close.playArtworkTapFeedback()
        if UIAccessibility.isReduceMotionEnabled { onFinish?(play); return }
        CATransaction.begin()
        CATransaction.setCompletionBlock { [weak self] in guard let self,!self.disposed else { return }; self.onFinish?(play) }
        JimiNativeModalV10.exit(card,flip:false,key:"arcade.modal.exit")
        JimiNativeModalV10.exit(flip,flip:true,key:"arcade.modal.exit")
        let fade = CAKeyframeAnimation(keyPath:"opacity"); fade.values = [1,1,0]; fade.keyTimes = [0,0.18,1]; fade.duration = 0.65
        card.layer.opacity = 0; card.layer.add(fade,forKey:"arcade.modal.fade")
        CATransaction.commit()
        UIView.animate(withDuration:0.2) { self.backdrop.alpha = 0 }
    }
    @objc private func dismissSheet() { finish(false) }
    @objc private func playGame() { finish(true) }
}
