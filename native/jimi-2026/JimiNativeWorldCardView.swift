import UIKit

private final class JimiWorldRotorView: UIView { override class var layerClass: AnyClass { CATransformLayer.self } }

private final class JimiWorldCameraStage: UIView {
    override func hitTest(_ point:CGPoint,with event:UIEvent?) -> UIView? {
        let hit = super.hitTest(point,with:event);return hit === self ? nil : hit
    }
}

/// One physical carrier/rotor, separate spatial and face transforms. No game rules.
@MainActor
final class JimiNativeWorldCardView: UIView, UIGestureRecognizerDelegate {
    let boardID: Int
    var onFeedback: ((String) -> Void)?
    var onRequest: ((String) -> Void)?
    private let cameraStage = JimiWorldCameraStage()
    private let carrier = JimiWorldRotorView(), dragShell = JimiWorldRotorView(), effectShell = JimiWorldRotorView(), pinchShell = JimiWorldRotorView(), rotorShell = JimiWorldRotorView()
    private var rotor: CALayer { rotorShell.layer }
    private let front = UIImageView(), back = UIView(), panel = UIView(), paper = UIImageView()
    private let closeButton = UIButton(type:.custom), backdrop = UIButton(type:.custom)
    private let closePaper = UIView(), closeTexture = UIImageView(), closeIcon = UIImageView()
    private let title = UILabel(), stats = UIStackView(), stars = UIStackView()
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
    private let ratio: CGFloat
    private var base = CGRect.zero
    private let duration = 0.520 / 0.98
    private var rarity = "common"
    private var effects: JimiNativeWorldCardEffects?
    private var active = true, disposed = false, closing = false, pinching = false
    private var flipGeneration = 0
    private var stableCTAEnabled = false
    private weak var resources: JimiNativeWorldResources?
    private let cardArt2x: String?
    private var newRibbon:UIImageView?

    init(unit:JimiNativeWorldSnapshot.Unit,assets:JimiV9Artwork,resources:JimiNativeWorldResources,worldTitle:String = "Forest",presentationHasNewRibbon:Bool? = nil) {
        boardID = unit.boardID
        self.resources = resources;cardArt2x = unit.cardArt2x
        rarity = unit.cardRarity
        originRotation = unit.parts.first(where:{$0.role == "card"})?.rotation ?? 0
        let cardPart = unit.parts.first(where:{$0.role == "card"})
        ratio = (cardPart?.frame.width ?? 90) / max(1,cardPart?.frame.height ?? 133)
        let direction: CGFloat = Bool.random() ? 1 : -1
        tilt = CGFloat.random(in:4.75...6.25) * .pi / 180 * direction
        backTilt = CGFloat.random(in:2...3.25) * .pi / 180 * -direction
        super.init(frame:.zero)
        accessibilityIdentifier = "native.world.card.modal"
        rotorShell.accessibilityIdentifier = "native.world.card.rotor"
        backdrop.backgroundColor = UIColor(red:220/255,green:183/255,blue:163/255,alpha:0.52);backdrop.alpha = 0
        backdrop.addTarget(self,action:#selector(requestClose),for:.touchUpInside)
        cameraStage.accessibilityIdentifier = "native.world.card.camera"
        addSubview(backdrop);addSubview(cameraStage);cameraStage.addSubview(carrier);carrier.addSubview(dragShell);dragShell.addSubview(effectShell);effectShell.addSubview(pinchShell);pinchShell.addSubview(rotorShell)
        rotorShell.addSubview(front); rotorShell.addSubview(back)
        front.image = resources.image(unit.cardArt,owner:boardID); front.contentMode = .scaleAspectFit
        if presentationHasNewRibbon ?? unit.newRibbon {
            let ribbon = JimiNativeWorldRibbon.make(image:resources.image("assets/journey assets/orange-ribbon.png",owner:boardID),assets:assets,cardSize:.zero,scale:1,portal:true)
            newRibbon = ribbon; front.addSubview(ribbon)
        }
        front.layer.isDoubleSided = false; back.layer.isDoubleSided = false
        front.layer.transform = CATransform3DMakeTranslation(0,0,0.6)
        back.layer.transform = CATransform3DTranslate(CATransform3DMakeRotation(-.pi,0,1,0),0,0,0.6)
        panel.backgroundColor = .clear; panel.layer.cornerRadius = 34; panel.clipsToBounds = true;back.addSubview(panel)
        paper.image = resources.image("assets/modals/paper.png",owner:boardID); paper.contentMode = .scaleToFill; paper.alpha = 1; panel.addSubview(paper)
        title.text = String(format:"%@ %02d",worldTitle,(boardID-1)%10+1); title.font = assets.font(size:32,weight:"ExtraBold"); title.textAlignment = .center; title.textColor = UIColor(red:173/255,green:134/255,blue:117/255,alpha:1); back.addSubview(title)
        stars.axis = .horizontal; stars.spacing = 8; stars.alignment = .center
        for index in 0..<3 {
            let image = UIImageView(image:resources.image(index < unit.stars ? "assets/modals/star.png" : "assets/modals/star-empty.png",owner:boardID)); image.contentMode = .scaleAspectFit; image.widthAnchor.constraint(equalToConstant:31.45).isActive = true; image.heightAnchor.constraint(equalToConstant:31.45).isActive = true; image.transform = index == 1 ? CGAffineTransform(translationX:0,y:-8) : CGAffineTransform(rotationAngle:index == 0 ? -8 * .pi/180 : 8 * .pi/180); stars.addArrangedSubview(image)
        }
        back.addSubview(stars)
        stats.axis = .vertical; stats.spacing = 0
        for (index,pair) in unit.stats.prefix(2).enumerated() {
            if index == 1 {
                let shell = UIView();shell.heightAnchor.constraint(equalToConstant:18).isActive = true
                let divider = UIView();divider.backgroundColor = UIColor(red:249/255,green:242/255,blue:233/255,alpha:1);divider.tag = 701; shell.addSubview(divider);stats.addArrangedSubview(shell)
            }
            let row = UIView();row.heightAnchor.constraint(equalToConstant:112).isActive = true
            let offset:CGFloat = index == 0 ? 6 : -6
            let icon = UIImageView(image:resources.image(index == 0 ? "assets/highscore-icon.png" : "assets/combo-icon.png",owner:boardID));icon.contentMode = .scaleAspectFit;icon.frame = CGRect(x:0,y:16+offset,width:80,height:80);row.addSubview(icon)
            let value = UILabel(frame:CGRect(x:96,y:32.2+offset,width:180,height:32));value.text = pair.1;value.font = assets.font(size:32,weight:"Bold");value.textColor = UIColor(red:232/255,green:116/255,blue:74/255,alpha:1);row.addSubview(value)
            let label = UILabel(frame:CGRect(x:96,y:66.2+offset,width:180,height:21.6));label.text = index == 0 ? "High score" : "Longest combo";label.font = assets.font(size:20,weight:"Medium");label.textColor = title.textColor;row.addSubview(label)
            stats.addArrangedSubview(row)
        }
        back.addSubview(stats)
        let action = unit.actions.contains("continue") ? "continue" : "play"
        cta.accessibilityIdentifier = "native.world.card.\(action)"
        cta.setTitle(action == "continue" ? "Continue" : "Play",for:.normal)
        cta.titleLabel?.font = assets.font(size:28); cta.titleLabel?.shadowColor = UIColor(red:194/255,green:73/255,blue:33/255,alpha:1);cta.titleLabel?.shadowOffset = CGSize(width:0,height:2); cta.backgroundColor = UIColor(red:233/255,green:122/255,blue:85/255,alpha:1); cta.layer.cornerRadius = 32
        cta.setTitleColor(UIColor(red:1,green:251/255,blue:242/255,alpha:1),for:.normal)
        cta.layer.shadowColor = UIColor(red:194/255,green:73/255,blue:33/255,alpha:1).cgColor; cta.layer.shadowOpacity = 1; cta.layer.shadowOffset = CGSize(width:0,height:8); cta.layer.shadowRadius = 0
        stableCTAEnabled = unit.actions.contains(action);cta.isEnabled = stableCTAEnabled; cta.addAction(UIAction { [weak self] _ in guard let self,self.active,!self.disposed,!self.closing,!self.animating,!self.pinching else {return}; self.onFeedback?("cta"); self.onRequest?(action) },for:.touchUpInside); back.addSubview(cta)
        closePaper.backgroundColor = UIColor(red:1,green:250/255,blue:244/255,alpha:1);closePaper.layer.cornerRadius = 28;closePaper.clipsToBounds = true;closePaper.isUserInteractionEnabled = false
        closeTexture.image = paper.image;closeTexture.contentMode = .scaleToFill;closePaper.addSubview(closeTexture);closeButton.addSubview(closePaper)
        closeIcon.image = assets.image("assets/close-icon.png");closeIcon.contentMode = .scaleAspectFit;closeIcon.alpha = 0.92;closeIcon.isUserInteractionEnabled = false;closeButton.addSubview(closeIcon)
        closeButton.accessibilityIdentifier = "native.world.card.close"; closeButton.addTarget(self,action:#selector(requestClose),for:.touchUpInside); back.addSubview(closeButton)
        let tap = UITapGestureRecognizer(target:self,action:#selector(tapped(_:)));tap.delegate = self;carrier.addGestureRecognizer(tap)
        let pan = UIPanGestureRecognizer(target:self,action:#selector(drag(_:)));pan.delegate = self;pan.maximumNumberOfTouches = 1;carrier.addGestureRecognizer(pan)
        let pinch = UIPinchGestureRecognizer(target:self,action:#selector(pinched(_:)));pinch.delegate = self;carrier.addGestureRecognizer(pinch)
        cta.addTarget(self,action:#selector(pressCTA),for:[.touchDown,.touchDragEnter])
        cta.addTarget(self,action:#selector(releaseCTA),for:[.touchUpInside,.touchUpOutside,.touchCancel,.touchDragExit])
        var perspective = CATransform3DIdentity; perspective.m34 = -1/1050; cameraStage.layer.sublayerTransform = perspective
        for face in [front as UIView,back] {face.layer.shadowColor = UIColor(red:165/255,green:124/255,blue:98/255,alpha:1).cgColor;face.layer.shadowOpacity = 0.86;face.layer.shadowRadius = 18;face.layer.shadowOffset = CGSize(width:0,height:14)}
        effects = JimiNativeWorldCardEffects(front:front,impact:effectShell,overlay:self,assets:assets,resources:resources,boardID:boardID,rarity:rarity,newRibbon:presentationHasNewRibbon ?? unit.newRibbon)

    }
    required init?(coder:NSCoder) {fatalError("init(coder:) has not been implemented")}
    override func layoutSubviews() {
        super.layoutSubviews(); backdrop.frame = bounds;cameraStage.frame = bounds
        closeButton.frame = CGRect(x:carrier.bounds.width-42,y:-10,width:52,height:52)
        closePaper.frame = CGRect(x:-2,y:-2,width:56,height:56)
        let paperAspect = (closeTexture.image?.size.height ?? 390)/max(1,closeTexture.image?.size.width ?? 390)
        closeTexture.frame = CGRect(x:56-390+10,y:-8,width:390,height:390*paperAspect)
        closeIcon.frame = CGRect(x:12.5,y:12.5,width:27,height:27)
        let size = carrier.bounds.size;dragShell.frame = carrier.bounds;effectShell.frame = carrier.bounds;pinchShell.frame = carrier.bounds;rotorShell.frame = carrier.bounds
        front.bounds = carrier.bounds;front.center = CGPoint(x:size.width/2,y:size.height/2);back.bounds = carrier.bounds;back.center = front.center;panel.frame = carrier.bounds;paper.frame = CGRect(x:-6,y:0,width:size.width+12,height:size.height+16)
        stars.frame = CGRect(x:(size.width-110.35)/2,y:40.55,width:110.35,height:31.45)
        title.frame = CGRect(x:24,y:80,width:size.width-48,height:32)
        stats.frame = CGRect(x:24,y:116,width:size.width-48,height:242)
        for row in stats.arrangedSubviews {row.subviews.first(where:{$0.tag == 701})?.frame = CGRect(x:0,y:8,width:size.width-48,height:2)}
        // v10 .cc-cta--standard-width: 226px below 768px, otherwise 250px.
        let ctaWidth:CGFloat = bounds.width < 768 ? 226 : 250
        cta.frame = CGRect(x:(size.width-ctaWidth)/2,y:size.height-120,width:ctaWidth,height:64)
        cta.layer.shadowPath = UIBezierPath(roundedRect:cta.bounds,cornerRadius:32).cgPath
        if let newRibbon {JimiNativeWorldRibbon.layout(newRibbon,cardSize:front.bounds.size,scale:1,portal:true,compact:bounds.width<=768)}
        effects?.layout()
    }
    private var destination:CGRect {
        let width = min(bounds.width-64,390)
        let height = width/max(0.1,ratio)
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
    private func fly(from:CGRect,to:CGRect,returning:Bool,gameplay:Bool = false,completion:@escaping () -> Void) {
        generation += 1; let token = generation; animating = true
        let launch = gameplay ? 0.100/0.98 : 0, travel = gameplay ? 0.500/0.98 : duration, total = launch+travel
        let startPose = carrier.layer.presentation()?.transform ?? carrier.layer.transform
        let startRotation = returning ? atan2(startPose.m12,startPose.m11) : originRotation
        let count = Int(ceil(total*240)); let animation = CAKeyframeAnimation(keyPath:"transform")
        animation.values = (0...count).map { index -> NSValue in
            let time = Double(index)*total/Double(count)
            let p = spatialProgress(max(0,min(1,(time-launch)/travel)),returning:returning)
            let dx = to.midX-from.midX,dy = to.midY-from.midY,distance = hypot(dx,dy)
            let bounded = min(1,max(0,p)), arc = distance < 1 ? 0 : min(34,max(14,distance*0.075))*sin(.pi*bounded)
            let direction:CGFloat = dx >= 0 ? 1 : -1
            let x = from.midX+dx*p-base.midX+(distance < 1 ? 0 : -dy/distance*arc*direction), y = from.midY+dy*p-base.midY+(distance < 1 ? 0 : dx/distance*arc*direction)
            let width = from.width+(to.width-from.width)*p, height = from.height+(to.height-from.height)*p
            let rotation = returning ? startRotation+(originRotation-startRotation)*p : originRotation+(backTilt-originRotation)*p
            var transform = CATransform3DMakeTranslation(x,y,0); transform = CATransform3DRotate(transform,rotation,0,0,1); transform = CATransform3DScale(transform,width/base.width,height/base.height,1)
            if gameplay && time < launch {let peak = 1+0.14*JimiV9Motion.Ease.backOut(2.4).value(time/launch);transform = CATransform3DScale(transform,peak,peak,1)}
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
        onFeedback?("card-entry-flip");transitionBackdrop(to:1,duration:duration)
        base = destination; carrier.frame = base; layoutIfNeeded();effects?.layout();cta.isEnabled = false
        animateBackStats(entering:true,delay:duration*0.5)
        angle = -.pi;rotate(from:0,to:-.pi,duration:duration,flight:true)
        fly(from:origin,to:base,returning:false) { [weak self] in
            guard let self,!self.disposed,!self.closing else {return};CATransaction.begin();CATransaction.setDisableActions(true);self.carrier.layer.transform = CATransform3DMakeRotation(self.backTilt,0,0,1);self.carrier.layer.removeAnimation(forKey:"card.flight");CATransaction.commit();self.cta.isEnabled = self.stableCTAEnabled;self.effects?.present(frontFacing:false)
            if let path = self.cardArt2x,let resources = self.resources {let token = self.generation;resources.prepare([path],owner:self.boardID,required:false) { [weak self,weak resources] accepted in guard accepted,let self,self.generation == token else {return};if let image = resources?.image(path,owner:self.boardID) {self.front.image = image;self.effects?.layout()} } }
        }
    }
    private func rotate(from:Double,to:Double,duration:Double,flight:Bool = false) {
        let animation = CAKeyframeAnimation(keyPath:"transform.rotation.y")
        animation.values = (0...128).map { index in
            let t = Double(index)/128
            let u = min(1,max(0,(t-0.32)/0.36))
            return from+(to-from)*(flight ? u*u*(3-2*u) : JimiV9Motion.Ease.powerOut(2).value(t))
        }
        animation.duration = UIAccessibility.isReduceMotionEnabled ? 0.18 : duration; animation.fillMode = .both; animation.isRemovedOnCompletion = false
        rotor.add(animation,forKey:"card.flip")
        CATransaction.begin(); CATransaction.setDisableActions(true); rotor.transform = CATransform3DMakeRotation(to,0,1,0); CATransaction.commit()
    }
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        guard active,!disposed,!closing,!animating else {return false}
        var view = touch.view
        while let current = view {if current is UIControl {return false};view = current.superview}
        return true
    }
    private func animateBackStats(entering:Bool,delay:Double) {
        let views = stats.arrangedSubviews
        for (index,view) in views.enumerated() {
            let animation = CAKeyframeAnimation(keyPath:"transform.scale")
            let count = 48
            animation.values = (0...count).map { step in
                let t = Double(step)/Double(count)
                let curve = JimiV9Motion.Ease.cubicBezier(0.55,0.06,0.68,0.19)
                return entering ? 1-curve.value(1-t) : 1-curve.value(t)
            }
            animation.duration = UIAccessibility.isReduceMotionEnabled ? 0.001 : 0.2
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

    @objc private func tapped(_ gesture:UITapGestureRecognizer) {tapToFlip()}
    func tapToFlip() {guard active,!disposed,!closing,!animating,!pinching else{return};interactiveFlip(direction:isBackFacing ? -1 : 1)}
    private var isBackFacing:Bool {abs(cos(angle)) > 0.001 && cos(angle) < 0}
    private func interactiveFlip(direction:Double? = nil,from incoming:Double? = nil) {
        guard active,!disposed,!closing,!animating,!pinching else{return}
        effects?.cancel();onFeedback?("card-manual-flip");animating = true;cta.isEnabled = false
        flipGeneration += 1;let token = flipGeneration
        let sampled = incoming ?? angle
        let from = sampled+((angle-sampled)/(2 * .pi)).rounded()*2 * .pi
        let canonical = isBackFacing ? 0.0 : -Double.pi
        let candidates = [-2*Double.pi,0,2*Double.pi].map {canonical+$0}
        let directed = direction.map{d in candidates.filter{($0-from)*d > 0}} ?? candidates
        let choices = directed.isEmpty ? candidates : directed
        let to = choices.dropFirst().reduce(choices.first ?? canonical) {nearest,candidate in abs(candidate-from)<abs(nearest-from) ? candidate : nearest}
        angle = to
        animateFaceTilt(canonical < 0 ? backTilt : tilt)
        let animation = CAKeyframeAnimation(keyPath:"transform.rotation.y")
        animation.values = [from,to,to+(to>=from ? 1 : -1)*12 * .pi/180,to]
        animation.keyTimes = [0.0,0.20/0.46,(0.20+0.26*0.38)/0.46,1].map {NSNumber(value:$0)}
        animation.timingFunctions = [.init(name:.linear),.init(controlPoints:0.45,0,0.55,1),.init(controlPoints:0.22,1,0.36,1)]
        animation.duration = UIAccessibility.isReduceMotionEnabled ? 0.001 : 0.46
        CATransaction.begin();CATransaction.setCompletionBlock{[weak self] in guard let self,self.flipGeneration == token,!self.disposed,!self.closing else{return};self.rotor.removeAnimation(forKey:"card.flip");self.angle = canonical;CATransaction.begin();CATransaction.setDisableActions(true);self.rotor.transform = CATransform3DMakeRotation(canonical,0,1,0);CATransaction.commit();self.animating = false;self.cta.isEnabled = self.stableCTAEnabled && self.isBackFacing;self.effects?.present(frontFacing:!self.isBackFacing)}
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
    @objc private func requestClose() {guard active,!disposed,!closing else{return};onRequest?("close")}
    private func setDrag(_ y:CGFloat) {CATransaction.begin();CATransaction.setDisableActions(true);dragShell.layer.transform = CATransform3DMakeTranslation(0,y,0);CATransaction.commit()}
    private func settleDrag() {
        let from = dragShell.layer.presentation()?.transform ?? dragShell.layer.transform
        CATransaction.begin();CATransaction.setDisableActions(true);dragShell.layer.transform = CATransform3DIdentity
        let settle = CABasicAnimation(keyPath:"transform");settle.fromValue = NSValue(caTransform3D:from);settle.toValue = NSValue(caTransform3D:CATransform3DIdentity);settle.duration = 0.2;settle.timingFunction = CAMediaTimingFunction(controlPoints:0.22,1,0.36,1);dragShell.layer.add(settle,forKey:"card.drag.settle");CATransaction.commit()
    }
    @objc private func drag(_ pan:UIPanGestureRecognizer) {
        guard active,!disposed,!closing,!animating,!pinching else{return}
        switch pan.state {
        case .began:
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
            if dragAxis == "vertical",pan.state == .ended,abs(delta.y)>max(88,min(140,base.height*0.22)) {onRequest?("close")}
            else if dragAxis == "horizontal",pan.state == .ended,abs(delta.x)>=bounds.width*0.1 {let current = (rotor.value(forKeyPath:"transform.rotation.y") as? NSNumber)?.doubleValue ?? dragStartAngle;frontDrag = false;interactiveFlip(from:current)}
            else {frontDrag = false;rotate(from:(rotor.value(forKeyPath:"transform.rotation.y") as? NSNumber)?.doubleValue ?? angle,to:angle,duration:0.18);settleDrag();effects?.present(frontFacing:!isBackFacing)}
        default:break
        }
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
    func close(to destination:CGRect,gameplay:Bool = false,completion:@escaping () -> Void) {
        guard !disposed,!closing else {completion();return};closing = true;flipGeneration += 1;effects?.cancel(handoff:false)
        newRibbon?.removeFromSuperview();newRibbon = nil
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
        fly(from:painted,to:destination,returning:true,gameplay:gameplay) { [weak self] in self?.backdrop.alpha = 0; completion() }
    }
    func setActive(_ value:Bool) {
        guard !disposed,active != value else{return};active = value;effects?.setActive(value)
        if !value {CATransaction.begin();CATransaction.setDisableActions(true);cta.layer.removeAllAnimations();cta.layer.transform = CATransform3DIdentity;CATransaction.commit()}
        guard (layer.speed == 0) == value else {return}
        if value {let paused = layer.timeOffset; layer.speed = 1;layer.timeOffset = 0;layer.beginTime = 0;layer.beginTime = layer.convertTime(CACurrentMediaTime(),from:nil)-paused}
        else {let paused = layer.convertTime(CACurrentMediaTime(),from:nil);layer.speed = 0;layer.timeOffset = paused}
    }
    func cleanup() {guard !disposed else{return};disposed = true;active = false;generation += 1;flipGeneration += 1;effects?.cleanup();effects = nil;[carrier,dragShell,effectShell,pinchShell,rotorShell,cta,backdrop].forEach{$0.layer.removeAllAnimations()};carrier.gestureRecognizers?.forEach{carrier.removeGestureRecognizer($0)};stats.arrangedSubviews.forEach{$0.layer.removeAllAnimations()};onRequest = nil;onFeedback = nil;isUserInteractionEnabled = false}
}


/// Original NEW artwork and lettering remain attached to the physical card face.
@MainActor
enum JimiNativeWorldRibbon {
    static func make(image:UIImage?,assets:JimiV9Artwork,cardSize:CGSize,scale:CGFloat,portal:Bool,compact:Bool = true)->UIImageView {
        let ribbon = UIImageView(image:image);ribbon.contentMode = .scaleAspectFit
        ribbon.accessibilityIdentifier = "native.world.ribbon";ribbon.isUserInteractionEnabled = false
        if portal {ribbon.layer.shadowColor = UIColor(red:226/255,green:119/255,blue:74/255,alpha:1).cgColor;ribbon.layer.shadowOpacity = 1;ribbon.layer.shadowOffset = CGSize(width:0,height:5);ribbon.layer.shadowRadius = 2.85}
        let label = UILabel();label.tag = 991;label.textAlignment = .center;ribbon.addSubview(label)
        let fontSize = cardSize.width*(portal ? 0.083 : 0.13)
        let shadow = NSShadow();shadow.shadowOffset = CGSize(width:0,height:0.6*scale);shadow.shadowBlurRadius = scale;shadow.shadowColor = UIColor(red:146/255,green:73/255,blue:58/255,alpha:0.2)
        label.attributedText = NSAttributedString(string:"New",attributes:[.font:assets.font(size:max(1,fontSize),weight:portal ? "ExtraBold" : "Bold"),.foregroundColor:UIColor(red:1,green:243/255,blue:220/255,alpha:0.9),.kern:fontSize*0.015,.shadow:shadow])
        layout(ribbon,cardSize:cardSize,scale:scale,portal:portal,compact:compact)
        return ribbon
    }
    static func layout(_ ribbon:UIImageView,cardSize:CGSize,scale:CGFloat,portal:Bool,compact:Bool = true) {
        let width = portal ? cardSize.width*(compact ? 0.5904 : 0.648) : (compact ? 63 : 75)*scale
        let height = width*(ribbon.image?.size.height ?? 131)/max(1,ribbon.image?.size.width ?? 137)
        ribbon.frame = CGRect(x:cardSize.width-width,y:0,width:width,height:height)
        guard let label = ribbon.viewWithTag(991) as? UILabel else {return}
        if let attributed = label.attributedText,attributed.length>0,let font = attributed.attribute(.font,at:0,effectiveRange:nil) as? UIFont {
            let next = NSMutableAttributedString(attributedString:attributed),size = cardSize.width*(portal ? 0.083 : 0.13)
            next.addAttributes([.font:font.withSize(max(1,size)),.kern:size*0.015],range:NSRange(location:0,length:next.length));label.attributedText = next
        }
        label.transform = .identity;label.sizeToFit();label.center = CGPoint(x:width*0.45,y:height*0.55)
        label.transform = CGAffineTransform(translationX:(portal ? 32 : 11)*scale,y:(portal ? -33 : -10)*scale).rotated(by:41 * .pi/180)
    }
}
