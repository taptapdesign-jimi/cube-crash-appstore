import UIKit

private final class JimiWorldAnimationStart: NSObject, CAAnimationDelegate {
    let callback: @MainActor () -> Void
    init(_ callback:@escaping @MainActor () -> Void) {self.callback = callback}
    func animationDidStart(_ anim:CAAnimation) {Task { @MainActor in callback() }}
}

private final class JimiWorldScroll: UIScrollView {
    override func touchesShouldCancel(in view: UIView) -> Bool { view is UIControl || super.touchesShouldCancel(in: view) }
}

/// Renderer only. The existing Home/Hub controller owns route commits and semantic requests.
@MainActor
final class JimiNativeWorldView: UIView, UIScrollViewDelegate {
    let scrollView: UIScrollView = JimiWorldScroll()
    let header = JimiV9NavigationHeader(frame:.zero)
    private let navigationTarget = UIButton(type:.custom)
    let backButton = JimiV9PlainButton(type: .custom)
    let backpackAlert=NativeBackpackAlertView()
    func setBackpackUnread(_ unread:Bool){backpackAlert.setUnreadVisible(unread);backpackAlert.setActive(unread && active && admitted && !transition && modal == nil)}
    let backpackButton = JimiV9PlainButton(type: .custom)
    var onRequest: ((String, Int?) -> Void)?
    var onFeedback: ((String,Int?,Double?) -> Void)?
    var onAmbientPlansRequest: ((CGRect,[Int],@escaping ([[String:Any]]?)->Void)->Void)?
    var onShipVisibility:((Bool)->Void)?
    var onBeePlansRequest: (([Int],@escaping ([[String:Any]]?)->Void)->Void)?
    var onResourceFailure: ((String) -> Void)?
    private let content = UIView()
    private let main = UIView()
    private let title = UILabel()
    private let backArtwork = UIImageView()
    private let artwork: JimiV9Artwork
    private let resources: JimiNativeWorldResources
    private(set) var snapshot: JimiNativeWorldSnapshot
    private var units: [Int: UIButton] = [:]
    private var depthPlanes: [Int:[UIView]] = [:]
    private var ambient:JimiNativeWorldAmbient?
    private var loaded = Set<Int>()
    private var bees:JimiNativeWorldBees?
    private var landingBarrier: JimiNativeWorldPaintBarrier?
    private var pendingCardLanding: (() -> Void)?
    private var interimOwners: [Int:JimiNativeInterimEffect] = [:]
    private var dirtyUnits = Set<Int>()
    private var preparing = Set<Int>()
    private var resourceEpoch = 0
    private var admitted = false
    private var active = false
    private var transition = false
    private var generation = 0
    private var verticalIdleEpoch = CACurrentMediaTime()
    private var verticalIdlePausedAt: CFTimeInterval?
    private var animationReceipts: [JimiWorldAnimationStart] = []
    private var returnPrimeLayers: [CALayer] = []
    private var backRequested = false
    private var reminder: JimiNativeWorldReminder?
    private var reminderCarrier: UIView?
    private var reminderSource: UIView?
    private var modal: JimiNativeWorldCardView?
    private var pausedCardWaves: [(CALayer,String,CAAnimation,CFTimeInterval)] = []
    private(set) var preparationHasMissingResources = false
    var decodedArtworkBytes: Int { resources.decodedBytes }
    var preparedUnitCount: Int {loaded.count}
    var hasActiveCard: Bool { modal != nil }
    var hasPendingCardLanding: Bool {pendingCardLanding != nil}
    var gameplayTransitionResources:any NativeBoardTransitionResources {resources}
    private static let gameplayPreparationOwner = -900_001
    func releaseGameplayTransitionPreparation(){resources.release(Self.gameplayPreparationOwner)}
    var isReadyForInput: Bool { active && admitted && !transition }
    private var scale: CGFloat { max(0.01, bounds.width / 390) }

    init?(snapshot value: [String: Any], assets: JimiV9Artwork, validatedSnapshot:JimiNativeWorldSnapshot? = nil) {
        guard let snapshot = validatedSnapshot ?? JimiNativeWorldSnapshot(value) else { return nil }
        self.snapshot = snapshot; artwork = assets
        resources = JimiNativeWorldResources(root: assets.resourceRoot)
        super.init(frame: .zero)
        navigationTarget.isAccessibilityElement = false
        navigationTarget.addTarget(self,action:#selector(back),for:.touchUpInside)
        addSubview(navigationTarget)
        accessibilityIdentifier = "native.world.\(snapshot.worldID)"
        scrollView.delegate = self; scrollView.alwaysBounceVertical = true
        scrollView.contentInsetAdjustmentBehavior = .never; scrollView.showsVerticalScrollIndicator = false
        scrollView.delaysContentTouches = true; scrollView.canCancelContentTouches = true
        addSubview(scrollView); scrollView.addSubview(content); content.addSubview(main)
        addSubview(header); header.addSubview(title); header.addSubview(backButton); header.addSubview(backpackButton)
        title.font = assets.font(size: 32, weight: "ExtraBold"); title.textAlignment = .center
        title.textColor = UIColor(red:173/255,green:135/255,blue:117/255,alpha:1); title.text = snapshot.title
        header.backgroundColor = UIColor(red:243/255,green:238/255,blue:232/255,alpha:0.8)
        backButton.configuration = nil;backArtwork.image = assets.image("assets/close-icon.png",densityAware:true);backArtwork.contentMode = .scaleAspectFit;backArtwork.isUserInteractionEnabled = false;backButton.addSubview(backArtwork)
        backButton.setTitleColor(title.textColor, for: .normal)
        backButton.accessibilityIdentifier = "native.world.back"
        backButton.addTarget(self, action: #selector(back), for: .touchUpInside)
        backpackAlert.image=assets.image("assets/nav/alsert@2x.png") ?? assets.image("assets/nav/alert.png")
        backpackButton.addSubview(backpackAlert)
        backpackButton.setImage(assets.image("assets/nav/stats-nav.png",densityAware:true),for:.normal)
        backpackButton.bringSubviewToFront(backpackAlert)
        backpackButton.imageView?.contentMode = .scaleAspectFit
        backpackButton.imageEdgeInsets=UIEdgeInsets(top:4,left:0,bottom:4,right:0)
        backpackButton.accessibilityLabel="Backpack";backpackButton.accessibilityIdentifier="native.world.backpack"
        backpackButton.addTarget(self,action:#selector(openBackpack),for:.touchUpInside)
        createUnits(); alpha = 0
        if snapshot.worldID != 1 {
            main.layer.zPosition = 3
            ambient = JimiNativeWorldAmbient(plans:snapshot.ambientPlans,content:content,resources:resources)
            ambient?.onShipVisibility = { [weak self] visible in self?.onShipVisibility?(visible) }
            ambient?.onRequest = { [weak self] viewport,ids,callback in guard let self,self.active,self.admitted,!self.transition,self.modal == nil,let request = self.onAmbientPlansRequest else {callback(nil);return};request(viewport,ids,callback) }
        }
        bees = JimiNativeWorldBees(plans:snapshot.beePlans,content:content,main:main,resources:resources)
        bees?.onRequest = { [weak self] ids,callback in guard let self,self.active,self.admitted,!self.transition,self.modal == nil else {callback(nil);return};guard let request = self.onBeePlansRequest else {callback(nil);return};request(ids,callback) }
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    private func createUnits() {
        for unit in snapshot.units {
            let button = UIButton(type: .custom); button.tag = unit.boardID
            button.accessibilityIdentifier = "native.world.card.\(unit.boardID)"
            updateAccessibility(button, unit:unit)
            button.addTarget(self, action: #selector(card(_:)), for: .touchUpInside)
            units[unit.boardID] = button; content.addSubview(button)
            if snapshot.worldID != 1 {
                button.layer.zPosition = 8
                depthPlanes[unit.boardID] = [1,2,6].map {depth in let plane = UIView();plane.isUserInteractionEnabled = false;plane.layer.zPosition = CGFloat(depth);content.addSubview(plane);return plane}
            }
        }
    }
    private func updateAccessibility(_ button:UIButton, unit:JimiNativeWorldSnapshot.Unit) {
        let state = unit.locked ? "locked" : unit.interim ? "interim" : "regular"
        button.accessibilityValue = state
        button.accessibilityLabel = "Stage \(unit.boardID)\(state == "regular" ? "" : ", \(state)")"
    }
    override func layoutSubviews() {
        super.layoutSubviews(); scrollView.frame = bounds
        scrollView.contentInset.bottom = safeAreaInsets.bottom
        let row=JimiV9NavigationHeader.RowLayout(bounds:bounds,safeAreaTop:safeAreaInsets.top)
        let headerTop=row.top
        header.frame = CGRect(x:0,y:0,width:bounds.width,height:headerTop+58)
        title.frame = row.titleFrame
        backButton.frame = row.buttonFrame(x:22)
        backpackAlert.frame=CGRect(x:21,y:1,width:28,height:28)
        backpackButton.frame=row.buttonFrame(x:bounds.width-64,width:40,height:48)
        navigationTarget.frame = backButton.frame
        backArtwork.frame = CGRect(x:10,y:10,width:24,height:24)
        content.frame = CGRect(x: 0, y: 0, width: bounds.width, height: snapshot.contentHeight * scale)
        scrollView.contentSize = content.bounds.size; main.frame = snapshot.mainFrame.applying(CGAffineTransform(scaleX: scale, y: scale))
        for unit in snapshot.units { let frame = unit.frame.applying(CGAffineTransform(scaleX: scale, y: scale));units[unit.boardID]?.frame = frame;depthPlanes[unit.boardID]?.forEach {$0.frame = frame} }
        if !transition { updateResources() }
    }
    private func populate(_ target: UIView, parts: [JimiNativeWorldSnapshot.Part], owner: Int) {
        interimOwners.removeValue(forKey:owner)?.stop(); partViews(target).forEach { $0.layer.removeAllAnimations();$0.removeFromSuperview() }
        for part in parts {
            guard let image = resources.image(part.asset, owner: owner) else { preparationHasMissingResources = true; onResourceFailure?(part.asset); continue }
            let view = UIImageView(image: image); view.contentMode = .scaleAspectFit
            var rect = part.frame
            if owner == 1 && part.role == "card" { rect.origin.x += 12 / scale }
            if owner == 0 { rect.origin.x -= snapshot.mainFrame.minX; rect.origin.y -= snapshot.mainFrame.minY }
            if rect.height <= 0 { rect.size.height = rect.width * image.size.height / max(1,image.size.width) }
            view.frame = rect.applying(CGAffineTransform(scaleX: scale, y: scale))
            view.transform = CGAffineTransform(rotationAngle: part.rotation); view.alpha = part.role == "beam" ? CGFloat(part.beamIdle?.opacities.first ?? 0.2) : part.opacity
            view.accessibilityIdentifier = "native.world.part.\(owner).\(part.role)"
            let planeIndex = part.role == "cloud" ? 0 : (part.role == "island" || part.role == "stump") ? 1 : 2
            let parent = part.role == "card" ? target : depthPlanes[owner]?[planeIndex] ?? target
            view.layer.zPosition = part.depth;parent.addSubview(view)
            if part.role == "card",let definition = snapshot.units.first(where:{$0.boardID == owner}),definition.newRibbon {
                let badge=JimiNativeWorldRibbon.make(image:resources.image("assets/journey assets/orange-ribbon.png",owner:owner),assets:artwork,cardSize:view.bounds.size,scale:scale,portal:false,compact:bounds.width<=768)
                (badge as? JimiNativeNewRibbonView)?.setCardRotation(part.rotation);view.addSubview(badge)
            }
        }
        if owner > 0, let unit = snapshot.units.first(where: { $0.boardID == owner }), unit.locked {
            let number = UILabel(frame: target.bounds); number.text = String(format:"%02d",(owner-1)%10+1); number.textAlignment = .center; number.font = artwork.font(size:32*scale,weight:"ExtraBold"); number.textColor = UIColor(red:248/255,green:151/255,blue:77/255,alpha:1); number.alpha = 0.8; number.transform = CGAffineTransform(translationX:unit.lockedNumberOffset.x*scale,y:unit.lockedNumberOffset.y*scale).rotated(by:unit.lockedNumberRotation); target.addSubview(number)
        }
    }
    private func scheduleParts(_ parts:[JimiNativeWorldSnapshot.Part],target:UIView,owner:Int) {
        guard !preparing.contains(owner) else {return}
        preparing.insert(owner); let epoch = resourceEpoch
        resources.prepare(parts.map { $0.asset },owner:owner) { [weak self,weak target] accepted in
            guard let self,let target,self.resourceEpoch == epoch else {return}
            self.preparing.remove(owner)
            guard accepted else {self.preparationHasMissingResources = !self.resources.missingAssets.isEmpty;return}
            let viewport = CGRect(origin:self.scrollView.contentOffset,size:self.scrollView.bounds.size).insetBy(dx:0,dy:-220*self.scale)
            guard viewport.intersects(owner == 0 ? self.main.frame : target.frame) else {self.resources.release(owner);return}
            // Route-motion is a no-decode/no-allocation presentation boundary.
            guard !self.transition else {return}
            self.populate(target,parts:parts,owner:owner); self.loaded.insert(owner); self.dirtyUnits.remove(owner); self.updateIdle()
        }
    }
    /// Decode the selected incoming viewport off the main queue before route commit.
    /// Root calls this during outgoing Hub motion; it never reveals the surface.
    func prepare(completion:@escaping () -> Void) {
        layoutIfNeeded(); let epoch = resourceEpoch
        preparationHasMissingResources = !resources.missingAssets.isEmpty
        let viewport = CGRect(origin:scrollView.contentOffset,size:scrollView.bounds.size).insetBy(dx:0,dy:-220*scale)
        var remaining = 1
        func finish() { remaining -= 1; if remaining == 0 { completion() } }
        remaining += 1
        if let ambient {remaining += 1;ambient.prepareVisible(viewport:viewport,scale:scale) { [weak self] accepted in if let self,self.resourceEpoch==epoch {self.preparationHasMissingResources = self.preparationHasMissingResources || !accepted};finish() }}
        bees?.prepareVisible(viewport:viewport,scale:scale) { [weak self] accepted in if let self {self.preparationHasMissingResources = self.preparationHasMissingResources || !accepted};finish() }
        for (owner,target,parts) in [(0,main,snapshot.mainParts)] + snapshot.units.compactMap({ unit -> (Int,UIView,[JimiNativeWorldSnapshot.Part])? in
            guard let target = units[unit.boardID],viewport.intersects(target.frame) else {return nil}; return (unit.boardID,target,unit.parts)
        }) {
            if loaded.contains(owner) && !dirtyUnits.contains(owner) {continue}
            remaining += 1
            resources.prepare(parts.map{$0.asset} + (owner == 0 ? ["assets/modals/paper.png","assets/modals/star.png","assets/modals/star-empty.png","assets/highscore-icon.png","assets/combo-icon.png","assets/colelctibles/cardflip.png","assets/journey assets/orange-ribbon.png","assets/hand-pointer.png"] : []),owner:owner) { [weak self,weak target] accepted in
                guard let self,let target,self.resourceEpoch == epoch else {finish();return}
                self.preparationHasMissingResources = self.preparationHasMissingResources || !self.resources.missingAssets.isEmpty
                guard accepted else {finish();return}
                if !self.loaded.contains(owner) || self.dirtyUnits.contains(owner) {self.populate(target,parts:parts,owner:owner); self.loaded.insert(owner); self.dirtyUnits.remove(owner)}; finish()
            }
        }
        finish()
    }
    /// Cancellation retires only in-flight preparation receipts, never warm
    /// decoded artwork, geometry or the existing ambient/bee owners.
    func cancelPendingPreparation(){resourceEpoch += 1;preparing.removeAll();resources.cancelPendingPreparation()}
    private func updateResources() {
        let viewport = CGRect(origin: scrollView.contentOffset, size: scrollView.bounds.size).insetBy(dx: 0, dy: -180*scale)
        if (!loaded.contains(0) || dirtyUnits.contains(0)) && viewport.intersects(main.frame) { scheduleParts(snapshot.mainParts,target:main,owner:0) }
        for unit in snapshot.units {
            guard let view = units[unit.boardID] else { continue }
            if viewport.intersects(view.frame) {
                if !loaded.contains(unit.boardID) || dirtyUnits.contains(unit.boardID) { scheduleParts(unit.parts,target:view,owner:unit.boardID) }
            } else if loaded.contains(unit.boardID), modal?.boardID != unit.boardID, reminderSource?.superview !== view {
                interimOwners.removeValue(forKey:unit.boardID)?.stop(); view.layer.removeAllAnimations(); depthPlanes[unit.boardID]?.forEach {$0.layer.removeAllAnimations()};partViews(view).forEach { $0.layer.removeAllAnimations();$0.removeFromSuperview() }
                resources.release(unit.boardID); loaded.remove(unit.boardID)
            }
        }
        updateIdle()
    }
    func scrollViewDidScroll(_ scrollView: UIScrollView) { if !transition { updateResources() } }
    func reconcile(_ value: [String: Any]) {
        guard let next = JimiNativeWorldSnapshot(value) else {return}
        reconcile(next)
    }
    func reconcile(_ next:JimiNativeWorldSnapshot) {
        guard next.worldID == snapshot.worldID,
              (next.generation > snapshot.generation || (next.generation == snapshot.generation && next.revision >= snapshot.revision)) else { return }
        let previous = snapshot; snapshot = next
        if previous.ambientSessionID != next.ambientSessionID {ambient?.replacePlans(next.ambientPlans)}
        if previous.beeSessionID != next.beeSessionID {bees?.replacePlans(next.beePlans)}
        if previous.mainParts != next.mainParts {dirtyUnits.insert(0)}
        for unit in next.units {
            if let button = units[unit.boardID] {updateAccessibility(button,unit:unit)}
            let old = previous.units.first {$0.boardID == unit.boardID}
            if old?.parts != unit.parts || old?.locked != unit.locked || old?.interim != unit.interim {
                dirtyUnits.insert(unit.boardID)
            } else if old?.newRibbon != unit.newRibbon,let view = units[unit.boardID],let card = view.subviews.first(where:{$0.accessibilityIdentifier?.hasSuffix(".card") == true}) {
                if unit.newRibbon {
                    let ribbon=JimiNativeWorldRibbon.make(image:resources.image("assets/journey assets/orange-ribbon.png",owner:unit.boardID),assets:artwork,cardSize:card.bounds.size,scale:scale,portal:false,compact:bounds.width<=768)
                    (ribbon as? JimiNativeNewRibbonView)?.setCardRotation(unit.parts.first(where:{$0.role=="card"})?.rotation ?? 0)
                    card.addSubview(ribbon);if active && !transition && modal == nil {(ribbon as? JimiNativeNewRibbonView)?.enter()}
                } else {card.subviews.compactMap{$0 as? JimiNativeNewRibbonView}.forEach{ribbon in if active && !transition && modal == nil {ribbon.exit()}else{ribbon.quiesce();ribbon.removeFromSuperview()}}}
            }
        }
        if active && !transition && modal == nil {updateResources()}
    }

    /// A frozen incoming pose, prepared behind the canonical result cover.
    /// Keep model geometry untouched: the authored enter samples its baseline.
    @discardableResult
    func primeHiddenReturnPose() -> Bool {
        guard !active, !transition, modal == nil, !preparationHasMissingResources else { return false }
        cancelHiddenReturnPose()
        isHidden = true; isUserInteractionEnabled = false; scrollView.isScrollEnabled = false
        let reduced = UIAccessibility.isReduceMotionEnabled
        CATransaction.begin(); CATransaction.setDisableActions(true)
        for target in motionTargets().flatMap({[$0] + (depthPlanes[$0.tag] ?? [])}) {
            let pose = CATransform3DConcat(target.layer.transform,
                CATransform3DConcat(CATransform3DMakeTranslation(0, reduced ? 8 : 30, 0),
                    CATransform3DMakeScale(reduced ? 0.96 : 0.65, reduced ? 0.96 : 0.65, 1)))
            let transform = CABasicAnimation(keyPath: "transform")
            transform.fromValue = NSValue(caTransform3D: pose); transform.toValue = transform.fromValue
            let opacity = CABasicAnimation(keyPath: "opacity")
            opacity.fromValue = 0; opacity.toValue = 0
            let frozen = CAAnimationGroup(); frozen.animations = [transform, opacity]
            frozen.duration = 1; frozen.speed = 0; frozen.fillMode = .both; frozen.isRemovedOnCompletion = false
            target.layer.add(frozen, forKey: "world.return.prime"); returnPrimeLayers.append(target.layer)
        }
        CATransaction.commit()
        return true
    }
    func cancelHiddenReturnPose() {
        returnPrimeLayers.forEach { $0.removeAnimation(forKey: "world.return.prime") }
        returnPrimeLayers.removeAll()
    }

    private var pendingReturnAlert:Int?
    private func revealReturnAlert(){
        guard let id=pendingReturnAlert else{return};pendingReturnAlert=nil
        units[id]?.subviews.flatMap{$0.subviews}.compactMap{$0 as? JimiNativeNewRibbonView}.forEach{$0.setForeground(true);$0.enter(replay:true)}
    }
    func enter(terminal: Bool = false, completion: @escaping () -> Void) {
        pendingReturnAlert=terminal && !UIAccessibility.isReduceMotionEnabled ? snapshot.returnBoardID:nil
        verticalIdleEpoch = CACurrentMediaTime()
        generation += 1; let token = generation; transition = true; admitted = false; active = true; backRequested = false; isUserInteractionEnabled = true
        animationReceipts.removeAll();depthPlanes.values.flatMap {$0}.forEach {$0.layer.removeAnimation(forKey:"world.exit")}
        layoutIfNeeded(); updateResources(); main.subviews.forEach {$0.layer.removeAnimation(forKey:"world.exit")}; units.values.forEach {$0.layer.removeAnimation(forKey:"world.exit");$0.subviews.forEach {$0.layer.removeAnimation(forKey:"card.tap.exit")}}; alpha = 1; scrollView.isScrollEnabled = false
        let visible = motionTargets(); let reduced = UIAccessibility.isReduceMotionEnabled
        let lead = terminal || reduced ? 0.0 : 0.08
        let ids = [snapshot.worldID == 1 ? "forest-main" : snapshot.worldID == 2 ? "beach-main" : "robo-main"] + snapshot.units.map { $0.id }
        var offsets = JimiNativeWorldMotion.enterOffsets(ids:ids,reduced:reduced)
        for (index,unit) in snapshot.units.enumerated() {if let explicit = unit.enterDelayOffset {offsets[index+1] = explicit}}
        CATransaction.begin(); cancelHiddenReturnPose(); CATransaction.setCompletionBlock { [weak self] in
            guard let self, self.generation == token else { return }
            self.transition = false; self.updateResources(); if terminal {self.presentReturnReminder();if self.reminder==nil {self.revealReturnAlert()}}; completion()
        }
        for target in visible {
            let unitIndex = snapshot.units.firstIndex { units[$0.boardID] === target }.map { $0+1 } ?? 0
            target.subviews.flatMap{$0.subviews}.compactMap{$0 as? JimiNativeNewRibbonView}.forEach{if target.tag==pendingReturnAlert {$0.deferUntilReturn()}else{$0.setForeground(true);$0.enter(delay:lead+offsets[unitIndex],replay:true)}}
            animate(target, track: .init(tweens: [.init(begin: lead + offsets[unitIndex], duration: reduced ? 0.20 : 0.56,
                from: .scale(reduced ? 0.96 : 0.65,y:reduced ? 8 : 30,opacity:0), to: .scale(1), ease:reduced ? .powerOut(1) : .backOut(1.8))]), key:"world.enter")
        }
        CATransaction.commit()
        if !reduced, let art = main.subviews.filter({$0.accessibilityIdentifier?.hasSuffix(".cloud") != true}).max(by: {$0.bounds.width*$0.bounds.height < $1.bounds.width*$1.bounds.height}) {
            startWave(art,axis:"y",index:0,delay:lead+0.56)
        }
    }
    func finishPresentationAdmission() { guard active,!transition,!backRequested else {return}; admitted = true;updateIdle(); isUserInteractionEnabled = true; scrollView.isScrollEnabled = true }
    func exit(completion: @escaping () -> Void) {
        pendingCardLanding=nil
        landingBarrier?.cancel();landingBarrier = nil
        units.values.forEach {$0.subviews.forEach {$0.layer.removeAnimation(forKey:"world.card.landing")};$0.layer.sublayers?.filter {$0.name == "world.smoke.feedback"}.forEach {$0.sublayers?.forEach {$0.removeAllAnimations()};$0.removeAllAnimations();$0.removeFromSuperlayer()}}
        cancelReminder()
        generation += 1; let token = generation; transition = true; admitted = false; animationReceipts.removeAll(); stopIdle(pauseBees:false); bees?.exit(); isUserInteractionEnabled = true; scrollView.isScrollEnabled = false
        CATransaction.begin(); CATransaction.setCompletionBlock { [weak self] in
            guard let self, self.generation == token else { return }; self.active = false; self.transition = false; completion()
        }
        let reduced = UIAccessibility.isReduceMotionEnabled
        let liveUnits = motionTargets().filter {$0 !== header}
        // Canonical WorldBack moves the main group last before reversing, so its longer exit starts first.
        let exitOrder = [main].filter {liveUnits.contains($0)} + liveUnits.reversed().filter {$0 !== main}
        let stagger = liveUnits.count > 1 ? min(0.03,(reduced ? 0.06 : 0.13)/Double(liveUnits.count-1)) : 0
        animate(header,track:JimiV9Motion.journeyNavigationExit(reducedMotion:reduced),key:"world.exit")
        for (index,target) in exitOrder.enumerated() {
            let delay = Double(index)*stagger
            target.subviews.flatMap{$0.subviews}.compactMap{$0 as? JimiNativeNewRibbonView}.forEach{$0.exit(remove:false,delay:delay)}
            let gentle = JimiV9Motion.Track(tweens:[.init(begin:delay,duration:reduced ? 0.16 : 0.48,from:.scale(1),to:.scale(reduced ? 0.96 : 0.65,y:reduced ? 8 : 28,opacity:0),ease:reduced ? .powerIn(1) : .backIn(1.25))])
            if target === main, main.layer.animation(forKey:"world.enter") != nil {
                let interruptedMain = JimiV9Motion.Track(tweens:[.init(begin:delay,duration:0.234,from:.scale(1),to:.init(scaleX:1.18,scaleY:1.15),ease:.powerIn(2)),.init(begin:delay+0.234,duration:0.4368,from:.init(scaleX:1.18,scaleY:1.15),to:.scale(0,y:28),ease:.backIn(1.7))],anchorY:0.54)
                animate(main,track:reduced ? gentle : interruptedMain,key:"world.exit")
            } else if target === main {
                let largest = main.subviews.filter {$0.accessibilityIdentifier?.hasSuffix(".cloud") != true}.max {$0.bounds.width*$0.bounds.height < $1.bounds.width*$1.bounds.height}
                for child in main.subviews {
                    let mainTrack = JimiV9Motion.Track(tweens:[.init(begin:delay,duration:0.234,from:.scale(1),to:.init(scaleX:1.18,scaleY:1.15),ease:.powerIn(2)),.init(begin:delay+0.234,duration:0.4368,from:.init(scaleX:1.18,scaleY:1.15),to:.scale(0,y:28),ease:.backIn(1.7))],anchorY:0.54)
                    animate(child,track:!reduced && child === largest ? mainTrack : gentle,key:"world.exit")
                }
            } else {
                animate(target,track:gentle,key:"world.exit")
                if !reduced,let card = target.subviews.first(where:{$0.accessibilityIdentifier?.hasSuffix(".card") == true}),card.layer.animation(forKey:"card.tap.exit") == nil {
                    animate(card,track:.init(tweens:[.init(begin:delay,duration:0.40,from:.scale(1),to:.scale(0),ease:.backIn(1.7))]),key:"card.tap.exit")
                }
            }
        }
        CATransaction.commit()
    }
    private func partViews(_ view:UIView)->[UIView] {view.subviews + (depthPlanes[view.tag] ?? []).flatMap {$0.subviews}}
    private func visualBounds(_ view:UIView) -> CGRect {
        var rect = view.bounds
        for child in partViews(view) {rect = rect.union(child.frame)}
        return rect.offsetBy(dx:view.frame.minX,dy:view.frame.minY)
    }
    private func motionTargets() -> [UIView] {
        let viewport = CGRect(origin: scrollView.contentOffset,size:scrollView.bounds.size).insetBy(dx:0,dy:-220)
        return [main,header] + snapshot.units.compactMap { units[$0.boardID] }.filter { viewport.intersects(visualBounds($0)) }
    }
    private func animate(_ view:UIView,track originalTrack:JimiV9Motion.Track,key:String) {
        var track = originalTrack
        if key == "world.exit", view.layer.animation(forKey:"world.enter") != nil {
            let painted = view.layer.presentation()
            let incoming = view.layer.animation(forKey:"world.enter") as? CAAnimationGroup
            let initialTransform = (incoming?.animations?.first {($0 as? CAKeyframeAnimation)?.keyPath == "transform"} as? CAKeyframeAnimation)?.values?.first as? NSValue
            let initialOpacity = (incoming?.animations?.first {($0 as? CAKeyframeAnimation)?.keyPath == "opacity"} as? CAKeyframeAnimation)?.values?.first as? NSNumber
            let paintedTransform = painted?.transform ?? initialTransform?.caTransform3DValue ?? view.layer.transform
            let relative = CATransform3DConcat(CATransform3DInvert(view.layer.transform),paintedTransform)
            let dx = (track.anchorX-view.layer.anchorPoint.x)*view.bounds.width
            let dy = (track.anchorY-view.layer.anchorPoint.y)*view.bounds.height
            let alpha = Double(painted?.opacity ?? initialOpacity?.floatValue ?? view.layer.opacity)
            let pose = JimiV9Motion.Pose(scaleX:relative.m11,scaleY:relative.m22,
                x:relative.m41+dx*(relative.m11-1),y:relative.m42+dy*(relative.m22-1),opacity:alpha)
            track = .init(tweens:track.tweens.enumerated().map { index,tween in
                var end = tween.to; end.opacity = min(end.opacity,alpha)
                var start = tween.from; start.opacity = min(start.opacity,alpha)
                return .init(begin:tween.begin,duration:tween.duration,from:index == 0 ? pose : start,to:end,ease:tween.ease)
            },anchorX:track.anchorX,anchorY:track.anchorY)
            view.layer.removeAnimation(forKey:"world.enter")
        }
        let oldAnchor = view.layer.anchorPoint,newAnchor = CGPoint(x:track.anchorX,y:track.anchorY)
        if oldAnchor != newAnchor {
            let oldPoint = CGPoint(x:oldAnchor.x*view.bounds.width,y:oldAnchor.y*view.bounds.height).applying(view.transform)
            let newPoint = CGPoint(x:newAnchor.x*view.bounds.width,y:newAnchor.y*view.bounds.height).applying(view.transform)
            view.layer.position = CGPoint(x:view.layer.position.x+newPoint.x-oldPoint.x,y:view.layer.position.y+newPoint.y-oldPoint.y);view.layer.anchorPoint = newAnchor
        }
        let delay = track.tweens.first?.begin ?? 0
        let shifted = JimiV9Motion.Track(tweens:track.tweens.map { .init(begin:$0.begin-delay,duration:$0.duration,from:$0.from,to:$0.to,ease:$0.ease) },anchorX:track.anchorX,anchorY:track.anchorY)
        let baseTransform = view.layer.transform
        let sampled = JimiV9Motion.sampledTrack(shifted)
        let animation = CAKeyframeAnimation(keyPath:"transform")
        let interimContact=key=="card.tap.exit" && snapshot.units.contains{$0.interim && units[$0.boardID] === view.superview}
        animation.values = sampled.poses.enumerated().map { index,pose in
            let seconds=sampled.duration*Double(index)/Double(max(1,sampled.poses.count-1))
            let bounce=interimContact ? NativeHUDTapMotion.pose(at:seconds):NativeHUDTapMotion.Pose(x:1,y:1,offset:0)
            return NSValue(caTransform3D:CATransform3DConcat(baseTransform,CATransform3DConcat(
                CATransform3DMakeTranslation(pose.x,pose.y+bounce.offset,0),
                CATransform3DMakeScale(pose.scaleX*bounce.x,pose.scaleY*bounce.y,1))))
        }
        animation.duration = sampled.duration; animation.fillMode = .both; animation.isRemovedOnCompletion = false
        let opacity = CAKeyframeAnimation(keyPath:"opacity"); opacity.values = sampled.poses.map {$0.opacity}; opacity.duration = sampled.duration; opacity.fillMode = .both; opacity.isRemovedOnCompletion = false
        let group = CAAnimationGroup(); group.animations = [animation,opacity]; group.duration = sampled.duration; group.fillMode = .both; group.isRemovedOnCompletion = false
        group.beginTime = CACurrentMediaTime()+delay
        let token = generation
        if view !== header && (view === main || units.values.contains(where:{$0 === view}) || (view.superview === main && view.accessibilityIdentifier?.hasSuffix(".cloud") != true)) {
            let boardID:Int? = view.tag > 0 ? view.tag : nil
            let receipt = JimiWorldAnimationStart { [weak self] in
                guard let self,self.generation == token,self.active else {return}
                self.onFeedback?(key == "world.enter" ? "world-enter" : "world-exit",boardID,shifted.duration)
                if key == "world.enter",boardID == nil {self.onFeedback?("ambience",nil,nil)}
            }
            animationReceipts.append(receipt);group.delegate = receipt
        }
        view.layer.add(group,forKey:key)
        if let peers = depthPlanes[view.tag],units[view.tag] === view {for peer in peers {animate(peer,track:track,key:key)}}
    }
    private func startWave(_ view: UIView, axis: String, index: Int, cloud: Int? = nil, delay: Double = 0) {
        let key = "world.idle.\(axis)"
        guard view.layer.animation(forKey:key) == nil, !UIAccessibility.isReduceMotionEnabled else {return}
        // Main artwork and the first two complete Units share one clock. Their
        // opposite signs stay coherent after staggered entry or viewport reentry.
        let pairedVertical = axis == "y" && cloud == nil && index <= 2 && view.accessibilityIdentifier?.hasSuffix(".cloud") != true
        let duration = pairedVertical ? 3.15 : 3.15 + Double(index % 3)*0.28
        let speed = 2*Double.pi/duration * (cloud == nil ? 1 : 0.62)
        let begin = CACurrentMediaTime()+delay
        let phase = pairedVertical ? (begin-verticalIdleEpoch)*speed : Double(index)*0.47 + Double(cloud ?? 0)
        let amplitude = (cloud == nil ? 7.0 : 10.0)*Double(scale)*(pairedVertical && index == 0 ? -1 : 1)
        let keyPath = "transform.translation.\(axis)"
        let current = (view.layer.presentation()?.value(forKeyPath:keyPath) as? NSNumber)?.doubleValue ?? 0
        let onsetDuration = abs(current) > 0.0001 ? 0.52 : 0.18
        let ramp = CAKeyframeAnimation(keyPath:keyPath)
        ramp.values = (0...32).map { step -> Double in
            let t = Double(step)/32, envelope = t*t*(3-2*t)
            return current*(1-envelope)+sin(onsetDuration*t*speed+phase)*amplitude*envelope
        }
        ramp.duration = onsetDuration; ramp.beginTime = begin
        ramp.fillMode = .forwards; ramp.isRemovedOnCompletion = false
        let loop = CAKeyframeAnimation(keyPath:keyPath)
        let period = 2*Double.pi/speed
        let samples = Int(ceil(period*30))
        loop.values = (0...samples).map { sin((onsetDuration+Double($0)*period/Double(samples))*speed+phase)*amplitude }
        loop.duration = period; loop.beginTime = begin+onsetDuration
        loop.repeatCount = .infinity; loop.fillMode = .forwards
        view.layer.add(ramp,forKey:key+".onset"); view.layer.add(loop,forKey:key)
        if let peers = depthPlanes[view.tag],units[view.tag] === view {for peer in peers {peer.layer.add(ramp,forKey:key+".onset");peer.layer.add(loop,forKey:key)}}
    }
    private func updateIdle() {
        backpackAlert.setActive(!backpackAlert.isHidden && active && admitted && !transition && modal == nil)
        ambient?.update(enabled:active && admitted && !transition && modal == nil,viewport:CGRect(origin:scrollView.contentOffset,size:scrollView.bounds.size),scale:scale,shipViewport:CGRect(x:scrollView.contentOffset.x,y:scrollView.contentOffset.y+header.frame.maxY,width:scrollView.bounds.width,height:max(0,scrollView.bounds.height-header.frame.maxY)))
        bees?.update(enabled:active && !transition && modal == nil,viewport:CGRect(origin:scrollView.contentOffset,size:scrollView.bounds.size),scale:scale)
        guard active && !transition && modal == nil else {
            if pausedCardWaves.isEmpty {stopIdle()}
            return
        }
        let viewport = CGRect(origin:scrollView.contentOffset,size:scrollView.bounds.size)
        for (index,definition) in snapshot.units.enumerated() {
            guard let unit = units[definition.boardID] else {continue}
            ([unit] + (depthPlanes[definition.boardID] ?? [])).forEach {$0.layer.removeAnimation(forKey:"world.enter");$0.layer.removeAnimation(forKey:"world.exit")}
            if !viewport.intersects(visualBounds(unit)) {unit.subviews.flatMap{$0.subviews}.compactMap{$0 as? JimiNativeNewRibbonView}.forEach{$0.setForeground(false)}}
            if viewport.intersects(visualBounds(unit)),loaded.contains(definition.boardID) {
                unit.subviews.flatMap{$0.subviews}.compactMap{$0 as? JimiNativeNewRibbonView}.forEach{if definition.boardID != pendingReturnAlert {$0.setForeground(true);$0.enter()}}
                startWave(unit,axis:"y",index:index+1)
                if definition.interim, let card = unit.subviews.first(where: {$0.accessibilityIdentifier?.hasSuffix(".card") == true}) {
                    if interimOwners[definition.boardID] == nil {interimOwners[definition.boardID] = JimiNativeInterimEffect(card:card,scale:scale)}
                    interimOwners[definition.boardID]?.start()
                }
                for child in partViews(unit) where child.accessibilityIdentifier?.hasSuffix(".beam") == true {
                    if let part = definition.parts.first(where:{$0.role == "beam"}), let idle = part.beamIdle {startBeam(child,idle:idle)}
                }
                for (cloud,child) in partViews(unit).filter({$0.accessibilityIdentifier?.hasSuffix(".cloud") == true}).enumerated() {startWave(child,axis:"x",index:index+1,cloud:cloud)}
            } else {interimOwners[definition.boardID]?.stop();stopWave(unit); JimiNativeWorldEffects.stop(unit); partViews(unit).forEach {stopWave($0);JimiNativeWorldEffects.stop($0)}}
        }
        main.layer.removeAnimation(forKey:"world.enter"); header.layer.removeAnimation(forKey:"world.enter")
        if viewport.intersects(main.frame) {
            for (index,child) in main.subviews.enumerated() {
                startWave(child,axis:"y",index:child.accessibilityIdentifier?.hasSuffix(".cloud") == true ? 1 : 0)
                if child.accessibilityIdentifier?.hasSuffix(".cloud") == true {startWave(child,axis:"x",index:1,cloud:index)}
            }
        } else {main.subviews.forEach(stopWave)}
        syncReminderWave()
    }
    /// Reuse the exact Unit compositor clock on a separate carrier. The card's
    /// authored flight owns its child transform; neither owner overwrites it.
    private func syncReminderWave() {
        guard let carrier = reminderCarrier,let unit = reminderSource?.superview else {return}
        for key in ["world.idle.y.onset","world.idle.y"] {
            if let animation = unit.layer.animation(forKey:key) {
                if carrier.layer.animation(forKey:key) == nil {carrier.layer.add(animation,forKey:key)}
            } else {carrier.layer.removeAnimation(forKey:key)}
        }
    }
    private func startBeam(_ view:UIView,idle:JimiNativeWorldSnapshot.BeamIdle) {
        guard view.layer.animation(forKey:"world.idle.beam") == nil,!UIAccessibility.isReduceMotionEnabled else {return}
        let animation = CAKeyframeAnimation(keyPath:"opacity")
        animation.values = idle.opacities
        animation.keyTimes = idle.times.map {NSNumber(value:$0/idle.duration)}
        animation.timingFunctions = (1..<idle.times.count).map {_ in CAMediaTimingFunction(name:.easeInEaseOut)}
        animation.duration = idle.duration;animation.timeOffset = idle.phase;animation.repeatCount = .infinity
        animation.beginTime = view.layer.convertTime(CACurrentMediaTime(),from:nil)
        view.layer.add(animation,forKey:"world.idle.beam")
    }
    private func stopWave(_ view:UIView) {
        if let peers = depthPlanes[view.tag],units[view.tag] === view {peers.forEach {stopWave($0)}}
        view.layer.removeAnimation(forKey:"world.idle.beam")
        for axis in ["x","y"] {view.layer.removeAnimation(forKey:"world.idle.\(axis)"); view.layer.removeAnimation(forKey:"world.idle.\(axis).onset")}
    }
    /// Keep the compositor phase and painted pose while the card owns presentation.
    /// Restore the same animations with shifted clocks, rather than a new onset.
    private func pauseCardWaves() {
        guard pausedCardWaves.isEmpty else {return}
        verticalIdlePausedAt = CACurrentMediaTime()
        let views = Array(units.values).map {$0 as UIView} + depthPlanes.values.flatMap {$0} + units.values.flatMap {partViews($0)} + main.subviews
        var seen=Set<ObjectIdentifier>()
        for view in views where seen.insert(ObjectIdentifier(view.layer)).inserted {
            let layer=view.layer,now=layer.convertTime(CACurrentMediaTime(),from:nil)
            for key in layer.animationKeys() ?? [] where key.hasPrefix("world.idle.") {
                guard let installed=layer.animation(forKey:key),let original=installed.copy() as? CAAnimation,let frozen=installed.copy() as? CAAnimation else {continue}
                pausedCardWaves.append((layer,key,original,now))
                // A future loop must not override its still-running onset while paused.
                guard now >= original.beginTime else {layer.removeAnimation(forKey:key);continue}
                frozen.speed=0;frozen.timeOffset=now-original.beginTime+original.timeOffset
                frozen.beginTime=0
                layer.add(frozen,forKey:key)
            }
        }
        ambient?.update(enabled:false,viewport:CGRect(origin:scrollView.contentOffset,size:scrollView.bounds.size),scale:scale)
        bees?.update(enabled:false,viewport:CGRect(origin:scrollView.contentOffset,size:scrollView.bounds.size),scale:scale)
        interimOwners.values.forEach {$0.stop()}
    }
    private func resumeCardWaves() {
        if let pausedAt = verticalIdlePausedAt {verticalIdleEpoch += CACurrentMediaTime()-pausedAt;verticalIdlePausedAt = nil}
        for (layer,key,animation,pausedAt) in pausedCardWaves {
            animation.beginTime += layer.convertTime(CACurrentMediaTime(),from:nil)-pausedAt
            layer.add(animation,forKey:key)
        }
        pausedCardWaves.removeAll()
    }
    private func discardCardWaves() {
        verticalIdlePausedAt = nil
        for (layer,key,_,_) in pausedCardWaves {layer.removeAnimation(forKey:key)}
        pausedCardWaves.removeAll()
    }
    private func stopIdle(pauseBees:Bool = true) {
        units.values.flatMap{$0.subviews}.flatMap{$0.subviews}.compactMap{$0 as? JimiNativeNewRibbonView}.forEach{$0.setForeground(false)}
        if pauseBees {units.values.forEach{$0.subviews.forEach{$0.layer.removeAnimation(forKey:NativeHubBackpackFeedback.animationKey)}}}
        backpackAlert.setActive(false)
        discardCardWaves()
        ambient?.update(enabled:false,viewport:CGRect(origin:scrollView.contentOffset,size:scrollView.bounds.size),scale:scale)
        if pauseBees {bees?.update(enabled:false,viewport:CGRect(origin:scrollView.contentOffset,size:scrollView.bounds.size),scale:scale)};interimOwners.values.forEach {$0.stop()};units.values.forEach {stopWave($0);JimiNativeWorldEffects.stop($0); partViews($0).forEach {stopWave($0);JimiNativeWorldEffects.stop($0)}}; main.subviews.forEach(stopWave)}
    private func quiesceRibbons(){units.values.flatMap{$0.subviews}.flatMap{$0.subviews}.compactMap{$0 as? JimiNativeNewRibbonView}.forEach{$0.quiesce()}}
    func setActive(_ value: Bool) { if !value {backpackAlert.setActive(false);backpackButton.imageView?.layer.removeAnimation(forKey:NativeHubBackpackFeedback.animationKey);quiesceRibbons();landingBarrier?.cancel();landingBarrier = nil;units.values.forEach {$0.subviews.forEach {$0.layer.removeAnimation(forKey:"world.card.landing")}}};active = value; modal?.setActive(value); if value {if modal == nil {resumeCardWaves()};if landingBarrier == nil {pendingCardLanding?()};updateIdle()} else {cancelReminder();if modal == nil && pausedCardWaves.isEmpty {stopIdle()};units.values.forEach {$0.layer.sublayers?.filter {$0.name == "world.smoke.feedback"}.forEach {$0.removeAllAnimations();$0.removeFromSuperlayer()}}} }
    func prepareGameplayExit(boardID:Int? = nil,completion: @escaping () -> Void) {
        let sourceID = boardID ?? modal?.boardID
        let regularModal = modal != nil
        closeCard(gameplay:regularModal) { [weak self] in
            guard let self else {return}
            guard let id = sourceID,let unit = self.units[id],let card = unit.subviews.first(where:{$0.accessibilityIdentifier?.hasSuffix(".card") == true}) else {self.exit(completion:completion);return}
            self.stopIdle();self.admitted = false
            let token = self.generation
            CATransaction.begin()
            if regularModal {
                CATransaction.setCompletionBlock { [weak self,weak card,weak unit] in
                    guard let self,let card,let unit,self.generation == token else {return}
                    self.animate(card,track:.init(tweens:[.init(begin:0,duration:0.400/0.98,from:.scale(1.14),to:.scale(0),ease:.backIn(1.7))]),key:"card.tap.exit")
                    JimiNativeWorldEffects.smoke(at:card.frame,in:unit,scale:self.scale)
                    // Card collapse and the surrounding World exit have distinct
                    // targets and share the authoritative final completion.
                    self.exit(completion:completion)
                }
                self.animate(card,track:.init(tweens:[.init(begin:0,duration:0.120/0.98,from:.scale(1),to:.scale(1.14),ease:.backOut(2.4))]),key:"card.tap.exit")
            } else {
                CATransaction.setCompletionBlock { [weak self] in guard let self,self.generation == token else {return};self.exit(completion:completion) }
                self.animate(card,track:.init(tweens:[.init(begin:0,duration:0.10,from:.scale(1),to:.scale(1.12),ease:.backOut(2.4)),.init(begin:0.10,duration:0.40,from:.scale(1.12),to:.scale(0),ease:.backIn(1.7))]),key:"card.tap.exit")
                JimiNativeWorldEffects.smoke(at:card.frame,in:unit,scale:self.scale)
            }
            CATransaction.commit()
        }
    }
    func memoryWarning() {
        guard !transition else {return}
        let viewport = CGRect(origin:scrollView.contentOffset,size:scrollView.bounds.size).insetBy(dx:0,dy:-220*scale)
        for (id,view) in units where !viewport.intersects(view.frame) && modal?.boardID != id && snapshot.returnBoardID != id {
            interimOwners.removeValue(forKey:id)?.stop();depthPlanes[id]?.forEach {$0.layer.removeAllAnimations()};partViews(view).forEach {$0.layer.removeAllAnimations();$0.removeFromSuperview()};resources.release(id);loaded.remove(id)
        }
        if !viewport.intersects(main.frame) {main.subviews.forEach {$0.layer.removeAllAnimations();$0.removeFromSuperview()};resources.release(0);loaded.remove(0)}
    }
    func park() { pendingCardLanding=nil;stopIdle();cancelHiddenReturnPose();depthPlanes.values.flatMap {$0}.forEach {$0.layer.removeAllAnimations()}; generation += 1; transition = false; admitted = false; backRequested = false; cancelReminder(); units.values.forEach {$0.layer.removeAnimation(forKey:"world.enter");$0.layer.removeAnimation(forKey:"world.exit");$0.subviews.forEach {$0.layer.removeAnimation(forKey:"card.tap.exit");$0.layer.removeAnimation(forKey:"world.exit")}}; main.subviews.forEach {$0.layer.removeAnimation(forKey:"world.exit")};main.layer.removeAllAnimations();header.layer.removeAllAnimations();backButton.layer.removeAllAnimations(); restoreSourceCard(); setActive(false); isUserInteractionEnabled = false; modal?.cleanup(); modal?.removeFromSuperview(); modal = nil }
    func cleanup() {pendingCardLanding=nil;discardCardWaves();quiesceRibbons();cancelHiddenReturnPose();ambient?.cleanup();ambient = nil;onAmbientPlansRequest = nil;onShipVisibility=nil;depthPlanes.values.flatMap {$0}.forEach {$0.layer.removeAllAnimations();$0.removeFromSuperview()};depthPlanes.removeAll();bees?.cleanup();bees = nil;onBeePlansRequest = nil; landingBarrier?.cancel();landingBarrier = nil;interimOwners.values.forEach {$0.stop()};interimOwners.removeAll();cancelReminder(); resourceEpoch += 1; preparing.removeAll(); generation += 1; active = false; transition = false; backRequested = false; modal?.cleanup(); modal?.removeFromSuperview(); modal = nil; stopIdle(); layer.removeAllAnimations(); units.values.forEach {$0.layer.removeAllAnimations()}; main.layer.removeAllAnimations(); header.layer.removeAllAnimations(); main.subviews.forEach { $0.removeFromSuperview() }; units.values.forEach { $0.subviews.forEach { $0.layer.removeAllAnimations();$0.removeFromSuperview() } }; resources.cleanup(); loaded.removeAll() }
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard !isHidden, isUserInteractionEnabled, alpha > 0.01 else { return nil }
        if active, modal == nil, navigationTarget.frame.contains(point), backButton.isEnabled { return navigationTarget }
        return super.hitTest(point,with:event)
    }
    @objc private func back() {
        guard active, !backRequested else { return }
        backRequested = true
        NativeHubBackpackFeedback.play(on:backArtwork)
        onFeedback?("back",nil,nil); onRequest?("back",nil)
    }
    @objc private func openBackpack() {
        guard active,admitted,!transition,!backRequested,modal == nil else{return}
        NativeHubBackpackFeedback.play(on:backpackButton.imageView ?? backpackButton)
        onRequest?("backpack",nil)
    }
    func rejectBackRequest() { backRequested = false }

    @objc private func card(_ sender:UIButton) { guard active,admitted,!transition,modal == nil,!scrollView.isDragging,!scrollView.isDecelerating, let unit = snapshot.units.first(where:{$0.boardID == sender.tag}),!unit.locked else { return }; onFeedback?("card-tap",sender.tag,nil); onRequest?(unit.interim ? "continue" : "openCard",sender.tag) }
    func openCard(boardID:Int,presentationHasNewRibbon:Bool? = nil) {
        cancelReminder()
        guard modal == nil,let unit = snapshot.units.first(where:{$0.boardID == boardID}), let source = units[boardID] else { return }
        let sourceCard = source.subviews.first { $0.accessibilityIdentifier?.hasSuffix(".card") == true }
        let origin = paintedCardRect(sourceCard,in:source)
        pauseCardWaves()
        let card = JimiNativeWorldCardView(unit:unit,assets:artwork,resources:resources,worldTitle:snapshot.title,presentationHasNewRibbon:presentationHasNewRibbon ?? unit.newRibbon)
        modal = card; card.frame = bounds; addSubview(card)
        card.onFeedback = { [weak self] kind in self?.onFeedback?(kind,boardID,nil) }
        card.onRequest = { [weak self] action in self?.onRequest?(action,boardID) }
        card.onPrepareGameplayAssets = {[weak self,weak card] in
            guard let self,let card,self.active,self.modal === card,!self.transition else{return}
            self.releaseGameplayTransitionPreparation()
            let paths=NativeThemedBoardTransitionController.assets(theme:.init(board:boardID))+["./assets/paper-bg.png"]
            self.resources.prepare(paths,owner:Self.gameplayPreparationOwner,required:true){_ in}
        }
        sourceCard?.isHidden = true
        card.enter(from:origin)
    }
    private func cancelReminder() {pendingReturnAlert=nil;reminder?.cleanup();reminder = nil;reminderCarrier?.layer.removeAllAnimations();reminderCarrier?.removeFromSuperview();reminderCarrier = nil;reminderSource?.isHidden = false;reminderSource = nil}
    private func presentReturnReminder() {
        let pending=pendingReturnAlert;cancelReminder();pendingReturnAlert=pending
        guard !UIAccessibility.isReduceMotionEnabled,let boardID = snapshot.returnBoardID,let unit = units[boardID],let card = unit.subviews.first(where:{$0.accessibilityIdentifier?.hasSuffix(".card") == true}) as? UIImageView,let image = card.image,
              let backImage = resources.image("assets/colelctibles/cardflip.png",owner:boardID) else {return}
        let viewport = CGRect(origin:scrollView.contentOffset,size:scrollView.bounds.size)
        guard viewport.intersects(unit.frame) else {return}
        card.isHidden = true;reminderSource = card
        let localOrigin = CGRect(x:card.center.x-card.bounds.width/2,y:card.center.y-card.bounds.height/2,width:card.bounds.width,height:card.bounds.height)
        let origin = unit.convert(localOrigin,to:content)
        let carrier = UIView(frame:origin)
        carrier.isUserInteractionEnabled = false
        let effect = JimiNativeWorldReminder(card:image,backImage:backImage,frame:carrier.bounds)
        // A travelling card must clear every Unit's terrain/cards, including
        // adjacent Units. Keep it in the same scrolling coordinate space.
        carrier.layer.zPosition = 9
        carrier.accessibilityIdentifier = "native.world.return-reminder-carrier"
        effect.accessibilityIdentifier = "native.world.return-reminder"
        reminder = effect;reminderCarrier = carrier;content.addSubview(carrier);carrier.addSubview(effect)
        syncReminderWave()
        let fullWidth = bounds.height <= 700 ? min(bounds.width-82,330) : min(bounds.width-64,390)
        let center = content.convert(CGPoint(x:bounds.midX,y:bounds.midY),from:self)
        let apexWidth = card.bounds.width+(fullWidth-card.bounds.width)*0.3
        let apexHeight = apexWidth*card.bounds.height/max(1,card.bounds.width)
        let apex = CGRect(x:origin.midX+(center.x-origin.midX)*0.3-apexWidth/2,y:origin.midY+(center.y-origin.midY)*0.3-apexHeight/2,width:apexWidth,height:apexHeight)
        onFeedback?("card-entry-flip",boardID,nil)
        effect.play(apex:apex.offsetBy(dx:-origin.minX,dy:-origin.minY),rotation:snapshot.units.first(where:{$0.boardID == boardID})?.parts.first(where:{$0.role == "card"})?.rotation ?? 0) { [weak self,weak effect] in
            guard let self,self.reminder === effect else {return};let pending=self.pendingReturnAlert;self.cancelReminder();self.pendingReturnAlert=pending;self.revealReturnAlert();JimiNativeWorldEffects.smoke(at:card.frame,in:unit,scale:self.scale);self.updateIdle()
        }
    }
    /// CSS parity evidence from the actual laid-out UIKit owners.
    func headerGeometrySnapshot() -> [String:CGRect] {
        ["header":header.frame,"title":title.frame,"backTarget":backButton.frame,"backArtwork":backArtwork.convert(backArtwork.bounds,to:header)]
    }
    /// Read-only boundary evidence for UIKit regression tests/opt-in diagnostics.
    /// Never sampled by the idle or animation owners.
    func unitGeometrySnapshot(boardID:Int) -> [String:CGFloat]? {
        guard let unit = units[boardID],let card = unit.subviews.first(where:{$0.accessibilityIdentifier?.hasSuffix(".card") == true}) else {return nil}
        let painted = paintedCardRect(card,in:unit)
        return ["unitX":unit.frame.minX,"unitY":unit.frame.minY,"cardX":card.frame.minX,"cardY":card.frame.minY,"cardWidth":card.bounds.width,"cardHeight":card.bounds.height,"paintedX":painted.minX,"paintedY":painted.minY,"anchorX":card.layer.anchorPoint.x,"anchorY":card.layer.anchorPoint.y,"modelTranslateX":card.layer.transform.m41,"modelTranslateY":card.layer.transform.m42]
    }
    private func paintedCardRect(_ card:UIView?,in unit:UIView) -> CGRect {
        guard let card else {return unit.convert(unit.bounds,to:self)}
        let unitPose = unit.layer.presentation()?.transform ?? unit.layer.transform
        let cardPose = card.layer.presentation()?.transform ?? card.layer.transform
        let center = unit.convert(card.center,to:self)
        let width = card.bounds.width*hypot(cardPose.m11,cardPose.m12),height = card.bounds.height*hypot(cardPose.m21,cardPose.m22)
        return CGRect(x:center.x+unitPose.m41+cardPose.m41-width/2,y:center.y+unitPose.m42+cardPose.m42-height/2,width:width,height:height)
    }
    private func restoreSourceCard() { guard let modal else { return }; units[modal.boardID]?.subviews.forEach { $0.isHidden = false } }
    func closeCard(gameplay:Bool = false,completion:@escaping () -> Void = {}) {
        if !gameplay {releaseGameplayTransitionPreparation()}
        guard let modal,let source = units[modal.boardID] else { completion(); return }
        let sourceCard = source.subviews.first { $0.accessibilityIdentifier?.hasSuffix(".card") == true }
        let destination = paintedCardRect(sourceCard,in:source)
        let token = generation
        modal.close(to:destination,gameplay:gameplay) { [weak self,weak modal,weak sourceCard,weak source] in
            guard let self,self.generation == token else {return}
            modal?.cleanup();modal?.removeFromSuperview()
            if modal != nil {sourceCard?.subviews.filter {$0.accessibilityIdentifier == "native.world.ribbon"}.forEach {$0.removeFromSuperview()}}
            self.restoreSourceCard()
            let finish = { [weak self,weak modal] in guard let self,let modal,self.generation == token,self.modal === modal else {return};self.pendingCardLanding=nil;self.modal = nil;if self.active {self.resumeCardWaves();self.updateIdle()};completion() }
            guard !gameplay,let sourceCard,let source else {finish();return}
            self.pendingCardLanding = { [weak self,weak sourceCard,weak source] in
                guard let self,self.generation == token,self.active else {return}
                self.landingBarrier = JimiNativeWorldPaintBarrier { [weak self,weak sourceCard,weak source] in
                    guard let self,self.generation == token,self.active,let sourceCard,let source else {return}
                    self.landingBarrier = nil;self.pendingCardLanding=nil
                    JimiNativeWorldEffects.returnLanding(card:sourceCard,in:source,scale:self.scale,completion:finish)
                }
            }
            self.pendingCardLanding?()
        }
    }
}
