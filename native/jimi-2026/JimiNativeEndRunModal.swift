import UIKit
import WebKit

/// Preserve the nested CSS 3D owners instead of flattening each UIView plane.
final class JimiNativeModalTransformView: UIView {
    override class var layerClass: AnyClass { CATransformLayer.self }
}

/// v10 CSS interpolates transform components, including the rotation at scale zero.
/// Matrix interpolation cannot recover that rotation from the collapsed endpoint.
@MainActor
enum JimiNativeModalV10 {
    static func paperLayout(_ paper: UIImageView, bounds: CGRect, bottomExtension: CGFloat = 0) {
        paper.frame = bounds
        paper.contentMode = .scaleToFill
        guard let image = paper.image, bounds.width > 0, bounds.height > 0 else { return }
        let cover = max(bounds.width / image.size.width, (bounds.height+bottomExtension) / image.size.height)
        let width = bounds.width / (image.size.width * cover)
        let height = bounds.height / (image.size.height * cover)
        // background-size: cover; background-position: center top.
        paper.layer.contentsRect = CGRect(x: (1-width)/2, y: 0, width: width, height: height)
    }
    static func exitTransform(progress: Double, flip: Bool, releaseY: CGFloat = 0, releaseTilt: CGFloat = 0) -> CATransform3D {
        let t = min(1, max(0, progress))
        let first = t <= 0.18
        let local = first ? t/0.18 : (t-0.18)/0.82
        let eased = CGFloat(JimiV9Motion.Ease.cubicBezier(0.4,0,0.2,1).value(local))
        // y, z, rotateX, rotateY, scale, rotateZ; exact v10 keyframes.
        let frames: [[CGFloat]] = flip
            ? [[0,0,0,0,1,0],[-0.5,12,1.25,-7,1.008,0],[20,-188,-15,112,0,0]]
            : [[releaseY,0,0,0,1,releaseTilt],[releaseY-1,0,0,0,1.012,-0.25],[24,0,0,0,0,2]]
        let a = frames[first ? 0 : 1], b = frames[first ? 1 : 2]
        let v = zip(a,b).map { $0 + ($1-$0)*eased }
        var result = CATransform3DMakeTranslation(0,v[0],v[1])
        result = CATransform3DRotate(result,v[2] * .pi/180,1,0,0)
        result = CATransform3DRotate(result,v[3] * .pi/180,0,1,0)
        result = CATransform3DScale(result,v[4],v[4],v[4])
        return CATransform3DRotate(result,v[5] * .pi/180,0,0,1)
    }
    static func exit(_ target: UIView, flip: Bool, releaseY: CGFloat = 0, releaseTilt: CGFloat = 0, key: String) {
        let animation = CAKeyframeAnimation(keyPath: "transform")
        animation.duration = 0.65
        // Include the anticipation boundary exactly; linear interpolation between
        // dense component samples preserves the authored CSS angular trajectory.
        let times = (0...156).map { Double($0)/156 } + [0.18]
        let sorted = times.sorted()
        animation.keyTimes = sorted.map { NSNumber(value:$0) }
        animation.values = sorted.map { NSValue(caTransform3D:exitTransform(progress:$0,flip:flip,releaseY:releaseY,releaseTilt:releaseTilt)) }
        animation.calculationMode = .linear
        target.layer.transform = exitTransform(progress:1,flip:flip,releaseY:releaseY,releaseTilt:releaseTilt)
        target.layer.add(animation,forKey:key)
    }
}

/// Mirrors v10 modal-vertical-drag-dismiss: bounded edge resistance and finite spring return.
@MainActor
final class JimiNativeModalDrag: NSObject, UIGestureRecognizerDelegate {
    private weak var target: UIView?
    private weak var idle: UIView?
    private weak var viewport: UIView?
    private let canDrag: () -> Bool
    private let onDismiss: () -> Void
    private var startRect = CGRect.zero
    private var startY: CGFloat = 0
    private var owner = 0
    private var disposed = false
    private var dragging = false
    let pan: UIPanGestureRecognizer
    init(target:UIView,idle:UIView,viewport:UIView,canDrag:@escaping ()->Bool,onDismiss:@escaping ()->Void) {
        self.target = target;self.idle = idle;self.viewport = viewport;self.canDrag = canDrag;self.onDismiss = onDismiss
        pan = UIPanGestureRecognizer();super.init()
        pan.maximumNumberOfTouches = 1;pan.delegate = self;pan.addTarget(self,action:#selector(handle(_:)));target.addGestureRecognizer(pan)
    }
    static func resisted(_ delta:CGFloat,rect:CGRect,height:CGFloat)->CGFloat {
        guard height>0,rect.height>0 else{return delta}
        let available = delta<0 ? max(0,rect.minY) : max(0,height-rect.maxY)
        let limit = available*0.7,force = abs(delta)*0.72
        guard limit>0,force>0 else{return 0}
        return (delta<0 ? -1 : 1)*limit*force/(limit+force)
    }
    private func pauseIdle() {
        guard let layer = idle?.layer,layer.speed != 0 else{return}
        let now = layer.convertTime(CACurrentMediaTime(),from:nil);layer.speed = 0;layer.timeOffset = now
    }
    private func resumeIdle() {
        guard let layer = idle?.layer,layer.speed == 0 else{return}
        let paused = layer.timeOffset;layer.speed = 1;layer.timeOffset = 0;layer.beginTime = 0
        layer.beginTime = layer.convertTime(CACurrentMediaTime(),from:nil)-paused
    }
    func begin() {
        guard !disposed,canDrag(),let target,let viewport else{return}
        owner += 1;dragging = true
        let painted = target.layer.presentation()?.transform ?? target.layer.transform
        CATransaction.begin();CATransaction.setDisableActions(true)
        target.layer.transform = painted;target.layer.removeAnimation(forKey:"modal.drag.return")
        idle?.layer.removeAnimation(forKey:"modal.touch.return");CATransaction.commit()
        startY = painted.m42;startRect = target.convert(target.bounds,to:viewport).offsetBy(dx:0,dy:-startY)
        pauseIdle()
    }
    func move(_ delta:CGPoint) {
        guard !disposed,dragging,canDrag(),let target,let viewport else{return}
        let y = startY+Self.resisted(delta.y,rect:startRect,height:viewport.bounds.height)
        let tilt = max(-1.15,min(1.15,y/54)) * .pi/180
        var touch = CATransform3DIdentity;touch.m34 = -1/950
        touch = CATransform3DRotate(touch,max(-3.64*0.72,min(3.64*0.72,-delta.y/90*1.3)) * .pi/180,1,0,0)
        touch = CATransform3DRotate(touch,max(-3.64,min(3.64,delta.x/42*1.3)) * .pi/180,0,1,0)
        CATransaction.begin();CATransaction.setDisableActions(true)
        target.layer.transform = CATransform3DRotate(CATransform3DMakeTranslation(0,y,0),tilt,0,0,1)
        idle?.layer.sublayerTransform = touch;CATransaction.commit()
    }
    func finish(_ delta:CGPoint,cancelled:Bool) {
        guard !disposed,dragging,canDrag() else{return};dragging = false
        if !cancelled,abs(delta.y)>=96,abs(delta.y)>abs(delta.x)*1.15 {onDismiss();return}
        settle()
    }
    private func settle() {
        guard let target else{return};resumeIdle();owner += 1;let token = owner
        CATransaction.begin();CATransaction.setDisableActions(true)
        CATransaction.setCompletionBlock { [weak self] in guard let self,!self.disposed,self.owner == token else{return};self.resumeIdle() }
        for (layer,keyPath,key) in [(target.layer,"transform","modal.drag.return"),(idle?.layer,"sublayerTransform","modal.touch.return")] {
            guard let layer else{continue}
            let animation = CABasicAnimation(keyPath:keyPath)
            animation.fromValue = layer.presentation()?.value(forKeyPath:keyPath) ?? layer.value(forKeyPath:keyPath)
            animation.toValue = NSValue(caTransform3D:CATransform3DIdentity)
            animation.duration = UIAccessibility.isReduceMotionEnabled ? 0.001 : 0.28
            animation.timingFunction = CAMediaTimingFunction(controlPoints:0.34,1.56,0.64,1)
            layer.setValue(NSValue(caTransform3D:CATransform3DIdentity),forKeyPath:keyPath);layer.add(animation,forKey:key)
        }
        CATransaction.commit()
    }
    func cancel(preservePose:Bool = false) {
        owner += 1;dragging = false
        CATransaction.begin();CATransaction.setDisableActions(true)
        if preservePose,let target {target.layer.transform = target.layer.presentation()?.transform ?? target.layer.transform}
        target?.layer.removeAnimation(forKey:"modal.drag.return");idle?.layer.removeAnimation(forKey:"modal.touch.return")
        if !preservePose {target?.layer.transform = CATransform3DIdentity;idle?.layer.sublayerTransform = CATransform3DIdentity}
        CATransaction.commit();resumeIdle()
    }
    func dispose() {guard !disposed else{return};cancel();disposed = true;pan.view?.removeGestureRecognizer(pan)}
    func gestureRecognizerShouldBegin(_ gestureRecognizer:UIGestureRecognizer)->Bool {
        let velocity = pan.velocity(in:viewport)
        return !disposed && canDrag() && abs(velocity.y)>abs(velocity.x)*1.15
    }
    func gestureRecognizer(_ gestureRecognizer:UIGestureRecognizer,shouldReceive touch:UITouch)->Bool {
        var current = touch.view
        while let view = current {if view is UIControl {return false};current = view.superview}
        return !disposed && canDrag()
    }
    @objc private func handle(_ pan:UIPanGestureRecognizer) {
        let delta = pan.translation(in:viewport)
        switch pan.state {
        case .began:begin()
        case .changed:move(delta)
        case .ended:move(delta);finish(delta,cancelled:false)
        case .cancelled:finish(delta,cancelled:true)
        default:break
        }
    }
}

/// Presentation DTO only; game mode, save, pause and decisions stay canonical.
struct JimiNativeEndRunModel {
    let title: String, subtitle: String, restartLabel: String, exitLabel: String
    init?(_ value: [String: Any]) {
        guard let title = value["title"] as? String, let subtitle = value["subtitle"] as? String,
              let restart = value["restartLabel"] as? String, let exit = value["exitLabel"] as? String,
              [title,subtitle,restart,exit].allSatisfy({ !$0.isEmpty && $0.count <= 256 }) else { return nil }
        self.title = title; self.subtitle = subtitle; restartLabel = restart; exitLabel = exit
    }
}

@MainActor
final class JimiNativeEndRunModal: UIViewController {
    let requestID: Int
    let model: JimiNativeEndRunModel
    let card = UIView(), flip = JimiNativeModalTransformView(), idle = UIView(), paper = UIImageView()
    let heading = UILabel(), subtitle = UILabel(), close = JimiV9PlainButton(type:.custom)
    let backdrop = JimiV9PlainButton(type:.custom)
    let buttons = [JimiV9PlainButton(type:.custom),JimiV9PlainButton(type:.custom)]
    var onReady: (() -> Void)?
    var onAction: ((String) -> Void)?
    var onClosed: (() -> Void)?
    private var modalDrag: JimiNativeModalDrag?
    private var clickedButton: Int?
    private let assets: JimiV9Artwork
    private(set) var closing = false
    private var ready = false
    private var disposed = false
    init(id:Int,model:JimiNativeEndRunModel,assets:JimiV9Artwork) {
        requestID = id; self.model = model; self.assets = assets
        super.init(nibName:nil,bundle:nil); modalPresentationStyle = .overFullScreen
    }
    required init?(coder:NSCoder) { fatalError("Use init(id:model:assets:)") }
    override func viewDidLoad() {
        super.viewDidLoad();view.backgroundColor = .clear
        var camera = CATransform3DIdentity;camera.m34 = -1/920;view.layer.sublayerTransform = camera
        idle.layer.isDoubleSided = false
        backdrop.backgroundColor = UIColor(red:220/255,green:183/255,blue:163/255,alpha:0.52)
        backdrop.alpha = 0;backdrop.addTarget(self,action:#selector(requestClose),for:.touchUpInside);view.addSubview(backdrop)
        view.addSubview(card);card.addSubview(flip);flip.addSubview(idle);idle.addSubview(paper)
        card.layer.anchorPoint = CGPoint(x:0.5,y:0.55);flip.layer.anchorPoint = CGPoint(x:0.5,y:1);idle.layer.anchorPoint = CGPoint(x:0.5,y:0.52)
        card.alpha = 0;card.accessibilityIdentifier = "native.end-run"
        paper.image = assets.image("assets/modals/paper.png");paper.contentMode = .scaleToFill;paper.layer.cornerRadius = 40;paper.clipsToBounds = true
        idle.layer.shadowColor = UIColor(red:185/255,green:145/255,blue:119/255,alpha:1).cgColor
        idle.layer.shadowOpacity = 0.8;idle.layer.shadowOffset = CGSize(width:0,height:13);idle.layer.shadowRadius = 16.8
        let ink = UIColor(red:173/255,green:134/255,blue:117/255,alpha:1)
        heading.text = model.title;heading.font = assets.font(size:32,weight:"ExtraBold");heading.textColor = ink;heading.textAlignment = .center
        subtitle.text = model.subtitle;subtitle.font = assets.font(size:20,weight:"Medium");subtitle.textColor = UIColor(red:203/255,green:168/255,blue:154/255,alpha:1);subtitle.textAlignment = .center;subtitle.numberOfLines = 0
        let subtitleParagraph = NSMutableParagraphStyle();subtitleParagraph.alignment = .center
        subtitleParagraph.minimumLineHeight = 26;subtitleParagraph.maximumLineHeight = 26
        subtitle.attributedText = NSAttributedString(string:model.subtitle,attributes:[.font:subtitle.font as Any,.foregroundColor:subtitle.textColor as Any,.paragraphStyle:subtitleParagraph])
        idle.addSubview(heading);idle.addSubview(subtitle)
        for (i,button) in buttons.enumerated() {
            button.tag = i;button.setTitle(i == 0 ? model.restartLabel : model.exitLabel,for:.normal)
            button.titleLabel?.font = assets.font(size:28,weight:"Bold");button.layer.cornerRadius = 40
            button.backgroundColor = i == 0 ? UIColor(red:233/255,green:122/255,blue:85/255,alpha:1) : .white
            button.setTitleColor(i == 0 ? UIColor(red:1,green:251/255,blue:242/255,alpha:1) : ink,for:.normal)
            button.layer.shadowColor = (i == 0 ? UIColor(red:194/255,green:73/255,blue:33/255,alpha:1) : UIColor(red:216/255,green:199/255,blue:187/255,alpha:1)).cgColor
            button.layer.shadowOpacity = 1;button.layer.shadowOffset = CGSize(width:0,height:8);button.layer.shadowRadius = 0
            button.accessibilityIdentifier = i == 0 ? "native.end-run.restart" : "native.end-run.exit"
            if i == 1 {button.layer.borderWidth = 1;button.layer.borderColor = UIColor(red:234/255,green:222/255,blue:215/255,alpha:1).cgColor}
            button.addTarget(self,action:#selector(pressButton(_:)),for:.touchDown)
            button.addTarget(self,action:#selector(releaseButton(_:)),for:[.touchCancel,.touchUpOutside])
            button.addTarget(self,action:#selector(requestButton(_:)),for:.touchUpInside);idle.addSubview(button)
        }
        close.setBackgroundImage(paper.image,for:.normal);close.layer.cornerRadius = 26;close.clipsToBounds = true
        close.setImage(assets.image("assets/close-icon.png"),for:.normal);close.imageView?.contentMode = .scaleAspectFit
        close.imageEdgeInsets = UIEdgeInsets(top:12.5,left:12.5,bottom:12.5,right:12.5)
        close.accessibilityLabel = "Close "+model.title;close.accessibilityIdentifier = "native.end-run.close"
        close.addTarget(self,action:#selector(requestClose),for:.touchUpInside);idle.addSubview(close)
        modalDrag = JimiNativeModalDrag(target:card,idle:idle,viewport:view,canDrag:{[weak self] in guard let self else{return false};return self.ready && !self.closing && !self.disposed},onDismiss:{[weak self] in self?.requestClose()})
        view.isUserInteractionEnabled = false
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews();backdrop.frame = view.bounds
        let width = min(390,max(0,view.bounds.width-48)),height:CGFloat = 364
        card.bounds = CGRect(x:0,y:0,width:width,height:height);card.center = CGPoint(x:view.bounds.midX,y:view.bounds.midY+height*0.05)
        flip.bounds = card.bounds;flip.center = CGPoint(x:width/2,y:height)
        idle.bounds = card.bounds;idle.center = CGPoint(x:width/2,y:height*0.52);JimiNativeModalV10.paperLayout(paper,bounds:idle.bounds)
        heading.frame = CGRect(x:24,y:52,width:width-48,height:32)
        subtitle.frame = CGRect(x:24,y:92,width:width-48,height:52)
        for (i,button) in buttons.enumerated() {button.bounds = CGRect(x:0,y:0,width:249,height:64);button.center = CGPoint(x:width/2,y:216+CGFloat(i)*80)}
        close.frame = CGRect(x:width-42,y:-10,width:52,height:52)
    }
    private func pose(_ y:CGFloat,_ z:CGFloat,_ rx:CGFloat,_ ry:CGFloat,_ scale:CGFloat,_ rz:CGFloat = 0)->CATransform3D {
        var t = CATransform3DIdentity
        t = CATransform3DTranslate(t,0,y,z);t = CATransform3DRotate(t,rx * .pi/180,1,0,0);t = CATransform3DRotate(t,ry * .pi/180,0,1,0);t = CATransform3DRotate(t,rz * .pi/180,0,0,1)
        return CATransform3DScale(t,scale,scale,scale)
    }
    private func animate(_ target:UIView,_ poses:[CATransform3D],_ times:[NSNumber],exit:Bool) {
        let a = CAKeyframeAnimation(keyPath:"transform");a.values = poses.map{NSValue(caTransform3D:$0)};a.keyTimes = times;a.duration = 0.65
        let curve = exit ? CAMediaTimingFunction(controlPoints:0.4,0,0.2,1) : target === card ? CAMediaTimingFunction(controlPoints:0.22,1.18,0.36,1) : CAMediaTimingFunction(controlPoints:0.16,1,0.3,1)
        a.timingFunctions = Array(repeating:curve,count:poses.count-1);target.layer.add(a,forKey:exit ? "end-run-exit" : "end-run-enter")
    }
    override func viewDidAppear(_ animated:Bool) {
        super.viewDidAppear(animated);guard !disposed,!closing else{return};card.alpha = 1
        for (i,button) in buttons.enumerated() {
            track(button,JimiV9Motion.Track(tweens:[.init(begin:0.13+Double(i)*0.07,duration:0.34,from:.scale(0,y:18,opacity:0),to:.scale(1),ease:.backOut(1.8))]),key:"cta-enter")
        }
        if UIAccessibility.isReduceMotionEnabled { completeEnter();backdrop.alpha = 1;return }
        CATransaction.begin();CATransaction.setCompletionBlock{[weak self] in self?.completeEnter()}
        animate(card,[pose(88,0,0,0,0.72,-2),pose(-10,0,0,0,1.07,0.8),pose(4,0,0,0,0.98,-0.35),CATransform3DIdentity],[0,0.55,0.76,1],exit:false)
        animate(flip,[pose(88,-180,17,-88,0.72),CATransform3DIdentity],[0,1],exit:false)
        CATransaction.commit()
        UIView.animate(withDuration:0.5){self.backdrop.alpha = 1}
    }
    private func completeEnter() {
        guard !disposed,!closing,!ready else{return};ready = true;view.isUserInteractionEnabled = true;onReady?()
        guard !UIAccessibility.isReduceMotionEnabled else{return}
        let a = CAKeyframeAnimation(keyPath:"transform");a.duration = 6.8;a.repeatCount = .infinity
        a.keyTimes = [0,0.18,0.38,0.58,0.76,0.84,0.89,0.94,1]
        a.values = [pose(0,0,0,0,1),pose(-3,3,0,0,1.003),pose(0,0,0,0,1),pose(-3.75,4,0,0,1.004),pose(0,0,0,0,1),pose(-4,8,0,0,1.015),pose(1,0,0,0,0.995),pose(-1,3,0,0,1.006),pose(0,0,0,0,1)].map{NSValue(caTransform3D:$0)}
        idle.layer.add(a,forKey:"end-run-idle")
    }
    private func track(_ target:UIView,_ recipe:JimiV9Motion.Track,key:String) {
        guard !UIAccessibility.isReduceMotionEnabled else{return}
        let sample = JimiV9Motion.sampledTrack(recipe)
        let transform = CAKeyframeAnimation(keyPath:"transform");transform.duration = sample.duration
        transform.values = sample.poses.map{NSValue(caTransform3D:pose(CGFloat($0.y),0,0,0,CGFloat($0.scaleX)))}
        let alpha = CAKeyframeAnimation(keyPath:"opacity");alpha.duration = sample.duration;alpha.values = sample.poses.map{$0.opacity}
        if let last = sample.poses.last {target.layer.transform = pose(CGFloat(last.y),0,0,0,CGFloat(last.scaleX));target.layer.opacity = Float(last.opacity)}
        target.layer.add(transform,forKey:key);target.layer.add(alpha,forKey:key+"-opacity")
    }
    @objc private func pressButton(_ sender:UIButton) {
        guard ready,!closing,!disposed else{return}
        track(sender,.init(tweens:[.init(begin:0,duration:0.12,from:.scale(1),to:.scale(0.84,y:4),ease:.powerOut(2))]),key:"cta-press")
    }
    @objc private func releaseButton(_ sender:UIButton) {
        guard ready,!closing,!disposed else{return}
        sender.layer.removeAnimation(forKey:"cta-press")
        track(sender,.init(tweens:[.init(begin:0,duration:0.26,from:.scale(0.84,y:4),to:.scale(1),ease:.backOut(2.1))]),key:"cta-release")
    }
    func actionRejected() {if !disposed,!closing {modalDrag?.cancel();clickedButton = nil;for button in buttons {releaseButton(button)};view.isUserInteractionEnabled = ready}}
    private func request(_ action:String) {guard ready,!closing,!disposed else{return};view.isUserInteractionEnabled = false;onAction?(action)}
    @objc private func requestClose() {request("close")}
    @objc private func requestButton(_ sender:UIButton) {clickedButton = sender.tag;request(sender.tag == 0 ? "restart" : "exit")}
    func closeFromOwner() {
        guard !disposed,!closing else{return};modalDrag?.cancel(preservePose:true);closing = true;view.isUserInteractionEnabled = false
        if UIAccessibility.isReduceMotionEnabled {finishClose();return}
        CATransaction.begin();CATransaction.setCompletionBlock{[weak self] in self?.finishClose()}
        let order = clickedButton == 1 ? [1,0] : [0,1]
        for (position,i) in order.enumerated() {
            buttons[i].layer.removeAllAnimations()
            let from = JimiV9Motion.Pose.scale(clickedButton == i ? 0.84 : 1,y:clickedButton == i ? 4 : 0)
            track(buttons[i],.init(tweens:[.init(begin:Double(position)*0.07,duration:0.31,from:from,to:.scale(0,y:18,opacity:0),ease:.backIn(1.75))]),key:"cta-exit")
        }
        JimiNativeModalV10.exit(card,flip:false,releaseY:card.layer.presentation()?.transform.m42 ?? card.layer.transform.m42,releaseTilt:atan2(card.layer.transform.m12,card.layer.transform.m11)*180 / .pi,key:"end-run-exit")
        JimiNativeModalV10.exit(flip,flip:true,key:"end-run-exit")
        let fade = CAKeyframeAnimation(keyPath:"opacity");fade.values = [1,1,0];fade.keyTimes = [0,0.18,1];fade.duration = 0.65;fade.timingFunctions = Array(repeating:CAMediaTimingFunction(controlPoints:0.4,0,0.2,1),count:2);card.layer.opacity = 0;card.layer.add(fade,forKey:"end-run-fade")
        CATransaction.commit();UIView.animate(withDuration:0.2){self.backdrop.alpha = 0}
    }
    private func finishClose() {
        guard !disposed else{return}
        let receipt = onClosed;onClosed = nil
        dispose();dismiss(animated:false,completion:receipt)
    }
    func suspend() {modalDrag?.cancel(preservePose:true);let layer = view.layer;guard layer.speed != 0 else{return};let t = layer.convertTime(CACurrentMediaTime(),from:nil);layer.speed = 0;layer.timeOffset = t;view.isUserInteractionEnabled = false}
    func resume() {let layer = view.layer;guard layer.speed == 0,!disposed else{return};let t = layer.timeOffset;layer.speed = 1;layer.timeOffset = 0;layer.beginTime = 0;layer.beginTime = layer.convertTime(CACurrentMediaTime(),from:nil)-t;view.isUserInteractionEnabled = ready && !closing}
    func dispose() {guard !disposed else{return};modalDrag?.dispose();modalDrag = nil;disposed = true;onReady = nil;onAction = nil;onClosed = nil;for target in [card,flip,idle,close]+buttons {target.layer.removeAllAnimations()};viewIfLoaded?.layer.removeAllAnimations()}
    override func viewDidDisappear(_ animated:Bool) {super.viewDidDisappear(animated);dispose()}
}

@MainActor
final class JimiNativeEndRunHost {
    private weak var presenter: UIViewController?
    private weak var web: WKWebView?
    private let assets: JimiV9Artwork
    private(set) var modal: JimiNativeEndRunModal?
    init(presenter:UIViewController,web:WKWebView,assets:JimiV9Artwork) {self.presenter = presenter;self.web = web;self.assets = assets}
    func receive(_ event:[String:Any]) {
        guard let id = event["id"] as? Int,id>0,let command = event["command"] as? String else{return}
        if command == "present" {
            guard modal == nil,let presenter,presenter.presentedViewController == nil,
                  UIApplication.shared.applicationState == .active,
                  let dto = event["model"] as? [String:Any],let model = JimiNativeEndRunModel(dto) else {reply("rejected",id:id);return}
            let next = JimiNativeEndRunModal(id:id,model:model,assets:assets);modal = next
            next.onReady = {[weak self,weak next] in guard let self,let next,self.modal === next else{return};self.reply("ready",id:id)}
            next.onClosed = {[weak self,weak next] in
                guard let self,let next,self.modal === next else{return}
                self.modal = nil;self.reply("closed",id:id)
            }
            next.onAction = {[weak self,weak next] action in
                guard let self,let next,self.modal === next else{return}
                self.web?.callAsyncJavaScript("return window.__jimiNativeEndRun?.activate(id,action) === true",arguments:["id":id,"action":action],in:nil,in:.page){[weak self,weak next] result in
                    guard let self,let next,self.modal === next else{return}
                    if case .success(let value) = result,value as? Bool == true {} else {next.actionRejected()}
                }
            }
            presenter.present(next,animated:false)
        } else if let current = modal,current.requestID == id {
            if command == "close" {current.closeFromOwner()}
            else if command == "revoke" {current.dispose();current.dismiss(animated:false);modal = nil}
        }
    }
    private func reply(_ method:String,id:Int) {NSLog("[CC_NATIVE_END_RUN] %@ id=%d",method,id);web?.evaluateJavaScript("window.__jimiNativeEndRun?.\(method)(\(id))",completionHandler:nil)}
    func suspend() {modal?.suspend()}
    func resume() {modal?.resume()}
    func dispose() {modal?.dispose();modal?.dismiss(animated:false);modal = nil}
}
