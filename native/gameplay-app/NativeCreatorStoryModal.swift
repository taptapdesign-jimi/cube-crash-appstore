import UIKit

/// Settings and Story borrow selected artwork from the existing cache.
@MainActor
enum NativeCreatorStoryArtwork {
    static let path = "assets/ui/creator-story/jimi-nala.png"
    static let storyPath = "assets/tutorial/aboutus.png"
    static func heart(assets:JimiV9Artwork)->UIImage? {
        guard let source=assets.image(path),let image=source.cgImage else{return nil}
        let x=CGFloat(image.width)/1572,y=CGFloat(image.height)/1001
        let rect=CGRect(x:850*x,y:80*y,width:230*x,height:212*y).integral
        guard let crop=image.cropping(to:rect) else{return nil}
        return UIImage(cgImage:crop,scale:source.scale,orientation:.up)
    }
}

/// One read-only paper composition owns its foreground phase and retirement.
@MainActor
final class NativeCreatorStoryModal:UIViewController {
    static let paragraphs = [
        "Hi, I’m Igor “Jimi” Ivankovic, a designer and game creator from Croatia. That’s me with my trusty companion Nala, my dog and supervisor. She mostly sleeps on the job.",
        "I first had the idea for this game nearly ten years ago. Bringing it to life took a year of late nights and endless tweaks. What a journey it’s been!",
        "Fun fact: It all started with the Star."
    ]
    var onCloseRequested:(()->Void)?
    var onClosed:(()->Void)?
    let card=UIView(),flip=JimiNativeModalTransformView(),tilt=UIView(),idle=UIView()
    let paper=NativeModalPaperView(),heading=UILabel(),copy=UITextView()
    let fact=UIView(),factLabel=UILabel(),factDivider=UIView()
    let inlineStar=CALayer()
    static let inlineStarKey="creator.star.frames"
    lazy var factPaper=NativeSettingsPaperSurface(image:assets.image("assets/modals/paper.png",densityAware:true))
    let artworkEntry=UIView(),storyArtwork=UIImageView()
    static let idleKey="creator.idle"
    let close=JimiV9PlainButton(type:.custom),backdrop=UIButton(type:.custom)
    private let assets:JimiV9Artwork
    private let reducedMotionOverride:Bool?
    private var reducedMotion:Bool {reducedMotionOverride ?? UIAccessibility.isReduceMotionEnabled}
    private let restTilt=JimiNativeModalV10.restTiltDegrees()
    private let paperShadow=CALayer()
    private var drag:JimiNativeModalDrag?
    private var entryStarted=false,suspended=false
    private(set) var ready=false,closing=false,disposed=false

    init(assets:JimiV9Artwork,reducedMotion:Bool?=nil) {
        self.assets=assets
        self.reducedMotionOverride=reducedMotion
        super.init(nibName:nil,bundle:nil)
        modalPresentationStyle = .overFullScreen
    }
    required init?(coder:NSCoder){fatalError("Use init(assets:)")}

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear;view.accessibilityViewIsModal=true
        view.isUserInteractionEnabled=false
        var camera=CATransform3DIdentity;camera.m34 = -1/920;view.layer.sublayerTransform=camera
        backdrop.backgroundColor=JimiNativeModalV10.backdropColor;backdrop.alpha=0
        backdrop.addTarget(self,action:#selector(requestClose),for:.touchUpInside)
        view.addSubview(backdrop);view.addSubview(card)
        artworkEntry.alpha=0;artworkEntry.isUserInteractionEnabled=false
        artworkEntry.accessibilityIdentifier="native.settings.story.artwork"
        artworkEntry.addSubview(storyArtwork)
        storyArtwork.image=assets.image(NativeCreatorStoryArtwork.storyPath,densityAware:true,minimumDensity:3)
        storyArtwork.contentMode = .scaleAspectFit;storyArtwork.isAccessibilityElement=false
        card.accessibilityIdentifier="native.settings.story.paper";card.alpha=0
        card.addSubview(tilt);tilt.addSubview(flip);flip.addSubview(idle);idle.addSubview(paper);idle.addSubview(artworkEntry)
        card.layer.anchorPoint=CGPoint(x:0.5,y:0.55)
        flip.layer.anchorPoint=CGPoint(x:0.5,y:0.46)
        idle.layer.anchorPoint=CGPoint(x:0.5,y:0.52)
        tilt.layer.transform=CATransform3DMakeRotation(restTilt * .pi/180,0,0,1)
        idle.layer.isDoubleSided=false
        // Artwork, text and fact share one standard modal transform owner.
        paper.layer.zPosition = -1
        paper.prepare(assets:assets)
        paperShadow.name="native.end-run.paper-shadow";paperShadow.isDoubleSided=false;paperShadow.zPosition = -2
        paperShadow.shadowColor=UIColor(red:185/255,green:145/255,blue:119/255,alpha:1).cgColor
        paperShadow.shadowOpacity=0.8;paperShadow.shadowOffset=CGSize(width:0,height:13);paperShadow.shadowRadius=16.8
        idle.layer.insertSublayer(paperShadow,at:0)
        heading.text="The story";heading.textAlignment = .center
        heading.textColor=NativeTextPalette.modalTitle
        heading.attributedText=NativeModalTypography.attributedCollectionTitle("The story",baseColor:NativeTextPalette.modalTitle)
        heading.accessibilityTraits = .header
        heading.accessibilityIdentifier="native.settings.story.title";idle.addSubview(heading)
        copy.backgroundColor = .clear;copy.isEditable=false;copy.isSelectable=false
        copy.textContainerInset = .zero;copy.textContainer.lineFragmentPadding=0
        copy.showsVerticalScrollIndicator=false;copy.accessibilityIdentifier="native.settings.story.copy"
        factLabel.accessibilityLabel=Self.paragraphs.last
        if let atlas=assets.image(NativeDiceSheet.star.path)?.cgImage {
            inlineStar.contents=atlas;inlineStar.contentsGravity = .resize
            inlineStar.contentsRect=Self.inlineStarFrame(0)
            inlineStar.minificationFilter = .trilinear;inlineStar.magnificationFilter = .linear
        }
        idle.addSubview(copy)
        fact.accessibilityIdentifier="native.settings.story.fact"
        factLabel.accessibilityIdentifier="native.settings.story.fact.copy";factLabel.numberOfLines=0
        factPaper.cornerRadius=12;factPaper.edgeDetailScale=0.4;factPaper.alpha=1
        factPaper.backgroundColor=UIColor(red:1,green:250/255,blue:244/255,alpha:1)
        fact.layer.shadowColor=UIColor(red:0.68,green:0.40,blue:0.20,alpha:1).cgColor
        fact.layer.shadowOpacity=0.18;fact.layer.shadowRadius=6;fact.layer.shadowOffset=CGSize(width:0,height:4)
        factDivider.backgroundColor=NativeTextPalette.subtitle.withAlphaComponent(0.35)
        fact.addSubview(factPaper);fact.addSubview(factDivider);fact.addSubview(factLabel);fact.layer.addSublayer(inlineStar);idle.addSubview(fact)
        close.setImage(assets.image("assets/close-icon.png",densityAware:true),for:.normal)
        close.imageView?.contentMode = .scaleAspectFit;close.artworkOpacity=0.8
        close.imageEdgeInsets=UIEdgeInsets(top:14,left:14,bottom:14,right:14)
        close.accessibilityLabel="Close our story";close.accessibilityIdentifier="native.settings.story.close"
        close.enableArtworkTapFeedback(wholeControl:true)
        close.addTarget(self,action:#selector(requestClose),for:.touchUpInside);idle.addSubview(close)
        drag=JimiNativeModalDrag(target:card,idle:idle,viewport:view,canDrag:{[weak self] in
            guard let self else{return false};return self.ready && !self.closing && !self.disposed && !self.suspended
        },onDismiss:{[weak self] in self?.requestClose()})
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews();backdrop.frame=view.bounds
        let bounds=NativeTabletLayout.modalBounds(in:view,card:card)
        let safe=NativeTabletLayout.modalSafeInsets(in:view)
        let width=min(390,max(0,bounds.width-48)),inset:CGFloat=30
        let copyInset:CGFloat=41.58
        let textWidth=max(0,width-copyInset*2)
        let bodySize=18*NativeTabletLayout.textScale(bounds.size)
        let body=NSMutableAttributedString()
        for (index,paragraph) in Self.paragraphs.dropLast().enumerated() {
            let style=NativeModalTypography.subtitleParagraph(fontSize:bodySize).mutableCopy() as! NSMutableParagraphStyle
            style.alignment = .center;style.paragraphSpacing=index==0 ? 18:0
            body.append(NSAttributedString(string:paragraph+(index==0 ? "\n":""),attributes:[.font:assets.font(size:bodySize,weight:"Medium"),.foregroundColor:NativeTextPalette.subtitle,.paragraphStyle:style]))
        }
        if copy.attributedText != body {copy.attributedText=body}
        let factStyle=NativeModalTypography.subtitleParagraph(fontSize:bodySize).mutableCopy() as! NSMutableParagraphStyle
        factStyle.alignment = .left
        let factText=NSMutableAttributedString(string:Self.paragraphs.last!,attributes:[.font:assets.font(size:bodySize,weight:"Medium"),.foregroundColor:NativeTextPalette.subtitle,.paragraphStyle:factStyle])
        factText.addAttributes([.font:assets.font(size:bodySize,weight:"Bold"),.foregroundColor:NativeTextPalette.accentOrange],range:NSRange(location:0,length:"Fun fact:".utf16.count))
        factLabel.attributedText=factText
        heading.font=assets.font(size:NativeTabletLayout.modalTitleSize(view.bounds.size,phone:32),weight:"ExtraBold")
        let titleHeight=ceil(heading.font.lineHeight)
        let wanted=copy.sizeThatFits(CGSize(width:textWidth,height:.greatestFiniteMagnitude)).height
        let available=max(0,bounds.height-2*max(safe.top,safe.bottom)-48)
        let factWidth=max(0,width-64),starSide:CGFloat=64
        let factTextX:CGFloat=96,factTextWidth=max(0,factWidth-factTextX-12)
        let factCopyHeight=ceil(factLabel.sizeThatFits(CGSize(width:factTextWidth,height:.greatestFiniteMagnitude)).height)
        let factHeight=max(starSide,factCopyHeight)+28
        let factBottomInset:CGFloat=40
        // Keep a useful scroll viewport on short phones, scaling art uniformly.
        let artworkHeight=min(width*0.86*257/385,max(72,available-(32+titleHeight+18+94+24+factHeight+factBottomInset)+18))
        let artworkWidth=artworkHeight*385/257
        let paperTop=artworkHeight-18
        let titleTop=paperTop+32
        let copyTop=titleTop+titleHeight+18
        let height=min(available,copyTop+wanted+24+factHeight+factBottomInset)
        let factTop=height-factBottomInset-factHeight
        card.bounds=CGRect(x:0,y:0,width:width,height:height)
        card.center=CGPoint(x:bounds.midX,y:bounds.midY+height*0.05)
        tilt.bounds=card.bounds;tilt.center=CGPoint(x:width/2,y:height/2)
        flip.bounds=card.bounds;flip.center=CGPoint(x:width/2,y:height*0.46)
        idle.bounds=card.bounds;idle.center=CGPoint(x:width/2,y:height*0.52)
        JimiNativeModalV10.paperLayout(paper,bounds:CGRect(x:0,y:paperTop,width:width,height:height-paperTop))
        heading.frame=CGRect(x:inset,y:titleTop,width:max(0,width-inset*2),height:titleHeight)
        copy.frame=CGRect(x:copyInset,y:copyTop,width:textWidth,height:max(0,factTop-24-copyTop))
        copy.isScrollEnabled=wanted>copy.bounds.height+0.5
        artworkEntry.bounds=CGRect(x:0,y:0,width:artworkWidth,height:artworkHeight)
        // The source torso cutoff is at224/257; transparent lower padding
        // caused the seam above paper. Move only art8pt down. Both edges
        // inherit the SAME tilt/idle planes, with no independent rotation.
        artworkEntry.center=CGPoint(x:width/2,y:artworkHeight/2+8)
        storyArtwork.frame=artworkEntry.bounds
        let artworkScale=max(1,(view.window?.screen.scale ?? view.traitCollection.displayScale)*NativeTabletLayout.modalScale(view.bounds.size))
        for target in [idle,tilt,artworkEntry,storyArtwork] {
            target.contentScaleFactor=artworkScale;target.layer.allowsEdgeAntialiasing=true
        }
        storyArtwork.layer.minificationFilter = .trilinear;storyArtwork.layer.magnificationFilter = .linear
        fact.bounds=CGRect(x:0,y:0,width:factWidth,height:factHeight)
        fact.center=CGPoint(x:width/2,y:factTop+factHeight/2)
        factPaper.frame=fact.bounds;factPaper.setNeedsLayout();factPaper.layoutIfNeeded()
        factDivider.frame=CGRect(x:83,y:20,width:1,height:max(0,factHeight-40))
        // Baloo’s line box includes extra lower space; center the visible letters.
        let factOpticalOffset=bodySize*0.2
        factLabel.frame=CGRect(x:factTextX,y:(factHeight-factCopyHeight)/2+factOpticalOffset,width:factTextWidth,height:factCopyHeight)
        CATransaction.begin();CATransaction.setDisableActions(true)
        inlineStar.frame=CGRect(x:8,y:(factHeight-starSide)/2-4,width:starSide,height:starSide)
        inlineStar.contentsScale=artworkScale
        CATransaction.commit()
        fact.layer.shadowPath=factPaper.outline
        JimiNativeModalV10.layoutClose(close,frame:CGRect(x:width-42,y:paperTop-10,width:52,height:52),modalTilt:restTilt)
        // Resolve the complete paper silhouette before the shared Close track
        // animates its shadow path. Never interpolate from an empty shadow plane.
        CATransaction.begin();CATransaction.setDisableActions(true)
        paperShadow.frame=card.bounds
        paperShadow.contentsScale=view.window?.screen.scale ?? view.traitCollection.displayScale
        let silhouette=CGMutablePath()
        silhouette.addPath(UIBezierPath(roundedRect:paper.bodyFrame,cornerRadius:paper.layer.cornerRadius).cgPath)
        silhouette.addPath(JimiNativeModalV10.closeOutline(close))
        paperShadow.shadowPath=silhouette
        CATransaction.commit()
    }

    private static func inlineStarFrame(_ frame:Int)->CGRect {
        let sheet=NativeDiceSheet.star
        return CGRect(x:CGFloat(frame % sheet.columns)*sheet.cell.width/sheet.atlas.width,
                      y:CGFloat(frame / sheet.columns)*sheet.cell.height/sheet.atlas.height,
                      width:sheet.cell.width/sheet.atlas.width,height:sheet.cell.height/sheet.atlas.height)
    }
    private func startInlineStar() {
        guard !reducedMotion,inlineStar.contents != nil,inlineStar.animation(forKey:Self.inlineStarKey)==nil else{return}
        let sheet=NativeDiceSheet.star,motion=CAKeyframeAnimation(keyPath:"contentsRect")
        motion.values=(0...sheet.frameCount).map{NSValue(cgRect:Self.inlineStarFrame($0 % sheet.frameCount))}
        motion.keyTimes=(0...sheet.frameCount).map{NSNumber(value:Double($0)/Double(sheet.frameCount))}
        motion.calculationMode = .discrete;motion.duration=sheet.cycle;motion.repeatCount = .infinity
        motion.beginTime=inlineStar.convertTime(CACurrentMediaTime(),from:nil)
        inlineStar.add(motion,forKey:Self.inlineStarKey)
    }
    override func viewDidAppear(_ animated:Bool) {
        super.viewDidAppear(animated)
        guard !entryStarted,!disposed else{return}
        view.layoutIfNeeded()
        entryStarted=true;card.alpha=1;artworkEntry.alpha=1
        if reducedMotion {backdrop.alpha=1;completeEntry();return}
        let epoch=CACurrentMediaTime()
        JimiNativeModalV10.enterClose(close,beginTime:epoch)
        CATransaction.begin();CATransaction.setCompletionBlock{[weak self] in self?.completeEntry()}
        JimiNativeModalV10.enter(card:card,flip:flip,key:"creator.enter",beginTime:epoch)
        CATransaction.commit()
        UIView.animate(withDuration:0.5){self.backdrop.alpha=1}
    }
    private func completeEntry() {
        guard !disposed,!closing,!ready else{return};ready=true
        if !reducedMotion {
            startInlineStar()
            JimiNativeModalV10.startIdle(on:idle,key:Self.idleKey)
            JimiNativeModalV10.startSettledBounce(on:idle)
        }
        view.isUserInteractionEnabled = !suspended
    }
    @objc func requestClose() {
        guard ready,!closing,!disposed,!suspended else{return}
        closing=true;view.isUserInteractionEnabled=false;drag?.cancel(preservePose:true)
        close.playArtworkTapFeedback();onCloseRequested?()
        CATransaction.begin();CATransaction.setDisableActions(true)
        inlineStar.contentsRect=inlineStar.presentation()?.contentsRect ?? inlineStar.contentsRect
        inlineStar.removeAnimation(forKey:Self.inlineStarKey)
        idle.layer.transform=idle.layer.presentation()?.transform ?? idle.layer.transform
        idle.layer.removeAnimation(forKey:Self.idleKey)
        idle.layer.removeAnimation(forKey:JimiNativeModalV10.settledBounceKey)
        CATransaction.commit()
        if reducedMotion {finishClose();return}
        CATransaction.begin();CATransaction.setCompletionBlock{[weak self] in self?.finishClose()}
        JimiNativeModalV10.exit(card,flip:false,releaseY:card.layer.presentation()?.transform.m42 ?? 0,key:"creator.exit")
        JimiNativeModalV10.exit(flip,flip:true,key:"creator.exit")
        let fade=CAKeyframeAnimation(keyPath:"opacity");fade.values=[1,1,0];fade.keyTimes=[0,0.18,1];fade.duration=0.65
        card.layer.opacity=0;card.layer.add(fade,forKey:"creator.fade")
        CATransaction.commit();UIView.animate(withDuration:0.5){self.backdrop.alpha=0}
    }
    private func finishClose() {
        guard !disposed else{return}
        let callback=onClosed;dispose();dismiss(animated:false,completion:callback)
    }
    func setSuspended(_ value:Bool) {
        guard !disposed else{return};suspended=value
        let layer=view.layer
        if value,layer.speed != 0 {
            drag?.cancel(preservePose:true)
            layer.timeOffset=layer.convertTime(CACurrentMediaTime(),from:nil);layer.speed=0
            view.isUserInteractionEnabled=false
        } else if !value,layer.speed==0 {
            let time=layer.timeOffset;layer.speed=1;layer.timeOffset=0;layer.beginTime=0
            layer.beginTime=layer.convertTime(CACurrentMediaTime(),from:nil)-time
            view.isUserInteractionEnabled=ready && !closing
        }
    }
    func dispose() {
        guard !disposed else{return};disposed=true;ready=false
        inlineStar.removeAllAnimations();inlineStar.contents=nil;inlineStar.removeFromSuperlayer()
        onClosed=nil;onCloseRequested=nil;drag?.dispose();drag=nil
        for target in [card,flip,tilt,idle,close,backdrop,artworkEntry,storyArtwork,fact] {target.layer.removeAllAnimations()}
        paper.layer.mask?.removeAllAnimations();paperShadow.removeAllAnimations()
        paper.layer.mask?.sublayers?.forEach{$0.removeAllAnimations()}
        viewIfLoaded?.layer.removeAllAnimations()
    }
    override func viewDidDisappear(_ animated:Bool) {super.viewDidDisappear(animated);dispose()}
}
