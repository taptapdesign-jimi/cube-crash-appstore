import UIKit
import StackToSixGameplay

private final class JimiV9HubScrollView: UIScrollView {
    override func touchesShouldCancel(in view: UIView) -> Bool {
        // A pan beginning on a World must scroll, never activate on release.
        view is UIControl || super.touchesShouldCancel(in: view)
    }
}

/// The36pt crate source must fill its authored navigation box on tablet too.
/// UIKit's default UIButton image rect caps small originals at intrinsic size.
@MainActor
final class JimiV9HubNavigationButton:JimiV9PlainButton {
    var fillsArtworkBox=false
    override func imageRect(forContentRect contentRect:CGRect)->CGRect {
        fillsArtworkBox ? contentRect.inset(by:imageEdgeInsets):super.imageRect(forContentRect:contentRect)
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
    let backpackButton = JimiV9HubNavigationButton(type: .custom)
    private let content = UIView()
    private let arcade: Bool
    private let title = JimiV9ArchedNavigationTitle()
    private(set) var worldUnits: [UIButton] = []
    private var counts: [Int: UILabel] = [:]
    private var cloudViews: [(UIImageView, CGRect)] = []
    private let cloudDrag:JimiWorldCloudDrag
    private var cloudRouteShells:[ObjectIdentifier:UIView]=[:]
    private var arcadeCloudImages:[UIImage?]=[]
    private var arcadeCloudChoices:[[Int]]=[]
    private var arcadeCloudOffsets:[ObjectIdentifier:CGPoint]=[:]
    private var arcadeCloudDrifts:[CGPoint]=[]
    private var arcadeCloudDurations:[Double]=[]
    private var leftFillClouds: [Int: UIImageView] = [:]
    private let cloudPlane=UIView()
    private(set) var cloudUnits: [Int:UIView] = [:]
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
        cloudDrag=JimiWorldCloudDrag(strength:arcade ? 1:2)
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
        // Journey and Arcade contact respond to a completed tap immediately.
        // Cancellation still hands a drag to the scroll view before activation.
        scrollView.delaysContentTouches = false
        scrollView.canCancelContentTouches = true
        scrollView.delegate = self
        addSubview(scrollView); scrollView.addSubview(content)
        cloudPlane.isUserInteractionEnabled=false
        content.addSubview(cloudPlane)
        let paths = arcade ? ["assets/arcade/endourance.png", "assets/arcade/pure dice.png", "assets/arcade/slow burn.png"] : ["assets/journey assets/forest/forest world/1Forest main.png",
                     "assets/journey assets/robo/robo world/robo-main.png",
                     "assets/journey assets/beach/Beacj world/beach-main.png"]
        let names = arcade ? ["Endurance", "One Lucky Drop", "Slow Burn"] : ["Forest", "Area 55", "Beach"]
        let cloudPaths = ["oblak-forest1", "oblak-forest2", "oblak+srednji", "oblak mali ljevo", "oblak mali desno", "oblak veliki ljevo dole"]
        if arcade {arcadeCloudImages=cloudPaths.map {assets.image("assets/board transition/\($0).png")}}
        let journeyClouds: [(Int, CGFloat, CGFloat, CGFloat, CGFloat)] = [
            (5,-70,-6,272,0.78),(1,-92,58,188,0.74),(5,100,6,248,0.76),(2,200,138,166,0.72),
            (2,-34,76,286,0.8),(0,214,58,184,0.72),(5,24,222,214,0.78),(2,168,240,198,0.76),
            (3,-22,400,176,0.68),(2,136,418,236,0.78),(0,32,576,214,0.72),(5,198,598,184,0.68),(2,-10,632,198,0.62)]
        // Arcade owns exactly five clouds per island. Marker Y retains the
        // existing World grouping; physical layout below spans the empty lanes.
        let arcadeClouds:[(Int,CGFloat,CGFloat,CGFloat,CGFloat)]=worldIDs.flatMap { id in
            let choices=Array(cloudPaths.indices.shuffled().prefix(5))
            return choices.enumerated().map { slot,choice in
                (choice,CGFloat(0),CGFloat(id == 1 ? 100:id == 3 ? 300:600),
                 [CGFloat(272),198,188,166,248][slot],[CGFloat(0.78),0.74,0.76,0.72,0.76][slot])
            }
        }
        let clouds=arcade ? arcadeClouds:journeyClouds
        for (index,x,y,width,alpha) in clouds {
            let image = assets.image("assets/board transition/\(cloudPaths[index]).png")
            let cloud = UIImageView(image: image)
            cloud.contentMode = .scaleAspectFit; cloud.alpha = alpha
            cloud.isUserInteractionEnabled=false
            if arcade {cloud.tag=cloudViews.count%5;cloud.accessibilityIdentifier="native.arcade.cloud.\(cloudViews.count)"}
            let ratio = (image?.size.height ?? 1) / (image?.size.width ?? 1)
            let rect = CGRect(x: x + (arcade ? CGFloat.random(in: -12...12) : 0), y: y, width: width, height: width*ratio)
            cloudViews.append((cloud, rect))
            let shell=UIView();shell.isUserInteractionEnabled=false
            shell.accessibilityIdentifier="native.\(arcade ? "arcade":"hub").cloud-route.\(cloudViews.count-1)"
            shell.addSubview(cloud);content.addSubview(shell)
            cloudRouteShells[ObjectIdentifier(cloud)]=shell
        }
        for index in 0..<3 {
            let id = worldIDs[index]
            let carrier=UIView();carrier.isUserInteractionEnabled=false
            cloudPlane.addSubview(carrier);cloudUnits[id]=carrier
            let button = JimiV9PlainButton(type: .custom)
            button.tag = id; button.accessibilityLabel = names[index] + " world"
            button.accessibilityIdentifier = "native.hub.world.\(id)"
            button.addTarget(self, action: #selector(openWorld(_:)), for: .touchUpInside)
            if !arcade {
                let cloud=UIImageView(image:assets.image("assets/board transition/oblak veliki ljevo dole.png"))
                cloud.contentMode = .scaleAspectFit; cloud.alpha=0.80
                cloud.isUserInteractionEnabled=false
                cloud.accessibilityIdentifier="native.hub.left-cloud.\(id)"
                let shell=UIView();shell.isUserInteractionEnabled=false
                shell.accessibilityIdentifier="native.hub.cloud-route.fill.\(id)"
                shell.addSubview(cloud);button.addSubview(shell)
                cloudRouteShells[ObjectIdentifier(cloud)]=shell
                leftFillClouds[id]=cloud
            }
            // Cloud route shells move independently; artwork keeps its Unit route.
            for (cloud, rect) in cloudViews where cloudWorldID(rect.minY) == id {
                let target=cloudRouteShells[ObjectIdentifier(cloud)] ?? cloud
                if arcade,cloud.tag == 4 {button.insertSubview(target,at:0)}else{button.addSubview(target)}
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
            let image=assets.image(paths[index],densityAware:arcade || id == 1)
            let artwork = UIImageView(image:image)
            artwork.frame = CGRect(x: 0, y: 0, width: 273, height: 190)
            artwork.contentMode = .scaleAspectFit
            artwork.accessibilityIdentifier = arcade ? "native.arcade-hub.art.\(id)" : "native.hub.art.\(id)"
            let cartoon=UIView();cartoon.isUserInteractionEnabled=false
            tilt.addSubview(cartoon);cartoon.addSubview(artwork);cartoonShells[id]=cartoon
            artworkViews[id] = artwork
            content.addSubview(button); worldUnits.append(button)
        }
        header.backgroundColor = UIColor(red: 243/255, green: 238/255, blue: 232/255, alpha: 0.8)
        header.setHomeDividerImage(assets.image("assets/home-shadow.png"))
        header.setBackgroundImage(assets.image("assets/nav/nav-bg.png",densityAware:true),opacity:0.5)
        addSubview(header)
        backButton.setImage(assets.image("assets/chevron-back.png",densityAware:true), for: .normal)
        backButton.imageView?.contentMode = .scaleAspectFit
        backButton.imageEdgeInsets = UIEdgeInsets(top: 10, left: 10, bottom: 10, right: 10)
        backButton.accessibilityLabel = "Back to slider"; backButton.accessibilityIdentifier = "native.hub.back"
        backButton.addTarget(self, action: #selector(back), for: .touchUpInside)
        backpackButton.fillsArtworkBox=arcade
        backpackButton.setImage(assets.image(arcade ? "assets/hud/crate - hud.png" : "assets/nav/stats-nav.png", densityAware: true), for: .normal)
        backpackButton.imageView?.contentMode = .scaleAspectFit
        backpackButton.imageEdgeInsets = UIEdgeInsets(top:4,left:0,bottom:4,right:0)
        backpackButton.accessibilityLabel = arcade ? "Box" : "Backpack"; backpackButton.accessibilityIdentifier = arcade ? "native.arcade-hub.crate" : "native.hub.backpack"
        backpackButton.addTarget(self, action: #selector(backpack), for: .touchUpInside)
        backpackButton.isHidden = false
        backpackAlert.image=assets.image("assets/nav/alsert@2x.png") ?? assets.image("assets/nav/alert.png")
        backpackButton.addSubview(backpackAlert)
        title.text = arcade ? "Arcade" : "Journey"; title.font = assets.font(size: 28, weight: "ExtraBold")
        title.textColor = NativeTextPalette.navigationTitle
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
            if let count=counts[id] {
                var attributes:[NSAttributedString.Key:Any]=[.kern: -0.76]
                // Progress is refreshed after initial layout on every Hub entry.
                // Keep the tablet font in the replacement attributed string;
                // otherwise UIKit paints an unstyled run until a size change.
                if NativeTabletLayout.applies(bounds.size),!arcade,let font=count.font {
                    attributes[.font]=font
                }
                count.attributedText=NSAttributedString(string:"\(NativeScoreDisplay.text(completed)) / \(NativeScoreDisplay.text(total))",attributes:attributes)
            }
            let locked = activeWorldId.map { id > $0 && completed == 0 } ?? false
            let interim = world["hasInterimCard"] as? Bool ?? false
            worldUnits.first { $0.tag == id }?.accessibilityValue = "\(completed) of \(total)"
                + (locked ? ", locked" : "") + (interim ? ", current stage" : "")
            // v9 locked World/cloud styles retain full colour and tap routing.
        }
    }
    func resetScroll() { scrollView.setContentOffset(.zero, animated: false) }
    /// Pending/invisible Units cannot accept an early route selection.
    func isWorldVisibleForSelection(_ id:Int)->Bool {
        guard let unit=worldUnits.first(where:{$0.tag==id}),window != nil,!isHidden,
              let painted=unit.layer.presentation() else{return false}
        return painted.opacity>0.10 && abs(painted.transform.m11)>0.10
    }

    func setContentInteractionEnabled(_ enabled: Bool) {
        if !enabled {cloudDrag.stop(restore:false)}
        scrollView.isUserInteractionEnabled = enabled
    }
    override func layoutSubviews() {
        super.layoutSubviews()
        let width = bounds.width, top = safeAreaInsets.top
        let tablet=NativeTabletLayout.applies(bounds.size)
        let journeyWidth:CGFloat = tablet && !arcade ? 390 : width
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
        // Fit the whole phone composition below the header at the largest
        // uniform scale that keeps all three World artworks in the viewport.
        // Clouds keep their phone proportions and may bleed at the screen edges.
        let phoneButtonHeight:CGFloat = 390*0.468
        let phoneVisualSize:CGFloat = 390*0.65
        let journeyTops:[CGFloat] = [118,323,557]
        let sceneTop=journeyTops[0]+phoneButtonHeight*0.48-phoneVisualSize/2
        let sceneBottom=zip(journeyTops,ratios).map { y,ratio in
            y+phoneButtonHeight*0.48-phoneVisualSize/2+phoneVisualSize*ratio
        }.max() ?? 772
        let journeyScale:CGFloat = tablet && !arcade
            ? min(width/390,max(0,bounds.height-safeAreaInsets.bottom-24-(row.top+66+24))/(sceneBottom-sceneTop)) : 1
        let journeyOffset:CGFloat = tablet && !arcade ? row.top+66+24-top-sceneTop*journeyScale : 0
        let journeyGroupScale=journeyScale*(tablet && !arcade ? 1.30*0.95*0.94*0.95*1.05:1)
        // Retain the previous row centres while shrinking complete World Units.
        let journeyCompression:CGFloat = tablet && !arcade ? max(0,phoneVisualSize*journeyScale*0.30/2-8):0
        let fittedWidth = max(0,(arcadeBottom-arcadeTop-baselineArcadeGap*2)/max(1,ratios.reduce(0,+)))
        let buttonWidth = arcade ? min(width*0.676,tablet ? 273*1.4:273,fittedWidth)*1.2 : min(journeyWidth*0.676,273)*journeyGroupScale
        // Keep all enlarged islands inside the same viewport. The staggered
        // transparent image envelopes may interleave vertically.
        let arcadeGap = (arcadeBottom-arcadeTop-buttonWidth*ratios.reduce(0,+))/2
        let flagWidth = min(journeyWidth*0.385,150)*journeyGroupScale
        var contentHeight = arcade || tablet ? bounds.height : max(bounds.height,hubHeight)
        var arcadeY = arcadeTop
        var precedingArtworkBottom:CGFloat=0
        let flagHeight = flagWidth*49/105
        for (index, unit) in worldUnits.enumerated() {
            let id = worldIDs[index]
            let journeyRowShift=journeyCompression*(1-2*(journeyTops[index]-journeyTops[0])/(journeyTops[2]-journeyTops[0]))
            let tabletRowOffset:CGFloat=tablet && !arcade ? (id == 1 ? 20 : id == 2 ? 40 : id == 3 ? 26 : 0):0
            let phoneRowOffset:CGFloat = !tablet && !arcade && id == 3 ? 8:0
            let y: CGFloat = arcade ? arcadeY-top+[0,15,34][index] : journeyTops[index]*journeyScale+journeyOffset+journeyRowShift-phoneButtonHeight*(journeyGroupScale-journeyScale)*0.48+tabletRowOffset+phoneRowOffset
            let buttonHeight = arcade ? buttonWidth*ratios[index] : min(journeyWidth*0.468,190)*journeyGroupScale
            if arcade { arcadeY += buttonHeight+arcadeGap }
            let originalX: CGFloat = id == 3 ? width+8-buttonWidth : (id == 1 ? -2 : -6)
            let x: CGFloat = id == 3 ? width-16*journeyGroupScale-buttonWidth : 16*journeyGroupScale
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
            let cloudParent:UIView=cloudUnits[id]!
            if let carrier=cloudUnits[id] {
                carrier.isHidden = false
                carrier.bounds=unit.bounds
                carrier.layer.position=CGPoint(x:rect.minX+rect.width*carrier.layer.anchorPoint.x,y:rect.minY+rect.height*carrier.layer.anchorPoint.y)
            }
            let artworkScale:CGFloat = arcade ? 1.2*0.9*(index == 0 ? 0.95*0.9*1.05 : (index == 1 ? 1.1*1.1*0.9 : 1))*(tablet ? 1.1:((index == 0 || index == 2) ? 1.05:1))*(arcade && !tablet && index == 0 ? 1.05:1) : 1
            let pureDiceRefinement:CGFloat=tablet && arcade && index == 1 ? 0.95:1
            let islandEnlargement:CGFloat=tablet && arcade ? 1.15*0.95*pureDiceRefinement:1
            let visualSize = arcade ? buttonWidth*0.96*artworkScale*islandEnlargement : min(journeyWidth*0.65,254)*journeyGroupScale*(tablet ? 1.05*((id == 1 || id == 2) ? 0.97:1)*0.98:1)
            let visualHeight = arcade ? buttonHeight*0.96*artworkScale*islandEnlargement : visualSize
            let tabletIslandShift:CGPoint=tablet && arcade ? [CGPoint(x:8,y:26),CGPoint(x:48,y:-46),CGPoint(x:36,y:-66)][index]:.zero
            floats[id]?.bounds = CGRect(x: 0, y: 0, width: visualSize, height: visualHeight)
            // Artwork adjustments are independent of the Unit/cloud motion owner.
            let artworkShift:CGPoint = arcade ? [CGPoint(x:3,y:20),CGPoint(x:-19,y:8),CGPoint(x:11,y:-17)][index] : (tablet && id == 3 ? CGPoint(x:0,y:21):.zero)
            // Preserve the previous side-anchored centres while shrinking5%,
            // so the requested physical offsets are exact additions.
            let edgeAnchorSize=tablet && arcade ? visualSize/(0.95*pureDiceRefinement):visualSize
            let artworkCenterX:CGFloat
            if arcade,index == 0 {artworkCenterX = 16-x+edgeAnchorSize/2}
            else if arcade,index == 1 {artworkCenterX = width-16-x-edgeAnchorSize/2}
            else {artworkCenterX = buttonWidth/2+artworkShift.x}
            let islandOffset:CGPoint = arcade ? [CGPoint(x:-4,y:-32),CGPoint(x:14,y:-26),CGPoint(x:-8,y:16)][index] : .zero
            let floatingCenterY=(arcade ? buttonHeight/2 : buttonHeight*0.48)+artworkShift.y+islandOffset.y+(tablet && arcade && id == 1 ? 24:0)+(arcade && index == 1 ? (tablet ? 24:12):0)+tabletIslandShift.y
            floats[id]?.center = CGPoint(x:artworkCenterX+islandOffset.x+tabletIslandShift.x,y:floatingCenterY)
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
                art.bounds=CGRect(origin:.zero,size:rect.size)
                art.center=CGPoint(x:rect.midX,y:rect.midY)
                art.transform=tablet && arcade && index == 1 ? CGAffineTransform(scaleX:-1,y:1):.identity
            }
            if let banner = banners[id], let flag = flagViews[id] {
                let edge = max(-journeyWidth*0.128, -50)*journeyGroupScale
                let bx = id == 3 ? edge-38*journeyGroupScale : visualSize-(edge-30*journeyGroupScale)-flagWidth
                let by = visualSize/2 - (id == 1 ? 14 : id == 2 ? 20 : 26)*journeyGroupScale
                banner.bounds = CGRect(x: 0, y: 0, width: flagWidth, height: flagHeight)
                banner.layer.anchorPoint = CGPoint(x: id == 3 ? 1 : 0, y: 0.18)
                banner.layer.position = CGPoint(x: bx+(id == 3 ? flagWidth : 0), y: by+flagHeight*0.18)
                flag.bounds = banner.bounds; flag.center = CGPoint(x: flagWidth/2, y: flagHeight/2)
                if let count=counts[id] {
                    let largerCount=tablet && !arcade
                    NativeTabletLayout.labelFont(count,size:(largerCount ? 24:18)*journeyGroupScale)
                    count.adjustsFontSizeToFitWidth=largerCount
                    count.minimumScaleFactor=largerCount ? 0.85:0
                    let countHeight:CGFloat=largerCount ? 28:19
                    count.frame = CGRect(x: id == 3 ? 3*journeyGroupScale : flagWidth*0.52-3*journeyGroupScale, y: flagHeight*0.57+(5-countHeight/2)*journeyGroupScale, width: flagWidth*0.48, height: countHeight*journeyGroupScale)
                }
            }
            var overflow = rect
            let ownedClouds=cloudViews.filter {cloudWorldID($0.1.minY) == id}
            let cloudBounds=tablet && !arcade ? ownedClouds.reduce(CGRect.null) {$0.union($1.1)} : .zero
            for (cloud, authored) in ownedClouds {
                let routeShell=cloudRouteShells[ObjectIdentifier(cloud)]
                let target=routeShell ?? cloud
                if target.superview !== cloudParent {
                    if arcade,cloud.tag == 4 {cloudParent.insertSubview(target,at:0)}else{cloudParent.addSubview(target)}
                }
                // Endurance moves its complete cloud group; the other worlds
                // move only their upper cloud row, preserving lower clouds.
                let cloudShift:CGFloat = !arcade ? 0 : id == 1 ? 40 : (id == 3 && authored.minY < 400 || id == 2 && authored.minY < 632) ? 24 : 0
                let cloudRect: CGRect
                if arcade {
                    // Full-width rear bank fills the opposite-side lanes and
                    // gaps between staggered islands without moving artwork.
                    let slot=cloud.tag
                    let xs:[CGFloat]=[0.12,0.86,0.15,0.90,0.50]
                    let ys:[CGFloat]=[-0.35,-0.15,0.45,0.55,0.12]
                    let offset=arcadeCloudOffsets[ObjectIdentifier(cloud)] ?? .zero
                    // Keep Endurance's upper-left cloud small and below the hero's
                    // upper edge, regardless of the per-visit image/size draw.
                    let enduranceUpperLeft=id == 1 && slot == 0
                    let cloudWidth=authored.width*width/390*(enduranceUpperLeft ? 0.50:1)
                    let verticalPosition=enduranceUpperLeft ? 0.10+offset.y:ys[slot]+offset.y
                    let ratio=(cloud.image?.size.height ?? 1)/max(1,cloud.image?.size.width ?? 1)
                    let size=CGSize(width:cloudWidth,height:cloudWidth*ratio)
                    let center=CGPoint(x:width*(xs[slot]+offset.x),y:rect.minY+floatingCenterY-tabletIslandShift.y+visualHeight/islandEnlargement*verticalPosition)
                    cloudRect=CGRect(x:center.x-size.width/2,y:center.y-size.height/2,width:size.width,height:size.height)
                } else if tablet && !arcade {
                    // Fill the complete screen behind each World with the same
                    // bounded cloud group. Uniform image scale preserves shape;
                    // vertical centres retain the fitted three-World rhythm.
                    let bleed:CGFloat=64
                    let cloudScale=(width+2*bleed)/max(1,cloudBounds.width)
                    let size=CGSize(width:authored.width*cloudScale,height:authored.height*cloudScale)
                    let center=CGPoint(x:-bleed+(authored.midX-cloudBounds.minX)*cloudScale,
                                       y:top+journeyOffset+(authored.midY+82)*journeyScale)
                    cloudRect=CGRect(x:center.x-size.width/2,y:center.y-size.height/2,width:size.width,height:size.height)
                } else {
                    // Phone Journey clouds frame their own island rather than
                    // collecting beneath Forest or below the Beach viewport.
                    let phoneCloudX:CGFloat = !tablet && !arcade && id == 3 ? (authored.minX < 100 ? -48:48):0
                    let phoneCloudY:CGFloat = !tablet && !arcade ? (id == 3 ? (authored.minY < 400 ? 80:-24)+phoneRowOffset : id == 2 ? -76:0):0
                    cloudRect = authored.offsetBy(dx: x-originalX+(arcade && id == 3 ? 40:0)+phoneCloudX, dy: top+82 + (arcade ? y - [118,323,557][index] : 0)+cloudShift+phoneCloudY)
                }
                let local=cloudRect.offsetBy(dx:-rect.minX,dy:-rect.minY)
                if let routeShell {
                    routeShell.bounds=CGRect(origin:.zero,size:local.size)
                    routeShell.layer.position=CGPoint(x:local.minX+local.width*routeShell.layer.anchorPoint.x,
                        y:local.minY+local.height*routeShell.layer.anchorPoint.y)
                    cloud.bounds=routeShell.bounds;cloud.center=CGPoint(x:local.width/2,y:local.height/2)
                }else{cloud.frame=local}
                cloudDrag.register(cloud)
                overflow = overflow.union(cloudRect)
            }
            if tablet && arcade {
                // Retain the complete enlarged island inside the scroll extent.
                let artRect=CGRect(x:rect.minX+artworkCenterX+islandOffset.x+tabletIslandShift.x-visualSize/2,
                    y:rect.minY+floatingCenterY-visualHeight/2,width:visualSize,height:visualSize*ratios[index])
                overflow=overflow.union(artRect)
                contentHeight=max(contentHeight,artRect.maxY+20+safeAreaInsets.bottom)
            }
            if tablet && !arcade {
                let artRect=CGRect(x:rect.midX-visualSize/2,y:rect.minY+buttonHeight*0.48-visualSize/2,width:visualSize,height:visualSize)
                overflow=overflow.union(artRect)
            }
            if let cloud=leftFillClouds[id] {
                let shell=cloudRouteShells[ObjectIdentifier(cloud)]!
                if shell.superview !== cloudParent {cloudParent.insertSubview(shell,at:0)}
                shell.isHidden = !tablet
                cloud.isHidden = !tablet
                if tablet {
                    // Static, bounded left-side fill travels with its complete
                    // World Unit; no additional idle clock or resource owner.
                    let cloudWidth=width*0.82
                    let ratio=(cloud.image?.size.height ?? 1)/max(1,cloud.image?.size.width ?? 1)
                    // Later Units paint above earlier ones; keep this large
                    // fill below preceding artwork so it cannot veil a World.
                    let cloudTop=max(precedingArtworkBottom+8,rect.minY+buttonHeight*0.48+visualSize*0.12-cloudWidth*ratio/2)
                    let cloudRect=CGRect(x:-width*0.18,y:cloudTop,width:cloudWidth,height:cloudWidth*ratio)
                    let local=cloudRect.offsetBy(dx:-rect.minX,dy:-rect.minY)
                    shell.bounds=CGRect(origin:.zero,size:local.size)
                    shell.layer.position=CGPoint(x:local.minX+local.width*shell.layer.anchorPoint.x,
                        y:local.minY+local.height*shell.layer.anchorPoint.y)
                    cloud.bounds=shell.bounds;cloud.center=CGPoint(x:local.width/2,y:local.height/2)
                    cloudDrag.register(cloud)
                    overflow=overflow.union(cloudRect)
                }
            }
            precedingArtworkBottom=rect.minY+buttonHeight*0.48-visualSize/2+visualSize*ratios[index]
            if tablet && !arcade {contentHeight=max(contentHeight,precedingArtworkBottom+8)}
            visualBounds[id] = overflow.insetBy(dx: -12, dy: -12)
        }
        // Publish only the final extent. A temporary viewport-height content
        // size would clamp a bottom-scrolled Hub before its exit even starts.
        content.frame = CGRect(x:0,y:0,width:width,height:contentHeight)
        cloudPlane.frame=content.bounds
        scrollView.contentSize = content.bounds.size
        // Header is a route-motion target with a top-center animation pivot.
        // frame is undefined under its collapsed model transform; retain the
        // same untransformed rectangle for both active and restored anchors.
        header.bounds = CGRect(x: 0, y: 0, width: width, height: row.headerHeight())
        header.layer.position = CGPoint(x: width * header.layer.anchorPoint.x,
                                        y: header.bounds.height * header.layer.anchorPoint.y)
        backButton.frame = row.buttonFrame(x:24,visibleInset:13)
        backButton.imageEdgeInsets=row.iconInsets(UIEdgeInsets(top:10,left:10,bottom:10,right:10),imageHeight:24,inkCenterY:0.5104166666666666)
        navigationTarget.frame = backButton.frame
        backpackAlert.frame=row.iconRect(CGRect(x:21,y:1,width:28,height:28))
        backpackButton.frame = row.buttonFrame(x:width-64,width:40,height:48,visibleInset:arcade ? 0:40/64)
        backpackButton.imageEdgeInsets=row.iconInsets(UIEdgeInsets(top:4,left:0,bottom:4,right:0),imageHeight:40,inkCenterY:arcade ? 0.5138888888888888:0.4765625)
        crateNavigationTarget.frame = backpackButton.frame.insetBy(dx:-2,dy:0)
        NativeTabletLayout.labelFont(title,size:row.titleFontSize)
        title.frame = row.titleFrame(for:title)
        header.applyCurve(to:title,icons:[backButton,backpackButton])
        header.updateBackgroundForScroll(scrollView)
        updateIdleAdmission()
    }
    private func cloudWorldID(_ y: CGFloat) -> Int { y < 220 ? 1 : y < 560 ? 3 : 2 }

    /// Home-style individual cloud routes on selection screens only.
    /// Journey Stage/Unit screens have their own unchanged motion owner.
    func includingCloudTracks(_ tracks:[(UIView,JimiV9Motion.Track)])->[(UIView,JimiV9Motion.Track)] {
        var sequence=0
        return tracks.flatMap { target,track -> [(UIView,JimiV9Motion.Track)] in
            guard worldUnits.contains(where:{$0 === target}) else{return [(target,track)]}
            let enter=(track.tweens.last?.to.scaleX ?? 0)>=1
            var result:[(UIView,JimiV9Motion.Track)]=[(target,track)]
            var images=cloudViews.filter{cloudWorldID($0.1.minY) == target.tag}.map{ $0.0 }
            if NativeTabletLayout.applies(bounds.size),let fill=leftFillClouds[target.tag] {images.append(fill)}
            for cloud in images {
                guard let shell=cloudRouteShells[ObjectIdentifier(cloud)] else{continue}
                result.append((shell,JimiV9Motion.cloudCascade(on:shell,base:track,enter:enter,index:sequence,stagger:arcade && enter ? 0.014/1.40:0.014)))
                sequence += 1
            }
            return result
        }
    }

    /// Call only after the complete incoming cascade settles. The controller
    /// calls stopIdle before route exit/background; no polling/RAF is created.
    func startIdle() {
        backpackAlert.setActive(!backpackAlert.isHidden && !isHidden && window != nil)
        guard window != nil, !isHidden, alpha > 0, !UIAccessibility.isReduceMotionEnabled else { return }
        if !idleRequested {cloudDrag.finish()}
        idleRequested = true
        NativeHubBackpackFeedback.setIdle(on:backpackButton,active:true)
        updateIdleAdmission()
    }

    /// Freeze currently painted inner poses before removing all idle owners so
    /// an outgoing Unit does not jump back to its neutral art underneath it.
    func stopIdle() {
        cloudDrag.stop(restore:false)
        cancelWorldTap()
        backpackAlert.setActive(false)
        NativeHubBackpackFeedback.setIdle(on:backpackButton,active:false)
        idleRequested = false
        for id in worldIDs { removeIdle(id, freeze: true) }
        admittedWorlds.removeAll()
    }

    /// Parent calls while Hub is hidden, before priming route-enter transforms.
    func resetIdlePose() {
        cancelWorldTap()
        stopIdle()
        cloudDrag.stop(restore:true)
        idleClocks.removeAll()
        pausedIdleOffsets.removeAll()
        if arcade {
            cloudDrag.setMaximumOffset(CGFloat.random(in:60...80))
            // Sample once per visit, while hidden. Relayout and foreground resume
            // retain this composition and the existing fixed cloud/route owners.
            for (cloud,_) in cloudViews {arcadeCloudOffsets[ObjectIdentifier(cloud)]=CGPoint(x:CGFloat.random(in:-0.10...0.10),y:CGFloat.random(in:-0.16...0.16))}
            for group in worldIDs.indices {
                var choices=Array(arcadeCloudImages.indices.shuffled().prefix(5))
                if arcadeCloudChoices.indices.contains(group),choices == arcadeCloudChoices[group] {
                    choices.append(choices.removeFirst())
                }
                if arcadeCloudChoices.indices.contains(group) {arcadeCloudChoices[group]=choices}
                else {arcadeCloudChoices.append(choices)}
                for slot in 0..<5 {
                    let index=group*5+slot
                    let cloud=cloudViews[index].0
                    cloud.image=arcadeCloudImages[choices[slot]]
                    var authored=cloudViews[index].1
                    authored.size.width=[CGFloat(272),198,188,166,248][slot]*CGFloat.random(in:0.85...1.15)
                    authored.size.height=authored.width*(cloud.image?.size.height ?? 1)/max(1,cloud.image?.size.width ?? 1)
                    cloudViews[index]=(cloud,authored)
                }
            }
            setNeedsLayout()
            layoutIfNeeded()
            arcadeCloudDrifts=cloudViews.map {_ in CGPoint(x:CGFloat.random(in:0.15...0.20)*(Bool.random() ? 1:-1),y:CGFloat.random(in:32...48)*(Bool.random() ? 1:-1))}
            arcadeCloudDurations=cloudViews.map {_ in Double.random(in:8...10)}
        }
        CATransaction.begin(); CATransaction.setDisableActions(true)
        for id in worldIDs {
            floats[id]?.layer.transform = CATransform3DIdentity
            tilts[id]?.layer.transform = CATransform3DIdentity
            banners[id]?.transform = CGAffineTransform(rotationAngle: bannerAngle(id) * .pi/180)
        }
        for (cloud, _) in cloudViews { cloud.layer.transform = CATransform3DIdentity }
        for cloud in leftFillClouds.values {cloud.layer.transform=CATransform3DIdentity}
        CATransaction.commit()
    }

    override var isHidden: Bool { didSet { if isHidden { cancelWorldTap();stopIdle() } } }
    override func didMoveToWindow() {
        super.didMoveToWindow()
        if window == nil { cancelWorldTap();stopIdle();cloudDrag.clear() }
    }
    func scrollViewWillBeginDragging(_ scrollView:UIScrollView) {
        guard idleRequested,!isHidden,window != nil,scrollView.isUserInteractionEnabled,
              !UIAccessibility.isReduceMotionEnabled else{return}
        cloudDrag.begin(offset:scrollView.contentOffset.y)
    }
    func scrollViewDidScroll(_ scrollView: UIScrollView) {
        header.updateBackgroundForScroll(scrollView)
        if idleRequested,scrollView.isDragging,scrollView.isUserInteractionEnabled,
           !UIAccessibility.isReduceMotionEnabled {cloudDrag.update(offset:scrollView.contentOffset.y)}
        updateIdleAdmission()
    }
    func scrollViewDidEndDragging(_ scrollView:UIScrollView,willDecelerate decelerate:Bool) {
        if idleRequested {cloudDrag.finish()}else{cloudDrag.stop(restore:false)}
    }

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
            let dx:CGFloat,dy:CGFloat,duration:Double,scale:CGFloat
            if arcade {
                // Same wide Home-cloud excursion; fixed captured profiles are
                // renewed only by resetIdlePose on real Arcade entry.
                let drift=arcadeCloudDrifts.indices.contains(index) ? arcadeCloudDrifts[index]:CGPoint(x:0.175,y:40)
                dx=drift.x*bounds.width*0.90;dy=drift.y*0.90
                duration=arcadeCloudDurations.indices.contains(index) ? arcadeCloudDurations[index]:9
                scale=1.03
            }else{
                let motion=motions[index]
                dx=motion.0*2*(NativeTabletLayout.applies(bounds.size) ? 1.4:1)
                dy=motion.1*2;duration=motion.2;scale=motion.3
            }
            let cloudPeak = CATransform3DScale(CATransform3DMakeTranslation(dx,dy,0),scale,scale,1)
            addLoop(item.0.layer, keyPath: "transform", values: transforms([CATransform3DIdentity,cloudPeak,CATransform3DIdentity]),
                    times: [0,0.5,1], duration: duration)
        }
        if NativeTabletLayout.applies(bounds.size),!arcade,let cloud=leftFillClouds[id] {
            let peak=CATransform3DMakeTranslation((id == 3 ? -8:8)*2*1.4,0,0)
            addLoop(cloud.layer,keyPath:"transform",values:transforms([CATransform3DIdentity,peak,CATransform3DIdentity]),times:[0,0.5,1],duration:id == 1 ? 7.3:id == 3 ? 6.8:7.1)
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
        if let cloud=leftFillClouds[id] {layers.append(cloud.layer)}
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
    func playWorldTap(_ id:Int,beginTime:CFTimeInterval? = nil,completion:@escaping()->Void) {
        guard let target=artworkViews[id],window != nil,!UIAccessibility.isReduceMotionEnabled else { completion();return }
        if arcade,let shell=cartoonShells[id] {NativeHubBackpackFeedback.play(on:shell,beginTime:beginTime)}
        CATransaction.begin();CATransaction.setCompletionBlock(completion)
        // A gentle enlargement and return, without the navigation icon's
        // compressed first frame or elastic overshoot. Child artwork keeps
        // this independent of the Unit's authored idle and route exit.
        let animation=CAKeyframeAnimation(keyPath:"transform.scale")
        animation.values=[1,1.12,1];animation.keyTimes=[0,0.6,1]
        animation.duration=0.25
        animation.timingFunctions=Array(repeating:CAMediaTimingFunction(name:.easeInEaseOut),count:2)
        animation.beginTime=target.layer.convertTime(beginTime ?? CACurrentMediaTime(),from:nil)
        target.layer.add(animation,forKey:Self.worldTapAnimationKey)
        CATransaction.commit()
    }
    /// Contact composes beneath the existing Unit exit and idle parents.
    func playJourneyWorldContact(_ id:Int) {
        guard !arcade,window != nil,let shell=cartoonShells[id] else{return}
        NativeHubBackpackFeedback.play(on:shell)
    }
    /// Stronger selected-island contact, preserving the Arcade Unit and all
    /// surrounding screen geometry. Same finite shared cartoon phases, with
    /// amplified squash/stretch, lift and a small settling lean on one child.
    static let arcadeContactDuration=0.48
    func playArcadeWorldContact(_ id:Int,beginTime:CFTimeInterval? = nil,completion:@escaping()->Void) {
        guard arcade,window != nil,!UIAccessibility.isReduceMotionEnabled,let shell=cartoonShells[id] else{completion();return}
        let lean:[CGFloat]=[0,-3,3,-1.5,0.6,0]
        let motion=CAKeyframeAnimation(keyPath:"transform")
        motion.values=NativeHUDTapMotion.poses.enumerated().map {index,pose in
            let transform=CATransform3DMakeTranslation(0,pose.offset*1.6,0)
            let scale=CATransform3DScale(transform,1+(pose.x-1)*1.45,1+(pose.y-1)*1.45,1)
            return NSValue(caTransform3D:CATransform3DRotate(scale,lean[index] * .pi/180,0,0,1))
        }
        motion.keyTimes=NativeHUDTapMotion.phases.map{NSNumber(value:$0)}
        motion.timingFunctions=Array(repeating:CAMediaTimingFunction(name:.easeInEaseOut),count:5)
        motion.duration=Self.arcadeContactDuration
        motion.beginTime=shell.layer.convertTime(beginTime ?? CACurrentMediaTime(),from:nil)
        CATransaction.begin();CATransaction.setCompletionBlock(completion)
        shell.layer.add(motion,forKey:NativeHubBackpackFeedback.animationKey)
        CATransaction.commit()
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
