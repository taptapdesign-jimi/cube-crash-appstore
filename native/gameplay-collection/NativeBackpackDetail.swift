import UIKit

/// One visible selected die; compositor playback stops at every visibility boundary.
@MainActor
final class NativeBackpackDetail:UIViewController {
    let die:NativeBackpackCatalog.Die
    private let assets:JimiV9Artwork,motion:NativeRouteMotion
    private let flip=JimiNativeModalTransformView(),idle=UIView()
    let card=UIView(),hero=UIImageView(),close=JimiV9PlainButton(type:.custom)
    private let paper=UIImageView(),heading=UILabel(),copy=UILabel(),backdrop=UIButton(type:.custom)
    let worldIllustration=UIImageView()
    private(set) var worldIllustrationPath:String?
    private var artworkAspect:CGFloat=1,artworkVisibleBounds=CGRect(x:0,y:0,width:1,height:1)
    private var closing=false,disposed=false,entered=false,foreground=true,preparingArtwork=false
    private(set) var preview:NativeBackpackDicePreview?
    private var artworkReady=false,presentationStarted=false
    private var modalDrag:JimiNativeModalDrag?
    private let fishOwnerFactory:((URL)->NativeFishIdleOwner)?
    var usesParentBackdrop=false
    var usesForestWorldIllustration=false
    var entersImmediately=false
    var onPresentationStarted:(()->Void)?
    var onClose:(()->Void)?
    var onExitSelection:((CGPoint)->Void)?
    private(set) var exitSelectionPress:UILongPressGestureRecognizer?
    var onCloseRequested:(()->Void)?
    init(die:NativeBackpackCatalog.Die,assets:JimiV9Artwork,motion:NativeRouteMotion,fishOwnerFactory:((URL)->NativeFishIdleOwner)?=nil){self.die=die;self.assets=assets;self.motion=motion;self.fishOwnerFactory=fishOwnerFactory;super.init(nibName:nil,bundle:nil);modalPresentationStyle = .overFullScreen}
    required init?(coder:NSCoder){fatalError("Use die initializer")}
    override func viewDidLoad(){
        super.viewDidLoad();view.backgroundColor = .clear
        var camera=CATransform3DIdentity;camera.m34 = -1/920;view.layer.sublayerTransform=camera
        card.addSubview(flip);flip.addSubview(idle);idle.layer.isDoubleSided=false
        card.layer.anchorPoint=CGPoint(x:0.5,y:0.55);flip.layer.anchorPoint=CGPoint(x:0.5,y:1);idle.layer.anchorPoint=CGPoint(x:0.5,y:0.52)
        let illustrationPath:String?
        if usesForestWorldIllustration,(1...10).contains(die.board) {
            illustrationPath="assets/journey assets/forest/forest world/forest\(Int.random(in:1...10)).png"
        } else {illustrationPath=nil}
        if let path=illustrationPath {
            worldIllustrationPath=path;worldIllustration.image=assets.image(path,densityAware:true)
            worldIllustration.alpha=0;worldIllustration.contentMode = .scaleAspectFit;worldIllustration.isUserInteractionEnabled=false
            worldIllustration.accessibilityIdentifier="native.backpack.detail.world-illustration"
            view.addSubview(worldIllustration)
        }
        backdrop.accessibilityIdentifier="native.backpack.detail.backdrop"
        backdrop.alpha=0;backdrop.backgroundColor=usesParentBackdrop ? .clear:JimiNativeModalV10.backdropColor;backdrop.addTarget(self,action:#selector(closeTapped),for:.touchUpInside);view.addSubview(backdrop);view.addSubview(card)
        paper.image=assets.image("assets/modals/paper.png");paper.layer.cornerRadius=40;paper.clipsToBounds=true;paper.accessibilityIdentifier="native.backpack.detail.paper";idle.addSubview(paper)
        idle.layer.shadowColor=UIColor(red:185/255,green:145/255,blue:119/255,alpha:1).cgColor;idle.layer.shadowOpacity=die.id=="baloon" ? 0:0.8;idle.layer.shadowOffset=CGSize(width:0,height:13);idle.layer.shadowRadius=16.8
        heading.textAlignment = .center;heading.font=assets.font(size:30,weight:"ExtraBold");heading.textColor=NativeBackpackCellPalette.ink
        let title=NSMutableAttributedString(string:die.title)
        if let space=die.title.firstIndex(of:" ") {
            title.addAttribute(.foregroundColor,value:UIColor(red:232/255,green:116/255,blue:74/255,alpha:1),range:NSRange(die.title.startIndex..<space,in:die.title))
        }
        heading.attributedText=title
        copy.attributedText=NativeModalTypography.attributedSubtitle(die.copy,font:assets.font(size:20,weight:"Medium"));copy.numberOfLines=0;copy.textAlignment = .center;copy.font=assets.font(size:20,weight:"Medium");copy.textColor=NativeTextPalette.subtitle
        hero.image=assets.image(die.id=="barell" ? "assets/shop/barell/barell.png":die.artwork.path,densityAware:true);hero.contentMode = .scaleAspectFit
        if let image=hero.image {artworkAspect=image.size.width/image.size.height;artworkVisibleBounds=Self.visibleArtworkBounds(image)}
        [heading,copy,hero,close].forEach{idle.addSubview($0)}
        close.setBackgroundImage(paper.image,for:.normal);close.clipsToBounds=true;close.layer.cornerRadius=26;close.setImage(assets.image("assets/close-icon.png"),for:.normal);close.imageView?.contentMode = .scaleAspectFit;close.artworkOpacity = 0.8;close.enableArtworkTapFeedback();close.imageEdgeInsets=UIEdgeInsets(top:14,left:14,bottom:14,right:14);close.addTarget(self,action:#selector(closeTapped),for:.touchUpInside);close.accessibilityLabel="Close dice details";close.accessibilityIdentifier="native.backpack.detail.close"
        modalDrag=JimiNativeModalDrag(target:card,idle:idle,viewport:view,canDrag:{[weak self] in guard let self else{return false};return self.foreground && self.entered && self.card.isUserInteractionEnabled && !self.closing && !self.disposed},onDismiss:{[weak self] in self?.closeTapped()})
        card.accessibilityIdentifier="native.backpack.detail";card.alpha=0;card.isUserInteractionEnabled=false;view.accessibilityViewIsModal=true
        let exitTap=UILongPressGestureRecognizer(target:self,action:#selector(exitSelectionPressed(_:)))
        exitTap.minimumPressDuration=0;exitTap.isEnabled=false;view.addGestureRecognizer(exitTap);exitSelectionPress=exitTap
        prepareArtwork()
    }
    override func viewDidLayoutSubviews(){
        super.viewDidLayoutSubviews();backdrop.frame=view.bounds
        worldIllustration.frame=view.bounds.insetBy(dx:-view.bounds.width*0.2,dy:0)
        let width=min(390,max(0,view.bounds.width-48)),scale=width/390
        heading.font=assets.font(size:32,weight:"ExtraBold");copy.font=assets.font(size:20,weight:"Medium")
        heading.frame=CGRect(x:width*0.1,y:28,width:width*0.8,height:38.4)
        let copyHeight=ceil(copy.sizeThatFits(CGSize(width:width*0.8,height:CGFloat.greatestFiniteMagnitude)).height)
        copy.frame=CGRect(x:width*0.1,y:heading.frame.maxY+12,width:width*0.8,height:copyHeight)
        let subtitleGap:CGFloat=48
        // House the floor shadow and lower paper inset.
        let bottomGap:CGFloat=96
        let artworkOffset:CGFloat=die.id=="beach-ball" ? -32:die.id=="wild-star" ? -24:die.id=="spaceship" ? -16:0
        let availableHeight=max(0,view.bounds.height-view.safeAreaInsets.top-view.safeAreaInsets.bottom-40)
        let artworkSpace=max(0,availableHeight-copy.frame.maxY-subtitleGap-bottomGap)
        let envelopeRatio=preview?.presentationHeightRatio ?? 1
        let artworkScale:CGFloat=die.id=="cubero" ? 1.33:die.id=="wild-magnet" ? 0.8:die.id=="laser-gun" ? 1.15:(11...20).contains(die.board) ? 0.9:1
        let artworkHeight=min(min(180*artworkScale,artworkSpace/envelopeRatio)/artworkVisibleBounds.height,(width-40*scale)*artworkScale/artworkAspect)
        hero.bounds=CGRect(x:0,y:0,width:artworkHeight*artworkAspect,height:artworkHeight)
        let visibleHeight=hero.bounds.height*artworkVisibleBounds.height
        let envelopeHeight=visibleHeight*envelopeRatio
        let artworkTop=copy.frame.maxY+subtitleGap+artworkOffset
        hero.center=CGPoint(x:width/2-(artworkVisibleBounds.midX-0.5)*hero.bounds.width,
                            y:artworkTop+envelopeHeight/2-(artworkVisibleBounds.midY-0.5)*hero.bounds.height)
        let height=artworkTop+envelopeHeight+bottomGap
        card.bounds=CGRect(x:0,y:0,width:width,height:height);card.center=CGPoint(x:view.bounds.midX,y:view.bounds.midY)
        flip.bounds=card.bounds;flip.center=CGPoint(x:width/2,y:height);idle.bounds=card.bounds;idle.center=CGPoint(x:width/2,y:height*0.52)
        // Crop the folded source edge below the rounded card, at every content height.
        JimiNativeModalV10.paperLayout(paper,bounds:card.bounds,bottomExtension:96)
        if let preview {
            preview.frame=idle.bounds
            preview.artworkFrame=CGRect(x:0,y:artworkTop,width:width,height:envelopeHeight)
            preview.layoutArtwork()
        }
        close.frame=CGRect(x:width-42,y:-10,width:52,height:52)
    }
    /// Read once from a bounded preview of the original PNG. Transparent
    /// margins must not make a nominal 180pt hero visibly smaller.
    static func visibleHeightRatio(_ image:UIImage)->CGFloat {visibleArtworkBounds(image).height}
    static func visibleArtworkBounds(_ image:UIImage)->CGRect {NativeArtworkAlphaBounds.measure(image)}
    override func viewDidAppear(_ animated:Bool){
        super.viewDidAppear(animated);guard !entersImmediately,!entered,!disposed else{return};entered=true;beginPresentationIfReady()
    }
    /// Start the scoped exchange only after UIKit attaches the presentation.
    /// Animations installed on a detached modal can be consumed during attachment.
    func beginImmediatePresentation(){
        guard entersImmediately,!disposed else{return}
        entered=true;beginPresentationIfReady()
    }
    private func beginPresentationIfReady(){
        guard entered,(artworkReady || entersImmediately),foreground,!presentationStarted,!disposed,!closing else{return}
        presentationStarted=true
        view.setNeedsLayout();view.layoutIfNeeded()
        // Install selected animation before the first visible modal frame.
        animateHero();onPresentationStarted?();card.alpha=1
        if UIAccessibility.isReduceMotionEnabled {completeEnter();backdrop.alpha=1;if usesForestWorldIllustration {worldIllustration.alpha=1};return}
        CATransaction.begin();CATransaction.setCompletionBlock{[weak self] in self?.completeEnter()}
        JimiNativeModalV10.enter(card:card,flip:flip,key:"backpack.detail.enter")
        CATransaction.commit();UIView.animate(withDuration:0.5){self.backdrop.alpha=1;if self.usesForestWorldIllustration {self.worldIllustration.alpha=1}}
    }
    private func completeEnter(){guard !disposed,!closing else{return};card.isUserInteractionEnabled=true;JimiNativeModalV10.startIdle(on:idle,key:"backpack.detail.idle")}
    private func animateHero(){
        preview?.setActive(foreground && presentationStarted && !closing && !disposed)
    }
    private func prepareArtwork(){
        guard !preparingArtwork else{return};preparingArtwork=true
        let selected=NativeBackpackDicePreview(die:die,root:assets.resourceRoot,referenceBounds:artworkVisibleBounds,fishOwnerFactory:fishOwnerFactory)
        preview=selected;idle.insertSubview(selected,belowSubview:heading)
        // SKView owns its internal render surfaces. Keep the UIKit shadow on
        // the modal compositor plane, in the same coordinates as the preview.
        if let shadow=selected.groundShadow {
            // Coconut's opening shell descends across the floor footprint.
            // Establish the rear plane before readiness/entry paints any frame.
            if ["honey","coconut"].contains(die.id) {idle.insertSubview(shadow,belowSubview:selected)}
            else {idle.insertSubview(shadow,aboveSubview:selected)}
        }
        if let rear=selected.rearCanShadow {idle.insertSubview(rear,aboveSubview:selected)}
        selected.setPreparationForeground(foreground)
        selected.onReady={[weak self,weak selected] in
            guard let self,let selected,self.preview === selected,!self.disposed,!self.closing else{return}
            self.hero.isHidden=true;self.artworkReady=true;self.view.setNeedsLayout();self.view.layoutIfNeeded();self.beginPresentationIfReady();self.animateHero()
        }
        if selected.ready {selected.onReady?()}
    }
    @objc func closeTapped(){
        guard foreground,!closing,!disposed,card.isUserInteractionEnabled else{return}
        close.playArtworkTapFeedback()
        modalDrag?.cancel(preservePose:true);closing=true;exitSelectionPress?.isEnabled=true;card.isUserInteractionEnabled=false;hero.layer.removeAllAnimations();preview?.setActive(false,retainMediaUntilDisposal:true);onCloseRequested?()
        if UIAccessibility.isReduceMotionEnabled {finishClose();return}
        CATransaction.begin();CATransaction.setCompletionBlock{[weak self] in self?.finishClose()}
        let painted=card.layer.presentation()?.transform ?? card.layer.transform
        JimiNativeModalV10.exit(card,flip:false,releaseY:painted.m42,releaseTilt:atan2(painted.m12,painted.m11)*180 / .pi,key:"backpack.detail.exit")
        JimiNativeModalV10.exit(flip,flip:true,key:"backpack.detail.exit")
        let fade=CAKeyframeAnimation(keyPath:"opacity");fade.values=[1,1,0];fade.keyTimes=[0,0.18,1];fade.duration=0.65;card.layer.opacity=0;card.layer.add(fade,forKey:"backpack.detail.fade")
        CATransaction.commit();UIView.animate(withDuration:0.2){self.backdrop.alpha=0;if self.usesForestWorldIllustration {self.worldIllustration.alpha=0}}
    }
    @objc private func exitSelectionPressed(_ gesture:UILongPressGestureRecognizer){
        guard gesture.state == .began else{return}
        captureExitSelection(atWindowPoint:gesture.location(in:view.window))
    }
    func captureExitSelection(atWindowPoint point:CGPoint){
        guard closing,foreground,!disposed,let window=view.window else{return}
        if let painted=card.layer.presentation(),painted.opacity>0.05,
           painted.bounds.contains(painted.convert(point,from:window.layer.presentation() ?? window.layer)) {return}
        onExitSelection?(point)
    }
    private func finishClose(){guard !disposed else{return};let callback=onClose;dispose();dismiss(animated:false,completion:callback)}
    func setForeground(_ active:Bool){
        guard !disposed else{return}
        if !active {modalDrag?.cancel()}
        foreground=active;exitSelectionPress?.isEnabled=active && closing
        preview?.setPreparationForeground(active)
        let layer=view.layer
        if active {
            if layer.speed==0 {let paused=layer.timeOffset;layer.speed=1;layer.timeOffset=0;layer.beginTime=0;layer.beginTime=layer.convertTime(CACurrentMediaTime(),from:nil)-paused}
            motion.resume();beginPresentationIfReady();animateHero()
        }else{
            if layer.speed != 0 {layer.timeOffset=layer.convertTime(CACurrentMediaTime(),from:nil);layer.speed=0}
            motion.suspend();hero.layer.removeAllAnimations();preview?.setActive(false)
        }
    }
    func dispose(){guard !disposed else{return};modalDrag?.dispose();modalDrag=nil;disposed=true;exitSelectionPress.map{view.removeGestureRecognizer($0)};exitSelectionPress=nil;onExitSelection=nil;motion.cancel();[card,flip,idle,hero,worldIllustration].forEach{$0.layer.removeAllAnimations()};hero.image=nil;worldIllustration.image=nil;worldIllustration.removeFromSuperview();preview?.dispose();preview?.removeFromSuperview();preview=nil;assets.retireImagePreparation();onClose=nil;onCloseRequested=nil;onPresentationStarted=nil}
}
private enum NativeBackpackCellPalette {static let ink=UIColor(red:173/255,green:134/255,blue:117/255,alpha:1)}
