import UIKit

/// Read-only Arcade destination selection. Gameplay, saves, and scores belong
/// to the selected gameplay profile; Journey's Hub owns all island/cloud idle.
@MainActor
final class NativeArcadeHubView: UIView {
    let hub: JimiV9HubView
    var onClose: (() -> Void)?
    var onCrate: (() -> Void)?
    var onPlay: ((String) -> Void)?
    var onPlayExit: ((@escaping ()->Void)->Void)?
    var onFeedback:((String)->Void)?
    var canContinue:((String)->Bool)?
    private let assets: JimiV9Artwork
    private var modal: NativeArcadeWorldModal?
    private var active = false
    private var closeRequested = false
    private var crateRequested = false
    private var foreground = true
    private var pendingWorldTap:UUID?
    private var pendingPlayExit:UUID?
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
        hub.onBack = { [weak self] in
            guard let self,self.active,self.foreground,!self.closeRequested,!self.crateRequested else { return }
            self.closeRequested = true; self.onClose?()
        }
        hub.onBackpack = { [weak self] in
            guard let self,self.active,self.foreground,!self.closeRequested,!self.crateRequested,
                  self.modal == nil,self.pendingWorldTap == nil,let onCrate=self.onCrate else { return }
            self.crateRequested = true
            self.hub.backpackButton.playArtworkTapFeedback()
            self.hub.stopIdle()
            onCrate()
        }
        hub.onWorld = { [weak self] id in
            guard let self, self.active, self.foreground, !self.crateRequested, !self.closeRequested, self.modal == nil, self.pendingWorldTap == nil,
                  let index = self.hub.worldIDs.firstIndex(of: id) else { return }
            let token=UUID();self.pendingWorldTap=token
            self.onFeedback?("cta")
            self.hub.playWorldTap(id) { [weak self] in
                guard let self,self.pendingWorldTap == token else { return }
                self.pendingWorldTap=nil
                guard self.active,self.foreground,!self.closeRequested,!self.crateRequested,self.modal == nil else { return }
                self.open(index)
            }
        }
    }
    required init?(coder: NSCoder) { fatalError("Use init(frame:assets:)") }
    func present() {
        active = true; foreground = true; closeRequested = false; crateRequested = false; isHidden = false; hub.accessibilityElementsHidden = false; hub.resetIdlePose(); hub.resetScroll()
        hub.setContentInteractionEnabled(false)
    }
    func setContentInteractionEnabled(_ enabled: Bool) { hub.setContentInteractionEnabled(enabled) }
    func resume() {
        foreground = true
        guard active else { return }
        modal?.setForeground(true)
        if modal == nil { hub.startIdle() }
    }
    func suspend() { foreground = false; cancelWorldTap(); hub.stopIdle(); modal?.setForeground(false) }
    func hide() {
        active = false;pendingPlayExit=nil; cancelWorldTap(); hub.stopIdle(); modal?.dispose(); modal = nil; hub.accessibilityElementsHidden = false; isHidden = true
    }
    private func cancelWorldTap() { pendingWorldTap=nil;hub.cancelWorldTap() }
    override var isHidden: Bool { didSet { if isHidden { cancelWorldTap();hub.stopIdle();modal?.setForeground(false) } } }
    override func didMoveToWindow() { super.didMoveToWindow(); if window == nil { cancelWorldTap();hub.stopIdle();modal?.setForeground(false) } }

    private func open(_ index: Int) {
        hub.stopIdle(); hub.accessibilityElementsHidden = true
        let sheet = NativeArcadeWorldModal(frame: bounds, assets: assets, index: index,continuing:canContinue?(identifiers[index]) ?? false)
        sheet.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        modal = sheet; addSubview(sheet)
        sheet.onFeedback = {[weak self,weak sheet] cue in
            guard let self,self.modal === sheet,self.active,self.foreground else{return}
            self.onFeedback?(cue)
        }
        let playExitID=UUID()
        var modalFinished=false,islandsFinished=false,delivered=false
        let complete:()->Void = {[weak self] in
            guard let self,self.pendingPlayExit==playExitID,modalFinished,islandsFinished,!delivered,self.active,self.foreground else{return}
            delivered=true;self.pendingPlayExit=nil;self.onPlay?(self.identifiers[index])
        }
        sheet.onPlayExitStart = {[weak self,weak sheet] in
            guard let self,self.modal === sheet,self.active,self.foreground else{return}
            self.pendingPlayExit=playExitID
            self.hub.setContentInteractionEnabled(false)
            if let exit=self.onPlayExit {exit{islandsFinished=true;complete()}}
            else {islandsFinished=true;complete()}
        }
        sheet.onFinish = { [weak self, weak sheet] play in
            guard let self, self.modal === sheet else { return }
            self.modal?.dispose(); self.modal = nil; self.hub.accessibilityElementsHidden = false
            if play {modalFinished=true;complete()}
            else if self.active && self.foreground { self.hub.startIdle() }
        }
        onFeedback?("exit-modal")
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
                return (unit, .init(tweens: [.init(begin: 0, duration: 0.16, from: .scale(1), to: .scale(0.96,y:8,opacity:0), ease: .powerIn(1))]))
            }
            let peak = JimiV9Motion.Pose(scaleX:1.144,scaleY:1.12), delay = 0.0
            return (unit,.init(tweens:[.init(begin:delay,duration:0.18,from:.scale(1),to:peak,ease:.powerIn(2)),
                .init(begin:delay+0.18,duration:0.336,from:peak,to:.scale(0),ease:.backIn(1.7))],anchorY:0.54))
        }
        result.append((hub.header, enter ? .init(tweens:[.init(begin:0,duration:reduced ? 0.2 : 0.56,from:.scale(reduced ? 0.96 : 0.65,y:reduced ? 8 : 30,opacity:0),to:.scale(1),ease:reduced ? .powerOut(1) : .backOut(1.8))]) : JimiV9Motion.journeyNavigationExit(reducedMotion:reduced)))
        return result
    }
}

/// Covered Hub stops while the shared modal and artwork idle own this visible
/// sheet. One paused layer subtree suspends finite motion and recurring idle.
@MainActor
final class NativeArcadeWorldModal: UIView {
    var onFinish: ((Bool) -> Void)?
    var onPlayExitStart:(()->Void)?
    var onFeedback:((String)->Void)?
    private let backdrop = JimiV9PlainButton(type:.custom), card = UIView(), flip = JimiNativeModalTransformView(), paper = UIImageView()
    private let heading = UILabel(), subtitle = UILabel(), art = UIImageView(), close = JimiV9PlainButton(type:.custom)
    private let play = JimiV9PlainButton(type:.custom), assets: JimiV9Artwork
    private let modeIndex: Int
    private let idle = UIView(), tilt = UIView()
    private let cloudStage=UIView()
    private var clouds:[UIImageView]=[]
    private(set) var modalDrag:JimiNativeModalDrag?
    private var foreground = true, entered = false
    private var closing = false, disposed = false
    private var ready = false {
        didSet { play.isEnabled = ready && foreground && !closing; accessibilityValue = ready ? "ready" : "entering" }
    }
    init(frame: CGRect, assets: JimiV9Artwork, index: Int,continuing:Bool=false) {
        self.assets = assets
        self.modeIndex = index
        super.init(frame:frame)
        accessibilityViewIsModal = true; accessibilityIdentifier = "native.arcade-world-modal"
        backdrop.backgroundColor = JimiNativeModalV10.backdropColor
        backdrop.addTarget(self,action:#selector(dismissSheet),for:.touchUpInside); addSubview(backdrop)
        addSubview(card); card.addSubview(flip); flip.addSubview(tilt); tilt.addSubview(idle); idle.addSubview(paper)
        // Stable artwork tilt stays independent of enter, drag and idle motion.
        let tiltDegrees = CGFloat(Int.random(in: -5...5)) * 0.5
        tilt.transform = CGAffineTransform(rotationAngle: tiltDegrees * .pi / 180)
        var camera = CATransform3DIdentity; camera.m34 = -1/920; layer.sublayerTransform = camera
        flip.layer.anchorPoint = CGPoint(x:0.5,y:1)
        paper.image = assets.image("assets/modals/paper.png"); paper.contentMode = .scaleToFill
        paper.accessibilityIdentifier = "native.arcade-world-modal.paper"
        paper.layer.cornerRadius = 40; paper.clipsToBounds = true
        card.layer.shadowColor = UIColor(red:185/255,green:145/255,blue:119/255,alpha:1).cgColor
        card.layer.shadowOpacity = 0.8; card.layer.shadowRadius = 16.8; card.layer.shadowOffset = CGSize(width:0,height:13)
        heading.text = ["Endurance","One Lucky Drop","Slow Burn"][index]
        heading.font = assets.font(size:29,weight:"ExtraBold"); heading.textAlignment = .center
        heading.textColor = UIColor(red:173/255,green:135/255,blue:117/255,alpha:1)
        subtitle.numberOfLines = index == 0 ? 2 : 3; subtitle.textAlignment = .center
        subtitle.accessibilityIdentifier = "native.arcade-world-modal.description"
        art.accessibilityIdentifier = "native.arcade-world-modal.art"
        subtitle.attributedText = NativeModalTypography.attributedSubtitle([
            "Clear rounds and keep going until you run out of moves.",
            "Get one lucky Special die\nto help you per round.",
            "Special dice take longer to drop onto your board."
        ][index],font:assets.font(size:19,weight:"Medium"))
        art.image = assets.image(["assets/arcade/endourance2.png","assets/arcade/pure dice2.png","assets/arcade/slow burn2.png"][index],densityAware:true)
        art.contentMode = .scaleAspectFit;art.layer.zPosition=1
        play.setTitle(continuing ? "Continue":"Play",for:.normal); play.applyModalCTA(artwork:assets)
        play.addTarget(self,action:#selector(pressPlay),for:[.touchDown,.touchDragEnter])
        play.addTarget(self,action:#selector(releasePlay),for:[.touchUpOutside,.touchDragExit,.touchCancel])
        play.addTarget(self,action:#selector(playGame),for:.touchUpInside)
        play.accessibilityIdentifier = "native.arcade-world-modal.play"; play.isEnabled = false
        close.setBackgroundImage(paper.image,for:.normal); close.layer.cornerRadius = 26; close.clipsToBounds = true
        close.setImage(assets.image("assets/close-icon.png"),for:.normal)
        close.imageView?.contentMode = .scaleAspectFit; close.artworkOpacity = 0.8; close.imageEdgeInsets = UIEdgeInsets(top:14,left:14,bottom:14,right:14)
        close.accessibilityLabel = "Close"; close.accessibilityIdentifier = "native.arcade-world-modal.close"; close.enableArtworkTapFeedback()
        close.addTarget(self,action:#selector(dismissSheet),for:.touchUpInside)
        cloudStage.isUserInteractionEnabled=false;cloudStage.accessibilityElementsHidden=true
        cloudStage.accessibilityIdentifier="native.arcade-world-modal.clouds"
        idle.addSubview(cloudStage)
        for (ordinal,name) in ["oblak veliki ljevo dole","oblak-forest2","oblak veliki ljevo dole","oblak+srednji","oblak-forest1"].enumerated() {
            let cloud=UIImageView(image:assets.image("assets/board transition/\(name).png",densityAware:true))
            cloud.contentMode = .scaleAspectFit;cloud.alpha=[0.78,0.74,0.76,0.72,0.72][ordinal]
            cloud.accessibilityIdentifier="native.arcade-world-modal.cloud.\(ordinal)"
            cloudStage.addSubview(cloud);clouds.append(cloud)
        }
        [heading,subtitle,art,play,close].forEach { idle.addSubview($0) }
        modalDrag=JimiNativeModalDrag(target:card,idle:idle,viewport:self,canDrag:{[weak self] in
            guard let self else{return false}
            return self.ready && self.foreground && !self.closing && !self.disposed
        },onDismiss:{[weak self] in self?.finish(false)})
    }
    required init?(coder:NSCoder) { fatalError("Use Arcade initializer") }
    override func layoutSubviews() {
        super.layoutSubviews(); backdrop.frame = bounds
        guard !closing,!disposed else{return}
        // Backpack detail's content-sized paper recipe. Reserve real safe-area
        // and floor-shadow room, rather than centering a fixed tall card.
        let w = min(390,max(0,bounds.width-48))
        heading.frame = CGRect(x:w*0.1,y:28,width:w*0.8,height:38.4)
        let subtitleWidth = modeIndex == 1 ? w*0.8 : (w < 300 ? max(0,w-16):w*0.8)
        let subtitleHeight = ceil(subtitle.sizeThatFits(CGSize(width:subtitleWidth,height:CGFloat.greatestFiniteMagnitude)).height)
        subtitle.frame = CGRect(x:(w-subtitleWidth)/2,y:heading.frame.maxY+12,width:subtitleWidth,height:subtitleHeight)
        let artworkY = subtitle.frame.maxY+24
        let aspect = (art.image?.size.width ?? 1)/max(1,art.image?.size.height ?? 1)
        // Reduce the preceding aspect-fit image by exactly20percent before
        // applying the small-screen safe-area ceiling.
        let priorWidth = min(390,max(0,bounds.width-40))
        let priorCopyHeight = ceil(subtitle.sizeThatFits(CGSize(width:max(0,priorWidth-56),height:CGFloat.greatestFiniteMagnitude)).height)
        let priorCardHeight = min(650,max(0,bounds.height-safeAreaInsets.top-safeAreaInsets.bottom-40))
        let priorArtworkHeight = max(0,priorCardHeight-100-(78+priorCopyHeight+12)-20)
        let scaledArtworkHeight = min(max(0,priorWidth-30)/aspect,priorArtworkHeight)*0.8
        let safeTop = safeAreaInsets.top+30, safeBottom = bounds.height-safeAreaInsets.bottom-40
        let availableHeight = max(0,safeBottom-safeTop)
        // Match Journey world-card modal: standard width226/250, height64,
        // centered horizontally with exactly40pt of paper below the CTA.
        let ctaWidth:CGFloat = bounds.width < 768 ? 226 : 250
        let footerHeight:CGFloat = 32+64+40
        let artworkHeight = min(scaledArtworkHeight,max(0,availableHeight-artworkY-footerHeight))
        art.bounds=CGRect(x:0,y:0,width:artworkHeight*aspect,height:artworkHeight)
        art.center=CGPoint(x:w/2,y:artworkY+artworkHeight/2)
        // Connected cloud bank borrows the main Arcade Hub's shapes, relative
        // widths and opacity. Overlap is intentional, on one stable2D plane.
        // Extra room accommodates two local offsets without resizing/reflowing.
        cloudStage.frame=CGRect(x:12-50,y:artworkY-8,width:w-24+50,height:artworkHeight+56)
        let cw=cloudStage.bounds.width-50,ch=cloudStage.bounds.height-40
        let bank:[(CGFloat,CGFloat,CGFloat)]=[(0.33,0.30,272),(0.18,0.56,188),
            (0.67,0.34,248),(0.82,0.60,166),(0.50,0.72,184)]
        for (index,cloud) in clouds.enumerated() {
            let (x,y,authoredWidth)=bank[index]
            let ratio=(cloud.image?.size.height ?? 1)/max(1,cloud.image?.size.width ?? 1)
            let preferred=(art.bounds.width+20)*authoredWidth/390*1.20
            let width=max(0,min(preferred,cw-20,(ch-20)/max(0.001,ratio)))
            let height=width*ratio
            cloud.bounds=CGRect(x:0,y:0,width:width,height:height)
            let minX=width/2+10,maxX=cw-width/2-10
            let minY=height/2+10,maxY=ch-height/2-10
            var center=CGPoint(x:min(maxX,max(minX,cw*x)),y:min(maxY,max(minY,ch*y)))
            // Distinct connected banks: Endurance lower, Pure Dice left,
            // Slow Burn right. Bias30% of remaining safe room, preserving size.
            switch modeIndex {
            case 0:center.y += (maxY-center.y)*0.30
            case 1:center.x += (minX-center.x)*0.30
            default:center.x += (maxX-center.x)*0.30
            }
            // Fixed per-mode selections stay stable through layout/resume.
            let lowered=[0,2,1][modeIndex],leftward=[3,4,2][modeIndex]
            if index == lowered { center.y += 40 }
            center.x += 50
            if index == leftward { center.x -= 50 }
            cloud.center=center
        }
        let playY=artworkY+artworkHeight+32
        play.bounds=CGRect(x:0,y:0,width:ctaWidth,height:64)
        play.center=CGPoint(x:w/2,y:playY+32)
        let h=playY+64+40
        card.bounds = CGRect(x:0,y:0,width:w,height:h)
        card.center = CGPoint(x:bounds.midX,y:safeTop+availableHeight/2)
        flip.bounds = card.bounds; flip.center = CGPoint(x:w/2,y:h)
        tilt.bounds=flip.bounds;tilt.center=CGPoint(x:w/2,y:h/2)
        idle.bounds=tilt.bounds;idle.center=CGPoint(x:w/2,y:h/2)
        JimiNativeModalV10.paperLayout(paper,bounds:card.bounds,bottomExtension:96)
        close.frame = CGRect(x:w-42,y:-10,width:52,height:52)
    }
    func reveal() {
        layoutIfNeeded(); card.alpha = 1; backdrop.alpha = 0
        if UIAccessibility.isReduceMotionEnabled { completeEnter(); backdrop.alpha = 1; return }
        CATransaction.begin()
        CATransaction.setCompletionBlock { [weak self] in guard let self,!self.disposed,!self.closing else { return }; self.completeEnter() }
        JimiNativeModalV10.enter(card:card,flip:flip,key:"arcade.modal.enter")
        CATransaction.commit()
        UIView.animate(withDuration:0.5) { self.backdrop.alpha = 1 }
    }
    private func completeEnter() {
        guard !disposed,!closing else{return}
        entered=true
        guard foreground else{return}
        ready=true
        JimiNativeModalV10.startIdle(on:idle,key:"arcade.modal.idle")
        JimiNativeModalV10.startIdle(on:art,key:"arcade.modal.art.idle")
        refreshCloudIdle(reducedMotion:UIAccessibility.isReduceMotionEnabled)
    }
    /// Same visible modal owner handles preference changes and foreground reentry.
    func refreshCloudIdle(reducedMotion:Bool) {
        guard entered,foreground,!closing,!disposed else{return}
        if reducedMotion {freezeClouds();return}
        let periods:[Double]=[7.3,6.8,7.1,6.7,6.4],amplitudes:[CGFloat]=[1.25,-1,1.25,-1.25,1.25]
        let drifts:[CGFloat]=[-8,-7,-7,7,-8]
        for (index,cloud) in clouds.enumerated() {
            JimiNativeModalV10.startIdle(on:cloud,key:"arcade.modal.cloud.idle",drift:drifts[index],
                amplitude:amplitudes[index],duration:periods[index],depth:false)
        }
    }
    func settle() {setForeground(false)}
    func setForeground(_ active:Bool) {
        guard !disposed else{return}
        if !active,!closing {modalDrag?.cancel()}
        foreground=active;isUserInteractionEnabled=active && !closing
        play.isEnabled=ready && active && !closing
        if active {
            if layer.speed==0 {let paused=layer.timeOffset;layer.speed=1;layer.timeOffset=0;layer.beginTime=0;layer.beginTime=layer.convertTime(CACurrentMediaTime(),from:nil)-paused}
            if entered {completeEnter()}
        }else if layer.speed != 0 {
            layer.timeOffset=layer.convertTime(CACurrentMediaTime(),from:nil);layer.speed=0
        }
    }
    func dispose() {
        guard !disposed else { return }; modalDrag?.dispose();modalDrag=nil;disposed = true; onFinish = nil;onFeedback=nil;onPlayExitStart=nil
        for target in [self,card,flip,tilt,idle,art,backdrop,close,play]+clouds { target.layer.removeAllAnimations() }
        clouds.forEach{$0.image=nil}
        removeFromSuperview()
    }
    private func finish(_ play: Bool) {
        guard ready,foreground,!closing,!disposed else { return }
        // Retire the idle at its painted pose. Resetting its animated transform
        // to identity here caused a visible paper jump before authored exit.
        let idlePose=idle.layer.presentation()?.transform ?? idle.layer.transform
        let artPose=art.layer.presentation()?.transform ?? art.layer.transform
        modalDrag?.cancel(preservePose:true);closing=true
        isUserInteractionEnabled=false;self.play.isEnabled=false
        if play {onFeedback?("cta");onPlayExitStart?()}
        CATransaction.begin();CATransaction.setDisableActions(true)
        idle.layer.transform=idlePose;art.layer.transform=artPose
        idle.layer.removeAllAnimations();art.layer.removeAllAnimations()
        freezeClouds()
        if !play {close.playArtworkTapFeedback();onFeedback?("back")}
        if UIAccessibility.isReduceMotionEnabled {
            if play {exitAcceptedPlay()}
            CATransaction.commit();onFinish?(play);return
        }
        CATransaction.setCompletionBlock { [weak self] in guard let self,!self.disposed else { return }; self.onFinish?(play) }
        if play {exitAcceptedPlay()}
        let painted=card.layer.presentation()?.transform ?? card.layer.transform
        JimiNativeModalV10.exit(card,flip:false,releaseY:painted.m42,releaseTilt:atan2(painted.m12,painted.m11)*180 / .pi,key:"arcade.modal.exit")
        JimiNativeModalV10.exit(flip,flip:true,key:"arcade.modal.exit")
        let fade = CAKeyframeAnimation(keyPath:"opacity"); fade.values = [1,1,0]; fade.keyTimes = [0,0.18,1]; fade.duration = 0.65
        fade.timingFunctions=Array(repeating:CAMediaTimingFunction(controlPoints:0.4,0,0.2,1),count:2)
        card.layer.opacity = 0; card.layer.add(fade,forKey:"arcade.modal.fade")
        CATransaction.commit()
        UIView.animate(withDuration:0.2) { self.backdrop.alpha = 0 }
    }
    private func freezeClouds() {
        for cloud in clouds {
            cloud.layer.transform=cloud.layer.presentation()?.transform ?? cloud.layer.transform
            cloud.layer.removeAllAnimations()
        }
    }
    @objc private func dismissSheet() { finish(false) }
    private func animatePlay(pressed:Bool) {
        let target=play.layer,from=target.presentation()?.transform ?? target.transform
        let scale=pressed ? 0.84:1.0,y=pressed ? 4.0:0.0
        let ease:JimiV9Motion.Ease=pressed ? .powerOut(2):.backOut(2.1)
        let animation=CAKeyframeAnimation(keyPath:"transform")
        animation.values=(0...30).map { step in
            let t=ease.value(Double(step)/30)
            let s=Double(from.m11)+(scale-Double(from.m11))*t
            let offset=Double(from.m42)+(y-Double(from.m42))*t
            return NSValue(caTransform3D:CATransform3DScale(CATransform3DMakeTranslation(0,offset,0),s,s,1))
        }
        animation.duration=UIAccessibility.isReduceMotionEnabled ? 0.001:(pressed ? 0.12:0.26)
        CATransaction.begin();CATransaction.setDisableActions(true)
        target.removeAnimation(forKey:"arcade.cta.press");target.removeAnimation(forKey:"arcade.cta.release")
        target.transform=CATransform3DScale(CATransform3DMakeTranslation(0,y,0),scale,scale,1)
        target.add(animation,forKey:pressed ? "arcade.cta.press":"arcade.cta.release")
        CATransaction.commit()
    }
    @objc private func pressPlay() {
        guard ready,foreground,!closing,!disposed else{return}
        animatePlay(pressed:true)
    }
    @objc private func releasePlay() {
        guard ready,foreground,!closing,!disposed else{return}
        animatePlay(pressed:false)
    }
    /// Same accepted-button collapse as Exit Game; cancellation alone springs
    /// back to identity. Accepted CTA and paper exit share one transaction.
    private func exitAcceptedPlay() {
        let recipe=JimiV9Motion.Track(tweens:[.init(begin:0,duration:0.31,from:.scale(0.84,y:4),to:.scale(0,y:18,opacity:0),ease:.backIn(1.75))])
        let sample=JimiV9Motion.sampledTrack(recipe)
        play.layer.removeAllAnimations()
        CATransaction.begin();CATransaction.setDisableActions(true)
        play.layer.transform=CATransform3DScale(CATransform3DMakeTranslation(0,18,0),0,0,0)
        play.layer.opacity=0
        if !UIAccessibility.isReduceMotionEnabled {
            let transform=CAKeyframeAnimation(keyPath:"transform");transform.duration=sample.duration
            transform.values=sample.poses.map {pose in NSValue(caTransform3D:CATransform3DScale(CATransform3DMakeTranslation(0,CGFloat(pose.y),0),CGFloat(pose.scaleX),CGFloat(pose.scaleX),CGFloat(pose.scaleX)))}
            let opacity=CAKeyframeAnimation(keyPath:"opacity");opacity.duration=sample.duration;opacity.values=sample.poses.map{$0.opacity}
            play.layer.add(transform,forKey:"arcade.cta.exit");play.layer.add(opacity,forKey:"arcade.cta.exit-opacity")
        }
        CATransaction.commit()
    }
    @objc private func playGame() {finish(true)}
}
