import UIKit
import CoreImage

/// Native tutorial result cover. Continue is a receipt; the caller releases paper only after the destination owns the surface.
@MainActor
final class NativeTutorialCompleteController: UIViewController {
    enum Phase: Equatable { case entering, ready, leaving, continued, disposed }
    private(set) var phase: Phase = .entering
    var onContinue: (() -> Void)?
    var onCancelled: (() -> Void)?
    /// The application's existing audio/haptic owner handles these authored moments.
    var onMoment: ((String,Int) -> Void)?
    private let artwork: JimiV9Artwork
    private let titleLabel = UILabel(), subtitleLabel = UILabel(), thumb = UIImageView(), shadow = UIImageView()
    let visualUnit = UIView()
    private var shadowSize = CGSize.zero
    private var exitPoses:[ObjectIdentifier:NativeTutorialCompletePose]=[:]
    private var motionGroups:[[UIView]]{[[titleLabel],[subtitleLabel],[thumb,shadow],[button]]}
    private var stagger:Double{reducedMotion ? 0.015:0.03}
    private var enterDuration:Double{(reducedMotion ? 0.12:0.65)+stagger*3}
    private var exitDuration:Double{(reducedMotion ? 0.12:JimiV9Motion.homeExit(.hero).duration)+stagger*3}
    private let button = JimiV9PlainButton(type: .custom)
    private let paper:NativeAppPaperSurface
    private var motion: NativeTutorialCompleteMotion?
    private var disposed = false
    private var reducedMotion: Bool
    private var suspended = false
    private let lease = UUID()
    private var sentMoments = Set<Int>()
    private var observations: [NSObjectProtocol] = []
    init(resourceRoot: URL, title: String = "Congrats!", subtitle: String = "You cleared the stage.", reducedMotion: Bool? = nil) {
        artwork = JimiV9Artwork(resourceRoot: resourceRoot); self.reducedMotion = reducedMotion ?? UIAccessibility.isReduceMotionEnabled
        paper=NativeAppPaperSurface(artwork:artwork,textureBottomExtension:64)
        super.init(nibName: nil,bundle: nil)
        titleLabel.text = title; subtitleLabel.text = subtitle
        modalPresentationStyle = .overFullScreen
    }
    required init?(coder: NSCoder) { fatalError("Use native tutorial completion initializer") }
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red:243/255,green:238/255,blue:232/255,alpha:1)
        paper.autoresizingMask = [.flexibleWidth,.flexibleHeight]; view.addSubview(paper)
        titleLabel.textAlignment = .center; titleLabel.numberOfLines = 0
        titleLabel.textColor = UIColor(red:239/255,green:116/255,blue:77/255,alpha:1)
        subtitleLabel.textAlignment = .center; subtitleLabel.numberOfLines = 0
        subtitleLabel.textColor = NativeTextPalette.subtitle
        thumb.image = artwork.image("assets/thumbs-up@2x.png"); thumb.contentMode = .scaleAspectFit
        thumb.layer.anchorPoint = CGPoint(x:0.5,y:0.74)
        shadow.contentMode = .scaleToFill
        view.addSubview(visualUnit)
        button.setTitle("Continue",for:.normal);button.applyModalCTA(artwork:artwork)
        button.accessibilityIdentifier = "native.tutorial-complete.continue"
        button.addTarget(self,action:#selector(continueTapped),for:.touchUpInside)
        for item in [shadow,thumb,titleLabel,subtitleLabel,button] { visualUnit.addSubview(item) }
        button.isUserInteractionEnabled = false
        for (name,value) in [(UIApplication.willResignActiveNotification,true),(UIApplication.didBecomeActiveNotification,false)] {
            observations.append(NotificationCenter.default.addObserver(forName:name,object:nil,queue:.main) { [weak self] _ in MainActor.assumeIsolated { self?.setSuspended(value) } })
        }
        sampleEnter(seconds:0)
    }
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard motion == nil, phase == .entering, !disposed else { return }
        runMotion(duration:enterDuration,paint:{ [weak self] seconds in self?.sampleEnter(seconds:seconds) }) { [weak self] in
            guard let self,!self.disposed,self.phase == .entering else { return }
            self.phase = .ready; self.button.isUserInteractionEnabled = !self.suspended
            if !self.reducedMotion { self.runIdle() }
        }
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let width = view.bounds.width, height = view.bounds.height, compact = height <= 760
        paper.frame = view.bounds
        visualUnit.bounds=view.bounds;visualUnit.center=CGPoint(x:width/2,y:height*0.54)
        visualUnit.layer.anchorPoint=CGPoint(x:0.5,y:0.54)
        let top: CGFloat = compact ? 58 : min(150,max(92,height*0.15))
        let titleSize = min(64,max(44,width*0.094)), subtitleSize = min(32,max(23,width*0.051))
        titleLabel.font = artwork.font(size:titleSize,weight:"ExtraBold")
        subtitleLabel.font = artwork.font(size:subtitleSize,weight:"SemiBold")
        titleLabel.bounds = CGRect(x:0,y:0,width:width-48,height:titleSize*0.95+8)
        titleLabel.center = CGPoint(x:width/2,y:top-16+titleLabel.bounds.height/2)
        subtitleLabel.bounds = CGRect(x:0,y:0,width:width-48,height:subtitleSize*1.2+8)
        subtitleLabel.center = CGPoint(x:width/2,y:titleLabel.center.y+titleLabel.bounds.height/2+26+subtitleLabel.bounds.height/2)
        let margin = compact ? CGFloat(42) : min(132,max(76,height*0.15))
        let heroSize = compact ? min(width*0.58,320) : min(width*0.68,420)
        let heroTop = subtitleLabel.center.y+subtitleLabel.bounds.height/2+margin-24
        thumb.bounds = CGRect(x:0,y:0,width:heroSize,height:heroSize)
        thumb.layer.position = CGPoint(x:width/2,y:heroTop-16+heroSize*0.74)
        let shadowHeight = heroSize*0.18
        let size=CGSize(width:heroSize*0.76,height:shadowHeight)
        if shadowSize != size {shadowSize=size;shadow.image=Self.makeShadow(size:size)}
        shadow.bounds = CGRect(x:0,y:0,width:size.width+72,height:size.height+72)
        shadow.center = CGPoint(x:width/2,y:heroTop+heroSize+heroSize*0.03+24-shadowHeight/2)

        let gap = compact ? CGFloat(30) : min(82,max(44,height*0.07))
        let buttonWidth = min(width*0.68,408), bottom = heroTop+heroSize+gap+48
        button.bounds = CGRect(x:0,y:0,width:buttonWidth,height:64)
        button.center = CGPoint(x:width/2,y:min(bottom+32,height-max(42,view.safeAreaInsets.bottom)-32))
    }
    /// The pure sampled enter timeline is shared by runtime and deterministic UIKit tests.
    func sampleEnter(seconds: Double) {
        guard !disposed,phase == .entering else { return }
        let time=seconds
        for (index,group) in motionGroups.enumerated() {
            let delay=Double(index)*stagger,duration=reducedMotion ? 0.12:0.65
            for target in group {
                pose(target,time:time,begin:delay,duration:duration,from:.scale(reducedMotion ? 0.96:0,opacity:0),to:.init(),ease:reducedMotion ? .powerOut(2):JimiV9Motion.homeEnterEase)
            }
        }
        button.isUserInteractionEnabled = seconds >= enterDuration && !suspended
        let momentTime=reducedMotion ? seconds*0.9/enterDuration:seconds
        for (index,delay) in [0.0,0.15,0.3,0.45,0.6].enumerated() where momentTime >= delay && !sentMoments.contains(index) {
            sentMoments.insert(index); onMoment?(index % 2 == 0 ? "tutorial-complete-medium" : "tutorial-complete-light",index)
        }
    }
    private func runIdle() {
        guard !disposed,phase == .ready,!reducedMotion else { return }
        let thumbAnimation = CAKeyframeAnimation(keyPath:"transform")
        thumbAnimation.duration = 1.42; thumbAnimation.autoreverses = true; thumbAnimation.repeatCount = .infinity
        thumbAnimation.values = (0...170).map { index -> NSValue in
            let p = 0.5-0.5*cos(Double(index)/170*Double.pi)
            var transform = CATransform3DMakeTranslation(0,-10*p,0)
            transform = CATransform3DRotate(transform,-1.2*Double.pi/180*p,0,0,1)
            transform = CATransform3DScale(transform,1+0.018*p,1+0.018*p,1)
            return NSValue(caTransform3D:transform)
        }
        thumbAnimation.calculationMode = .linear
        thumb.layer.add(thumbAnimation,forKey:"tutorial.complete.thumb.idle")
        let shadowTransform = CAKeyframeAnimation(keyPath:"transform")
        shadowTransform.duration = 1.42; shadowTransform.autoreverses = true; shadowTransform.repeatCount = .infinity
        shadowTransform.values = (0...170).map { index -> NSValue in
            let p = 0.5-0.5*cos(Double(index)/170*Double.pi)
            return NSValue(caTransform3D:CATransform3DMakeScale(1-0.14*p,1-0.18*p,1))
        }
        shadowTransform.calculationMode = .linear
        let alpha = CAKeyframeAnimation(keyPath:"opacity")
        alpha.duration = 1.42; alpha.autoreverses = true; alpha.repeatCount = .infinity
        alpha.values = (0...170).map { 1-0.28*(0.5-0.5*cos(Double($0)/170*Double.pi)) }
        alpha.calculationMode = .linear
        shadow.layer.add(shadowTransform,forKey:"tutorial.complete.shadow.transform")
        shadow.layer.add(alpha,forKey:"tutorial.complete.shadow.opacity")
    }
    private func retireIdle() {
        func snapshot(_ target:UIView) -> NativeTutorialCompletePose {
            let transform = target.layer.presentation().map { CATransform3DGetAffineTransform($0.transform) } ?? target.transform
            let alpha = target.layer.presentation().map { Double($0.opacity) } ?? target.alpha
            let pose = NativeTutorialCompletePose(x:transform.tx,y:transform.ty,scaleX:hypot(transform.a,transform.b),scaleY:hypot(transform.c,transform.d),rotation:atan2(transform.b,transform.a)*180/Double.pi,opacity:alpha)
            target.layer.removeAllAnimations(); target.transform = transform; target.alpha = alpha
            return pose
        }
        _ = snapshot(thumb); _ = snapshot(shadow)
    }
    @objc private func continueTapped() { requestContinue() }
    func requestContinue() {
        guard !disposed,!suspended,(phase == .ready || phase == .entering && button.isUserInteractionEnabled) else { return }
        phase = .leaving; button.isUserInteractionEnabled = false; onMoment?("tutorial-complete-selection",0)
        cancelMotion(); retireIdle()
        for target in motionGroups.flatMap({$0}) {
            let transform=target.transform
            exitPoses[ObjectIdentifier(target)] = .init(x:transform.tx,y:transform.ty,scaleX:hypot(transform.a,transform.b),scaleY:hypot(transform.c,transform.d),rotation:atan2(transform.b,transform.a)*180/Double.pi,opacity:target.alpha)
        }
        let duration=exitDuration
        runMotion(duration:duration,paint:{[weak self] time in self?.sampleElementExit(seconds:time)}) { [weak self] in
            guard let self,!self.disposed,self.phase == .leaving else{return}
            self.phase = .continued
            let receipt=self.onContinue;self.onContinue=nil;self.onCancelled=nil;self.onMoment=nil
            receipt?() // Paper stays opaque until the destination owns its cover.
        }
    }
    func sampleElementExit(seconds: Double) {
        guard !disposed,phase == .leaving else{return}
        for (index,group) in motionGroups.enumerated() {
            let time=max(0,seconds-Double(index)*stagger)
            for target in group {
                guard let base=exitPoses[ObjectIdentifier(target)] else{continue}
                if reducedMotion {target.alpha=base.opacity*(1-min(1,time/0.12));continue}
                let sampled=JimiV9Motion.homeExit(.hero).pose(at:time)
                target.transform=CGAffineTransform(translationX:base.x,y:base.y).rotated(by:base.rotation*Double.pi/180).scaledBy(x:base.scaleX*sampled.scaleX,y:base.scaleY*sampled.scaleY)
                target.alpha=time >= JimiV9Motion.homeExit(.hero).duration ? 0:base.opacity
            }
        }
    }
    /// PWA radial-gradient stops and blur(12px), prepared only on layout-size change.
    private static func makeShadow(size:CGSize)->UIImage? {
        let padding:CGFloat=36,canvas=CGSize(width:size.width+padding*2,height:size.height+padding*2)
        let format=UIGraphicsImageRendererFormat();format.scale=1;format.opaque=false
        let image=UIGraphicsImageRenderer(size:canvas,format:format).image{renderer in
            let context=renderer.cgContext
            context.translateBy(x:canvas.width/2,y:canvas.height/2)
            context.scaleBy(x:size.width/2,y:size.height/2)
            let colors=[CGFloat(0.34),0.2,0].map{UIColor(red:185/255,green:105/255,blue:62/255,alpha:$0).cgColor}
            guard let gradient=CGGradient(colorsSpace:CGColorSpaceCreateDeviceRGB(),colors:colors as CFArray,locations:[0,0.42,0.76]) else{return}
            context.drawRadialGradient(gradient,startCenter:.zero,startRadius:0,endCenter:.zero,endRadius:1,options:[])
        }
        guard let input=CIImage(image:image),let filter=CIFilter(name:"CIGaussianBlur") else{return image}
        filter.setValue(input,forKey:kCIInputImageKey);filter.setValue(12,forKey:kCIInputRadiusKey)
        guard let output=filter.outputImage,let rendered=CIContext(options:[.useSoftwareRenderer:true]).createCGImage(output,from:input.extent) else{return image}
        return UIImage(cgImage:rendered)
    }
    private func pose(_ target: UIView,time: Double,begin: Double,duration: Double,from: NativeTutorialCompletePose,to: NativeTutorialCompletePose,ease: JimiV9Motion.Ease) {
        let sampled = from.interpolated(to:to,progress:ease.value((time-begin)/duration))
        target.alpha = sampled.opacity
        target.transform = CGAffineTransform(translationX:sampled.x,y:sampled.y).rotated(by:sampled.rotation*Double.pi/180).scaledBy(x:sampled.scaleX,y:sampled.scaleY)
    }
    private func runMotion(duration: Double,paint: @escaping (Double) -> Void,finished: @escaping () -> Void) {
        cancelMotion()
        let owner = NativeTutorialCompleteMotion(viewport:view.bounds.size,duration:duration,sample:paint)
        motion = owner; owner.onFinished = { [weak self,weak owner] success in
            guard let self,self.motion === owner else { return }; self.motion = nil
            if success,!self.disposed { finished() }
        }
        view.addSubview(owner); owner.start(); owner.setSuspended(suspended)
    }
    private func cancelMotion() { let previous = motion; motion = nil; previous?.dispose() }
    func setSuspended(_ value: Bool) {
        suspended = value; motion?.setSuspended(value); button.isUserInteractionEnabled = !value && phase == .ready
        if value,view.layer.speed != 0 { view.layer.timeOffset = view.layer.convertTime(CACurrentMediaTime(),from:nil); view.layer.speed = 0 }
        else if !value,view.layer.speed == 0 { let offset = view.layer.timeOffset; view.layer.speed = 1; view.layer.timeOffset = 0; view.layer.beginTime = 0; view.layer.beginTime = view.layer.convertTime(CACurrentMediaTime(),from:nil)-offset }
    }
    func captureCoverCleanup() -> () -> Void {
        let captured = lease
        return { [weak self] in guard let self,self.lease == captured else { return }; self.dispose(); self.dismiss(animated:false) }
    }
    func dispose() {
        guard !disposed else { return }; disposed = true
        let cancelled = phase != .continued ? onCancelled : nil
        phase = .disposed; cancelMotion(); retireIdle(); button.isUserInteractionEnabled = false
        observations.forEach(NotificationCenter.default.removeObserver); observations.removeAll()
        onContinue = nil; onCancelled = nil; onMoment = nil
        cancelled?()
    }
}

@MainActor
private final class NativeTutorialCompleteMotion: NativeFinitePresentation {
    let sample: (Double) -> Void
    init(viewport: CGSize,duration: Double,sample: @escaping (Double) -> Void) { self.sample = sample; super.init(viewport:viewport,duration:duration) }
    required init?(coder: NSCoder) { fatalError("Use native motion initializer") }
    override func paint(seconds: TimeInterval) { sample(seconds) }
}

private struct NativeTutorialCompletePose {
    var x = 0.0, y = 0.0, scaleX = 1.0, scaleY = 1.0, rotation = 0.0, opacity = 1.0
    static func scale(_ value:Double,y:Double = 0,opacity:Double = 1) -> Self { Self(y:y,scaleX:value,scaleY:value,opacity:opacity) }
    func interpolated(to other:Self,progress:Double) -> Self {
        func blend(_ a:Double,_ b:Double) -> Double { a+(b-a)*progress }
        return Self(x:blend(x,other.x),y:blend(y,other.y),scaleX:blend(scaleX,other.scaleX),scaleY:blend(scaleY,other.scaleY),rotation:blend(rotation,other.rotation),opacity:blend(opacity,other.opacity))
    }
}
