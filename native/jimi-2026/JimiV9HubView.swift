import UIKit

private final class JimiV9HubScrollView: UIScrollView {
    override func touchesShouldCancel(in view: UIView) -> Bool {
        // A pan beginning on a World must scroll, never activate on release.
        view is UIControl || super.touchesShouldCancel(in: view)
    }
}

/// Original v9 Hub composition. Data comes from the canonical web progression
/// owner; this view never reads or writes saves. Parent owns motion and routes.
@MainActor
final class JimiV9HubView: UIView, UIScrollViewDelegate {
    let scrollView: UIScrollView = JimiV9HubScrollView()
    let header = JimiV9NavigationHeader(frame:.zero)
    private let navigationTarget = UIButton(type:.custom)
    private let crateNavigationTarget = UIButton(type:.custom)
    let backButton = JimiV9PlainButton(type: .custom)
    let backpackAlert=NativeBackpackAlertView()
    func setBackpackUnread(_ unread:Bool){backpackAlert.setUnreadVisible(unread && !arcade);backpackAlert.setActive(unread && !arcade && idleRequested && !isHidden)}
    let backpackButton = JimiV9PlainButton(type: .custom)
    private let content = UIView()
    private let arcade: Bool
    private let title = UILabel()
    private(set) var worldUnits: [UIButton] = []
    private var counts: [Int: UILabel] = [:]
    private var cloudViews: [(UIImageView, CGRect)] = []
    private var floats: [Int: UIView] = [:]
    private var tilts: [Int: UIView] = [:]
    private var banners: [Int: UIView] = [:]
    private var bannerRevealShells: [Int: UIView] = [:]
    private var artworkViews: [Int: UIImageView] = [:]
    private var cartoonShells:[Int:UIView]=[:]
    private var flagViews: [Int: UIImageView] = [:]
    private var visualBounds: [Int: CGRect] = [:]
    private var admittedWorlds = Set<Int>()
    private var idleRequested = false
    private let idleKey = "jimi.v9.hub.idle"
    private struct IdleClock {
        let startedAt: CFTimeInterval
        let offset: CFTimeInterval
        let duration: CFTimeInterval
    }
    // Fixed layers only (22 loops for the complete three-World Hub). A pause
    // stores phase without a clock/timer; background time is not consumed.
    private var idleClocks: [ObjectIdentifier: [String: IdleClock]] = [:]
    private var pausedIdleOffsets: [ObjectIdentifier: [String: CFTimeInterval]] = [:]
    let worldIDs = [1, 3, 2]
    var onBack: (() -> Void)?
    var onWorld: ((Int) -> Void)?
    var onBackpack: (() -> Void)?
    var onInputDiagnostic:((String)->Void)?
    var bannerRevealTargets: [(worldID: Int, view: UIView)] {
        worldIDs.compactMap { id in bannerRevealShells[id].map { (id, $0) } }
    }
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard !isHidden, isUserInteractionEnabled, alpha > 0.01 else { return nil }
        // Header CA motion changes its model geometry; the navigation target stays
        // at its authored position while content remains gated independently.
        let target:UIView?
        if navigationTarget.frame.contains(point), backButton.isEnabled {target=navigationTarget}
        else if arcade,crateNavigationTarget.frame.contains(point),backpackButton.isEnabled {target=crateNavigationTarget}
        else {target=super.hitTest(point,with:event)}
        if let onInputDiagnostic {
            onInputDiagnostic("hit x=\(Int(point.x)) y=\(Int(point.y)) target=\(target.map{String(describing:type(of:$0))} ?? "nil") tag=\(target?.tag ?? -1)")
        }
        return target
    }

    func bannerWidth(for worldID: Int) -> CGFloat { banners[worldID]?.bounds.width ?? 0 }

    init(frame: CGRect, assets: JimiV9Artwork, arcade: Bool = false) {
        self.arcade = arcade
        super.init(frame: frame)
        navigationTarget.isAccessibilityElement = false
        navigationTarget.addTarget(self,action:#selector(back),for:.touchUpInside)
        addSubview(navigationTarget)
        crateNavigationTarget.isAccessibilityElement = false
        crateNavigationTarget.isHidden = !arcade
        crateNavigationTarget.addTarget(self,action:#selector(backpack),for:.touchUpInside)
        addSubview(crateNavigationTarget)
        accessibilityIdentifier = "native.hub"
        scrollView.contentInsetAdjustmentBehavior = .never
        scrollView.alwaysBounceVertical = true
        scrollView.showsVerticalScrollIndicator = false
        scrollView.delaysContentTouches = true
        scrollView.canCancelContentTouches = true
        scrollView.delegate = self
        addSubview(scrollView); scrollView.addSubview(content)
        let paths = arcade ? ["assets/arcade/endourance.png", "assets/arcade/pure dice.png", "assets/arcade/slow burn.png"] : ["assets/journey assets/forest/forest world/1Forest main.png",
                     "assets/journey assets/robo/robo world/robo-main.png",
                     "assets/journey assets/beach/Beacj world/beach-main.png"]
        let names = arcade ? ["Endurance", "One Lucky Drop", "Slow Burn"] : ["Forest", "Area 55", "Beach"]
        let cloudPaths = ["oblak-forest1", "oblak-forest2", "oblak+srednji", "oblak mali ljevo", "oblak mali desno", "oblak veliki ljevo dole"]
        let clouds: [(Int, CGFloat, CGFloat, CGFloat, CGFloat)] = [
            (5,-70,-6,272,0.78),(1,-92,58,188,0.74),(5,100,6,248,0.76),(2,200,138,166,0.72),
            (2,-34,76,286,0.8),(0,214,58,184,0.72),(5,24,222,214,0.78),(2,168,240,198,0.76),
            (3,-22,400,176,0.68),(2,136,418,236,0.78),(0,32,576,214,0.72),(5,198,598,184,0.68),(2,-10,632,198,0.62)]
        for (index,x,y,width,alpha) in clouds {
            let image = assets.image("assets/board transition/\(cloudPaths[index]).png")
            let cloud = UIImageView(image: image)
            cloud.contentMode = .scaleAspectFit; cloud.alpha = alpha
            let ratio = (image?.size.height ?? 1) / (image?.size.width ?? 1)
            let rect = CGRect(x: x + (arcade ? CGFloat.random(in: -12...12) : 0), y: y, width: width, height: width*ratio)
            cloudViews.append((cloud, rect)); content.addSubview(cloud)
        }
        for index in 0..<3 {
            let id = worldIDs[index]
            let button = JimiV9PlainButton(type: .custom)
            button.tag = id; button.accessibilityLabel = names[index] + " world"
            button.accessibilityIdentifier = "native.hub.world.\(id)"
            button.addTarget(self, action: #selector(openWorld(_:)), for: .touchUpInside)
            // One complete Unit owns route motion, including its clouds.
            for (cloud, rect) in cloudViews where cloudWorldID(rect.minY) == id {
                button.addSubview(cloud)
            }
            let floating = UIView(), tilt = UIView()
            floating.isUserInteractionEnabled = false
            floating.addSubview(tilt); button.addSubview(floating)
            floats[id] = floating; tilts[id] = tilt
            tilt.layer.shadowColor = UIColor(red: 185/255, green: 149/255, blue: 114/255, alpha: 1).cgColor
            tilt.layer.shadowOpacity = 0.12
            tilt.layer.shadowOffset = CGSize(width: 0, height: 4)
            tilt.layer.shadowRadius = 4
            let flag = UIImageView(image: assets.image("assets/journey assets/natpis.png", densityAware: true))
            let banner = UIView(frame: CGRect(x: id == 3 ? -88 : 203, y: id == 1 ? 81 : id == 2 ? 75 : 69, width: 150, height: 70))
            flag.frame = banner.bounds; flag.contentMode = .scaleAspectFit
            if id == 3 { flag.transform = CGAffineTransform(scaleX: -1, y: 1) }
            banner.addSubview(flag)
            let count = UILabel(frame: banner.bounds.insetBy(dx: 12, dy: 8))
            count.font = assets.font(size: 18, weight: "ExtraBold")
            count.textColor = UIColor(red: 232/255, green: 115/255, blue: 74/255, alpha: 1)
            count.textAlignment = .center; count.text = "0 / 10"
            counts[id] = count; banner.addSubview(count)
            banner.transform = CGAffineTransform(rotationAngle: bannerAngle(id) * .pi / 180)
            let revealShell = UIView()
            revealShell.isUserInteractionEnabled = false
            revealShell.addSubview(banner); tilt.addSubview(revealShell)
            bannerRevealShells[id] = revealShell
            banner.isUserInteractionEnabled = false
            banners[id] = banner; flagViews[id] = flag
            revealShell.isHidden = arcade
            let artwork = UIImageView(image: assets.image(paths[index], densityAware: arcade || id == 1))
            artwork.frame = CGRect(x: 0, y: 0, width: 273, height: 190)
            artwork.contentMode = .scaleAspectFit
            artwork.accessibilityIdentifier = arcade ? "native.arcade-hub.art.\(id)" : "native.hub.art.\(id)"
            let cartoon=UIView();cartoon.isUserInteractionEnabled=false
            tilt.addSubview(cartoon);cartoon.addSubview(artwork);cartoonShells[id]=cartoon
            artworkViews[id] = artwork
            content.addSubview(button); worldUnits.append(button)
        }
        header.backgroundColor = UIColor(red: 243/255, green: 238/255, blue: 232/255, alpha: 0.8)
        addSubview(header)
        backButton.setImage(assets.image("assets/chevron-back.png"), for: .normal)
        backButton.imageView?.contentMode = .scaleAspectFit
        backButton.imageEdgeInsets = UIEdgeInsets(top: 10, left: 10, bottom: 10, right: 10)
        backButton.accessibilityLabel = "Back to slider"; backButton.accessibilityIdentifier = "native.hub.back"
        backButton.addTarget(self, action: #selector(back), for: .touchUpInside)
        backpackButton.setImage(assets.image(arcade ? "assets/hud/crate - hud.png" : "assets/nav/stats-nav.png", densityAware: true), for: .normal)
        backpackButton.imageView?.contentMode = .scaleAspectFit
        backpackButton.imageEdgeInsets = arcade ? UIEdgeInsets(top:4.8,left:0.8,bottom:4.8,right:0.8) : UIEdgeInsets(top:4,left:0,bottom:4,right:0)
        backpackButton.accessibilityLabel = arcade ? "Box" : "Backpack"; backpackButton.accessibilityIdentifier = arcade ? "native.arcade-hub.crate" : "native.hub.backpack"
        backpackButton.addTarget(self, action: #selector(backpack), for: .touchUpInside)
        backpackButton.isHidden = false
        backpackAlert.image=assets.image("assets/nav/alsert@2x.png") ?? assets.image("assets/nav/alert.png")
        backpackButton.addSubview(backpackAlert)
        title.text = arcade ? "Arcade" : "Journey"; title.font = assets.font(size: 28, weight: "ExtraBold")
        title.textColor = UIColor(red: 173/255, green: 135/255, blue: 117/255, alpha: 1)
        title.textAlignment = .center
        [backButton, title, backpackButton].forEach { header.addSubview($0) }
    }
    required init?(coder: NSCoder) { fatalError("Use init(frame:assets:)") }

    func updateProgress(_ worlds: [[String: Any]], activeWorldId: Int? = nil) {
        for world in worlds {
            guard let id = world["worldId"] as? Int, let completed = world["completed"] as? Int,
                  let total = world["total"] as? Int, total >= 0, (0...total).contains(completed) else { continue }
            // Bridge's completed is canonical unlocked && !interim, exactly
            // the original banner count (not an independent progression model).
            counts[id]?.attributedText = NSAttributedString(string: "\(completed) / \(total)", attributes: [.kern: -0.76])
            let locked = activeWorldId.map { id > $0 && completed == 0 } ?? false
            let interim = world["hasInterimCard"] as? Bool ?? false
            worldUnits.first { $0.tag == id }?.accessibilityValue = "\(completed) of \(total)"
                + (locked ? ", locked" : "") + (interim ? ", current stage" : "")
            // v9 locked World/cloud styles retain full colour and tap routing.
        }
    }
    func resetScroll() { scrollView.setContentOffset(.zero, animated: false) }
    func setContentInteractionEnabled(_ enabled: Bool) { scrollView.isUserInteractionEnabled = enabled }
    override func layoutSubviews() {
        super.layoutSubviews()
        let width = bounds.width, top = safeAreaInsets.top
        scrollView.frame = bounds
        let hubHeight = top + 747 + 128 - min(bounds.height*0.08, 68) - min(bounds.height*0.062, 53) + safeAreaInsets.bottom
        let row=JimiV9NavigationHeader.RowLayout(bounds:bounds,safeAreaTop:top)
        let arcadeTop = row.top+66+20
        let arcadeBottom = bounds.height-safeAreaInsets.bottom-20
        let baselineArcadeGap:CGFloat = 20
        let ratios = worldIDs.map { id -> CGFloat in
            guard let image=artworkViews[id]?.image else { return 1 }
            return image.size.height/max(1,image.size.width)
        }
        let fittedWidth = max(0,(arcadeBottom-arcadeTop-baselineArcadeGap*2)/max(1,ratios.reduce(0,+)))
        let buttonWidth = arcade ? min(width*0.676,273,fittedWidth)*1.2 : min(width*0.676,273)
        // Keep all enlarged islands inside the same viewport. The staggered
        // transparent image envelopes may interleave vertically.
        let arcadeGap = (arcadeBottom-arcadeTop-buttonWidth*ratios.reduce(0,+))/2
        let flagWidth = min(width*0.385,150)
        var contentHeight = arcade ? bounds.height : max(bounds.height,hubHeight)
        var arcadeY = arcadeTop
        let flagHeight = flagWidth*49/105
        for (index, unit) in worldUnits.enumerated() {
            let id = worldIDs[index]
            let y: CGFloat = arcade ? arcadeY-top+[0,15,34][index] : [118,323,557][index]
            let buttonHeight = arcade ? buttonWidth*ratios[index] : min(width*0.468,190)
            if arcade { arcadeY += buttonHeight+arcadeGap }
            let originalX: CGFloat = id == 3 ? width+8-buttonWidth : (id == 1 ? -2 : -6)
            let x: CGFloat = id == 3 ? width-16-buttonWidth : 16
            let rect = CGRect(x: x, y: top+y, width: buttonWidth, height: buttonHeight)
            if arcade,index == worldUnits.count-1 {
                // Scroll extent belongs to authored layout, never the animated
                // Unit frame (the exit model is already collapsed to zero).
                contentHeight = max(bounds.height,rect.maxY+20+safeAreaInsets.bottom)
            }
            unit.bounds = CGRect(origin: .zero, size: rect.size)
            // Route exit uses a54% vertical pivot. Relayout must preserve the
            // same untransformed rectangle, not recenter that shifted anchor
            // (which jumps every World upward before/during its collapse).
            unit.layer.position = CGPoint(x: rect.minX + rect.width * unit.layer.anchorPoint.x,
                                          y: rect.minY + rect.height * unit.layer.anchorPoint.y)
            let artworkScale:CGFloat = arcade && index == 1 ? 1.1 : 1
            let visualSize = arcade ? buttonWidth*0.96*artworkScale : min(width*0.65,254)
            let visualHeight = arcade ? buttonHeight*0.96*artworkScale : visualSize
            floats[id]?.bounds = CGRect(x: 0, y: 0, width: visualSize, height: visualHeight)
            // Artwork adjustments are independent of the Unit/cloud motion owner.
            let artworkShift:CGPoint = arcade ? [CGPoint(x:-5,y:-4),CGPoint(x:5,y:16),CGPoint(x:-5,y:15)][index] : .zero
            floats[id]?.center = CGPoint(x:buttonWidth/2+artworkShift.x,y:(arcade ? buttonHeight/2 : buttonHeight*0.48)+artworkShift.y)
            tilts[id]?.bounds = CGRect(x: 0, y: 0, width: visualSize, height: visualHeight)
            tilts[id]?.layer.anchorPoint = CGPoint(x: 0.5, y: 0.54)
            tilts[id]?.layer.position = CGPoint(x: visualSize*0.5, y: visualHeight*0.54)
            bannerRevealShells[id]?.bounds = CGRect(x: 0,y: 0,width: visualSize,height: visualSize)
            bannerRevealShells[id]?.center = CGPoint(x: visualSize/2,y: visualSize/2)
            if let art = artworkViews[id] {
                let ratio = (art.image?.size.height ?? 1)/(art.image?.size.width ?? 1)
                let rect=CGRect(x:0,y:0,width:visualSize,height:visualSize*ratio)
                cartoonShells[id]?.bounds=CGRect(origin:.zero,size:rect.size)
                cartoonShells[id]?.center=CGPoint(x:rect.midX,y:rect.midY)
                art.frame=CGRect(origin:.zero,size:rect.size)
            }
            if let banner = banners[id], let flag = flagViews[id] {
                let edge = max(-width*0.128, -50)
                let bx = id == 3 ? edge-38 : visualSize-(edge-30)-flagWidth
                let by = visualSize/2 - (id == 1 ? 14 : id == 2 ? 20 : 26)
                banner.bounds = CGRect(x: 0, y: 0, width: flagWidth, height: flagHeight)
                banner.layer.anchorPoint = CGPoint(x: id == 3 ? 1 : 0, y: 0.18)
                banner.layer.position = CGPoint(x: bx+(id == 3 ? flagWidth : 0), y: by+flagHeight*0.18)
                flag.bounds = banner.bounds; flag.center = CGPoint(x: flagWidth/2, y: flagHeight/2)
                counts[id]?.frame = CGRect(x: id == 3 ? 3 : flagWidth*0.52-3, y: flagHeight*0.57+5-9.5, width: flagWidth*0.48, height: 19)
            }
            var overflow = rect
            for (cloud, authored) in cloudViews where cloudWorldID(authored.minY) == id {
                // Endurance moves its complete cloud group; the other worlds
                // move only their upper cloud row, preserving lower clouds.
                let cloudShift:CGFloat = !arcade ? 0 : id == 1 ? 40 : (id == 3 && authored.minY < 400 || id == 2 && authored.minY < 632) ? 24 : 0
                let cloudRect = authored.offsetBy(dx: x-originalX+(arcade && id == 3 ? 40:0), dy: top+82 + (arcade ? y - [118,323,557][index] : 0)+cloudShift)
                cloud.frame = cloudRect.offsetBy(dx: -rect.minX, dy: -rect.minY)
                overflow = overflow.union(cloudRect)
            }
            visualBounds[id] = overflow.insetBy(dx: -12, dy: -12)
        }
        // Publish only the final extent. A temporary viewport-height content
        // size would clamp a bottom-scrolled Hub before its exit even starts.
        content.frame = CGRect(x:0,y:0,width:width,height:contentHeight)
        scrollView.contentSize = content.bounds.size
        let headerTop=row.top
        // Header is a route-motion target with a top-center animation pivot.
        // frame is undefined under its collapsed model transform; retain the
        // same untransformed rectangle for both active and restored anchors.
        header.bounds = CGRect(x: 0, y: 0, width: width, height: headerTop + 66)
        header.layer.position = CGPoint(x: width * header.layer.anchorPoint.x,
                                        y: header.bounds.height * header.layer.anchorPoint.y)
        backButton.frame = row.buttonFrame(x:24)
        navigationTarget.frame = backButton.frame
        backpackAlert.frame=CGRect(x:21,y:1,width:28,height:28)
        backpackButton.frame = row.buttonFrame(x:width-64,width:40,height:48)
        crateNavigationTarget.frame = backpackButton.frame.insetBy(dx:-2,dy:0)
        title.frame = row.titleFrame
        updateIdleAdmission()
    }
    private func cloudWorldID(_ y: CGFloat) -> Int { y < 220 ? 1 : y < 560 ? 3 : 2 }

    /// Call only after the complete incoming cascade settles. The controller
    /// calls stopIdle before route exit/background; no polling/RAF is created.
    func startIdle() {
        backpackAlert.setActive(!backpackAlert.isHidden && !isHidden && window != nil)
        guard window != nil, !isHidden, alpha > 0, !UIAccessibility.isReduceMotionEnabled else { return }
        idleRequested = true
        updateIdleAdmission()
    }

    /// Freeze currently painted inner poses before removing all idle owners so
    /// an outgoing Unit does not jump back to its neutral art underneath it.
    func stopIdle() {
        cancelWorldTap()
        backpackAlert.setActive(false)
        idleRequested = false
        for id in worldIDs { removeIdle(id, freeze: true) }
        admittedWorlds.removeAll()
    }

    /// Parent calls while Hub is hidden, before priming route-enter transforms.
    func resetIdlePose() {
        cancelWorldTap()
        stopIdle()
        idleClocks.removeAll()
        pausedIdleOffsets.removeAll()
        CATransaction.begin(); CATransaction.setDisableActions(true)
        for id in worldIDs {
            floats[id]?.layer.transform = CATransform3DIdentity
            tilts[id]?.layer.transform = CATransform3DIdentity
            banners[id]?.transform = CGAffineTransform(rotationAngle: bannerAngle(id) * .pi/180)
        }
        for (cloud, _) in cloudViews { cloud.layer.transform = CATransform3DIdentity }
        CATransaction.commit()
    }

    override var isHidden: Bool { didSet { if isHidden { cancelWorldTap();stopIdle() } } }
    override func didMoveToWindow() {
        super.didMoveToWindow()
        if window == nil { cancelWorldTap();stopIdle() }
    }
    func scrollViewDidScroll(_ scrollView: UIScrollView) { updateIdleAdmission() }

    private func updateIdleAdmission() {
        guard idleRequested, !isHidden, window != nil else { return }
        let viewport = CGRect(origin: scrollView.contentOffset, size: scrollView.bounds.size)
        for id in worldIDs {
            let visible = visualBounds[id]?.intersects(viewport) == true
            if visible && !admittedWorlds.contains(id) { installIdle(id); admittedWorlds.insert(id) }
            if !visible && admittedWorlds.contains(id) { removeIdle(id, freeze: false); admittedWorlds.remove(id) }
        }
    }

    private func installIdle(_ id: Int) {
        guard let floating = floats[id], let tilt = tilts[id], let banner = banners[id] else { return }
        var peak = CATransform3DMakeTranslation(0,-8,0)
        peak = CATransform3DScale(peak,1.018,1.018,1)
        peak = CATransform3DRotate(peak,0.7 * .pi/180,0,0,1)
        addLoop(floating.layer, keyPath: "transform", values: transforms([CATransform3DIdentity,peak,CATransform3DIdentity]),
                times: [0,0.5,1], duration: id == 1 ? 4.4 : id == 2 ? 4.85 : 5.2)
        // CSS 3D face-local authored keyframes; outer Unit transform untouched.
        let tiltPoints: [(CGFloat,CGFloat,CGFloat,CGFloat,CGFloat)] = [
            (0,0,-0.35,0,1),(-2.1,7.2,0.9,10,1.012),(1.55,-6.4,-0.8,7,1.008),
            (-0.35,2,0.2,3,1.004),(0,0,-0.35,0,1)]
        let tiltValues = tiltPoints.map { x,y,z,depth,scale -> NSValue in
            var t = CATransform3DIdentity; t.m34 = -1/720
            t = CATransform3DRotate(t,x * .pi/180,1,0,0)
            t = CATransform3DRotate(t,y * .pi/180,0,1,0)
            t = CATransform3DRotate(t,z * .pi/180,0,0,1)
            t = CATransform3DTranslate(t,0,0,depth)
            return NSValue(caTransform3D: CATransform3DScale(t,scale,scale,1))
        }
        addLoop(tilt.layer, keyPath: "transform", values: tiltValues,
                times: [0,0.28,0.58,0.78,1], duration: 4.55 + Double(id-1)*0.72)
        // Same authored per-cloud motion/duration; start at neutral (v9's
        // journey-v700-idle-seamless-start), not random negative float phases.
        let motions: [(CGFloat,CGFloat,Double,CGFloat)] = [
            (8,-5,7.3,1.03),(7,4,6.8,1.025),(7,-5,7.1,1.03),(-7,5,6.7,1.02),
            (8,-5,6.4,1.02),(-7,6,5.8,1.04),(-9,5,7.2,1.02),(7,-5,6.9,1.03),
            (8,5,6.1,1.05),(-8,6,6.6,1.03),(7,-5,5.9,1.04),(-7,5,7.1,1.03),(-6,4,7.6,1.04)]
        for (index, item) in cloudViews.enumerated() where cloudWorldID(item.1.minY) == id {
            let (dx,dy,duration,scale) = motions[index]
            let cloudPeak = CATransform3DScale(CATransform3DMakeTranslation(dx,dy,0),scale,scale,1)
            addLoop(item.0.layer, keyPath: "transform", values: transforms([CATransform3DIdentity,cloudPeak,CATransform3DIdentity]),
                    times: [0,0.5,1], duration: duration)
        }
        guard !arcade else { return } // Arcade has no progress flags to animate.
        let angles: [CGFloat] = [0,1,-1.7,2.5,-0.65,-2.1,1.25,0]
        let ys: [CGFloat] = [0,-1.3,1.7,-2.1,0.8,1.9,-1.45,0]
        let flagValues = zip(angles,ys).map { angle,y in
            NSValue(caTransform3D: CATransform3DRotate(CATransform3DMakeTranslation(0,y,0), (bannerAngle(id)+angle) * .pi/180,0,0,1))
        }
        addLoop(banner.layer, keyPath: "transform", values: flagValues,
                times: [0,0.14,0.29,0.46,0.61,0.76,0.9,1], duration: id == 1 ? 7.6 : id == 2 ? 8.35 : 7.9,
                timing: CAMediaTimingFunction(controlPoints: 0.45,0.05,0.55,0.95))
    }

    private func transforms(_ values: [CATransform3D]) -> [NSValue] { values.map { NSValue(caTransform3D: $0) } }
    private func bannerAngle(_ id: Int) -> CGFloat { id == 1 ? -15 : id == 2 ? 0 : 2 }
    private func addLoop(_ layer: CALayer, keyPath: String, values: [Any], times: [NSNumber], duration: Double,
                         timing: CAMediaTimingFunction = CAMediaTimingFunction(name: .easeInEaseOut)) {
        let animation = CAKeyframeAnimation(keyPath: keyPath)
        animation.values = values; animation.keyTimes = times; animation.duration = duration
        animation.timingFunctions = Array(repeating: timing, count: values.count-1)
        animation.repeatCount = .infinity
        let key = idleKey + "." + keyPath
        let identity = ObjectIdentifier(layer)
        let now = layer.convertTime(CACurrentMediaTime(), from: nil)
        let offset = pausedIdleOffsets[identity]?[key] ?? 0
        animation.beginTime = now
        animation.timeOffset = offset
        idleClocks[identity, default: [:]][key] = IdleClock(startedAt: now, offset: offset, duration: duration)
        pausedIdleOffsets[identity]?[key] = nil
        if pausedIdleOffsets[identity]?.isEmpty == true { pausedIdleOffsets[identity] = nil }
        layer.add(animation, forKey: key)
    }
    private func removeIdle(_ id: Int, freeze: Bool) {
        var layers: [CALayer] = [floats[id]?.layer,tilts[id]?.layer,banners[id]?.layer].compactMap { $0 }
        layers += cloudViews.filter { cloudWorldID($0.1.minY) == id }.map { $0.0.layer }
        CATransaction.begin(); CATransaction.setDisableActions(true)
        for layer in layers {
            let keys = (layer.animationKeys() ?? []).filter { $0.hasPrefix(idleKey) }
            let identity = ObjectIdentifier(layer)
            let now = layer.convertTime(CACurrentMediaTime(), from: nil)
            for key in keys {
                if freeze, let clock = idleClocks[identity]?[key] {
                    pausedIdleOffsets[identity, default: [:]][key] =
                        (clock.offset + max(0, now-clock.startedAt)).truncatingRemainder(dividingBy: clock.duration)
                } else {
                    pausedIdleOffsets[identity]?[key] = nil
                }
                idleClocks[identity]?[key] = nil
            }
            if idleClocks[identity]?.isEmpty == true { idleClocks[identity] = nil }
            if pausedIdleOffsets[identity]?.isEmpty == true { pausedIdleOffsets[identity] = nil }
            if freeze, !keys.isEmpty, let painted = layer.presentation() {
                layer.transform = painted.transform
                layer.opacity = painted.opacity
            }
            keys.forEach { layer.removeAnimation(forKey: $0) }
        }
        CATransaction.commit()
    }
    /// Artwork-only finite contact; the Unit route shell and shared idle
    /// transforms keep their own owners. No timer or recurring observer.
    static let worldTapAnimationKey="native.hub.world-scale-up"
    func playWorldTap(_ id:Int,completion:@escaping()->Void) {
        guard let target=artworkViews[id],window != nil,!UIAccessibility.isReduceMotionEnabled else { completion();return }
        if arcade,let shell=cartoonShells[id] {NativeHubBackpackFeedback.play(on:shell)}
        CATransaction.begin();CATransaction.setCompletionBlock(completion)
        // A gentle enlargement and return, without the navigation icon's
        // compressed first frame or elastic overshoot. Child artwork keeps
        // this independent of the Unit's authored idle and route exit.
        let animation=CAKeyframeAnimation(keyPath:"transform.scale")
        animation.values=[1,1.12,1];animation.keyTimes=[0,0.6,1]
        animation.duration=0.25
        animation.timingFunctions=Array(repeating:CAMediaTimingFunction(name:.easeInEaseOut),count:2)
        animation.beginTime=target.layer.convertTime(CACurrentMediaTime(),from:nil)
        target.layer.add(animation,forKey:Self.worldTapAnimationKey)
        CATransaction.commit()
    }
    /// Contact composes beneath the existing Unit exit and idle parents.
    func playJourneyWorldContact(_ id:Int) {
        guard !arcade,window != nil,let shell=cartoonShells[id] else{return}
        NativeHubBackpackFeedback.play(on:shell)
    }
    func cancelWorldTap() {
        for shell in cartoonShells.values {shell.layer.removeAnimation(forKey:NativeHubBackpackFeedback.animationKey)}
        for target in artworkViews.values {
            target.layer.removeAnimation(forKey:Self.worldTapAnimationKey)
            target.layer.removeAnimation(forKey:NativeHubBackpackFeedback.animationKey)
        }
    }
    @objc private func back() { onInputDiagnostic?("back.action");onBack?() }
    @objc private func backpack() { onInputDiagnostic?("crate.action");onBackpack?() }
    @objc private func openWorld(_ sender: UIButton) { onInputDiagnostic?("world.action id=\(sender.tag)");onWorld?(sender.tag) }
}
