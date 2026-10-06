import UIKit

/// Authored feedback owns pressed visuals, never UIKit's dark highlight.
@MainActor
final class JimiV9PlainButton: UIButton {
    override var isHighlighted: Bool {
        get { false }
        set { /* Keep normal artwork/title colors while tracking touches. */ }
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

/// Settled v9 Homepage presentation. No route, persistence, audio, idle timer or
/// animator lives here: the controller owns every transition and input lease.
@MainActor
final class JimiV9HomeView: UIView, UIGestureRecognizerDelegate {
    var onSlideSelected: ((Int) -> Void)?
    var onActivate: ((Int) -> Void)?
    var onNavigation: ((String) -> Void)?
    var onPanBegan: (() -> Bool)?
    var onPanEnded: ((Int, Bool) -> Void)?
    private(set) var selectedSlide = 0

    let navView = UIView()
    let sliderTrack = UIView()
    let logoView = UIView()
    private let viewport = UIView()
    private let logoImage: UIImageView
    private let shards: [UIImageView]
    private let shardShells = (0..<4).map { _ in UIView() }
    private let bottomShadow: UIImageView
    private var panels: [UIView] = []
    private var heroes: [UIButton] = []
    private var heroImages: [UIImageView] = []
    private var ctas: [UIButton] = []
    private var ctaContainers: [UIView] = []
    private var ctaPressShells: [UIView] = []
    private var ctaPressGeneration = [0, 0, 0]
    private var ctaActivationPending = false
    private var navButtons: [UIButton] = []
    private var navImages: [UIImageView] = []
    private var navShadows: [UIView] = []
    private let titles = ["Journey", "Arcade", "Settings"]
    private var panGesture: UIPanGestureRecognizer!
    private var dragging = false
    private var draggedPositionX: CGFloat?
    private var dragStartPositionX: CGFloat = 0

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
        logoView.addSubview(logoImage)
        logoView.isUserInteractionEnabled = false
        bottomShadow.contentMode = .scaleAspectFit
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
            hero.addSubview(art)
            panel.addSubview(hero)
            heroes.append(hero)
            heroImages.append(art)

            let cta = JimiV9PlainButton(type: .custom)
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
            pressShell.addSubview(cta)
            ctaContainer.addSubview(pressShell)
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
            shadow.backgroundColor = UIColor(red: 238/255, green: 218/255, blue: 202/255, alpha: 0.8)
            shadow.layer.cornerRadius = 7.5
            shadow.isUserInteractionEnabled = false
            let image = UIImageView(image: assets.image("assets/nav/\(icons[index]).png"))
            image.contentMode = .scaleAspectFit
            nav.addSubview(shadow)
            nav.addSubview(image)
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
        logoImage.bounds = CGRect(x: 0, y: 0, width: 208, height: 127)
        logoImage.center = CGPoint(x: 104, y: 55.5)
        let shardCenters = [
            CGPoint(x: -208*0.12 + 29.5, y: -127*0.16 + 29.5),
            CGPoint(x: 208 + 208*0.08 - 29.5, y: -127*0.16 + 29.5),
            CGPoint(x: -208*0.032 + 29.5, y: 127 - 127*0.023 - 29.5),
            CGPoint(x: 208 + 208*0.018 - 29.5, y: 127 + 127*0.019 - 29.5),
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
        let heroTop = topInset + innerInset + 153
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
            heroImages[i].frame = heroes[i].bounds
            ctaContainers[i].bounds = CGRect(x: 0, y: 0, width: width, height: 104)
            ctaContainers[i].center = CGPoint(x: width/2, y: heroTop + 360)
            ctas[i].bounds = CGRect(x: 0, y: 0, width: 226, height: 64)
            ctaPressShells[i].bounds = ctas[i].bounds
            ctaPressShells[i].center = CGPoint(x: width/2, y: 72 + height*0.0225)
            ctas[i].center = CGPoint(x: 113, y: 32)
            ctas[i].layer.shadowPath = UIBezierPath(roundedRect: ctas[i].bounds, cornerRadius: 32).cgPath
        }
        bottomShadow.bounds = CGRect(x: 0, y: 0, width: width, height: 49)
        bottomShadow.center = CGPoint(x: width/2, y: height - 81 - 24.5)
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
            navImages[i].frame = CGRect(x: 0, y: i == selectedSlide ? -12 : 0, width: size, height: size)
            navShadows[i].frame = CGRect(x: (size-60)/2, y: size-19, width: 60, height: 15)
            navShadows[i].isHidden = i != selectedSlide
            x += size + gap
        }
    }

    @objc private func activate(_ button: UIButton) {
        guard !dragging, !ctaActivationPending, button.tag == selectedSlide else { return }
        guard button === ctas[selectedSlide] else { onActivate?(selectedSlide); return }
        ctaActivationPending = true
        animateCTA(button.tag, pressed: false) { [weak self] in
            guard let self, !self.dragging, !self.isHidden, self.isUserInteractionEnabled else { return }
            self.ctaActivationPending = false
            self.onActivate?(self.selectedSlide)
        }
    }

    @objc private func pressCTA(_ button: UIButton) {
        guard !dragging, !ctaActivationPending else { return }
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
    func cancelPan() {
        resetCTAFeedback()
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
                selectedSlide: selectedSlide, distance: Double(translation),
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
