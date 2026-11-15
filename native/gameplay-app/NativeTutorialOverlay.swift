import UIKit
import SpriteKit
import StackToSixGameplay

/// First-play sheet/pointer presentation. The pure tutorial owner selects cells
/// and admits drops; this overlay never mutates dice or completion preferences.
@MainActor
final class NativeTutorialOverlay:UIView {
    static func handWidth(in viewportWidth:CGFloat)->CGFloat {min(viewportWidth*0.34,190)*0.7}
    var onSpeechEvent:((String)->Void)?
    private var spokenSheetKeys:Set<String>=[]
    private var sheetSpeechReady=false
    private var speechActive=false
    // Release the sheet receipt only; AudioOwner lets admitted narration finish.
    private func stopSheetSpeech(){
        guard speechActive else{return};speechActive=false;onSpeechEvent?("tutorial-speech-stop")
    }
    private func admitSheetSpeech(){
        guard !disposed,!suspended,!isHidden,!sheet.isHidden,!worldIntroVisible,sheetSpeechReady else{return}
        let key:String?
        if objectiveVisible {key="objective"}
        else if specialBarVisible {key="special-bar"}
        else if backpackVisible {key="delivery"}
        else {key=[1:"stack",2:"merge",4:"special",7:"combo",8:"collection",9:"completion",10:"farewell"][step]}
        guard let key,step != 8 || collectionInteractionReady,
              spokenSheetKeys.insert(key).inserted else{return}
        stopSheetSpeech();speechActive=true;onSpeechEvent?("tutorial-speech:tutorial-"+key)
    }
    private func sheetSpeechEntered(){sheetSpeechReady=true;admitSheetSpeech()}
    private func sheetSpeechExiting(){sheetSpeechReady=false;stopSheetSpeech()}
    var onPresentationChanged:(()->Void)?
    override var isHidden:Bool {didSet{if isHidden{sheetSpeechExiting();retireBackpackIdleEffect();backpackIdleService=nil};if oldValue != isHidden{onPresentationChanged?()}}}
    override func didMoveToSuperview(){super.didMoveToSuperview();onPresentationChanged?()}
    var comboTarget:(()->CGPoint?)?
    var collectionTargetFrame:(()->CGRect?)?
    var onCollectionBackpackOpen:(()->Void)?
    var onGotIt:(()->Void)?
    var onObjectiveGotIt:(()->Void)?
    var onSpecialBarContinue:(()->Void)?
    var onWorldIntroRetire:((Bool)->Void)?
    private(set) var specialBarVisible=false
    private var secondSheetEntered=false,secondStepReady=true,specialBarEntered=false,specialBarReady=true
    private let assets:JimiV9Artwork
    private let backpackInk=CALayer()
    private var backpackIdleEffect:NativeTutorialCarrierIdleEffect?
    private weak var backpackIdleService:NativeSourceAnimationClockService?
    private var backpackTextureID:ObjectIdentifier?
    private var backpackInkImage:CGImage?
    var backpackIdleEffectActive:Bool{backpackIdleEffect != nil}
    var backpackIdleShimmerOpacity:Float{backpackIdleEffect?.shimmerOpacity ?? 0}
    var backpackInkVisible:Bool{backpackInk.superlayer != nil && backpackInk.contents != nil}
    var backpackInkBehindSheet:Bool{
        guard let layers=layer.sublayers,let carrier=layers.firstIndex(of:backpackInk),let paper=layers.firstIndex(of:sheet.layer) else{return false}
        return backpackInk.zPosition==sheet.layer.zPosition && carrier<paper
    }
    private let sheet=UIView(),sheetSurface=UIView(),paper=UIImageView(),lessonArt=UIImageView(),pointer=UIView(),pointerImage=UIImageView()
    private let heading=UILabel(),subtitle=UILabel(),button=JimiV9PlainButton(type:.custom)
    private let worldTapHint=UILabel(),worldTapPaper=UIView()
    private static let worldHandAdjustment=CGPoint(x:0,y:-12)
    private lazy var worldTapSurface=NativeSettingsPaperSurface(image:assets.image("assets/modals/paper.png",densityAware:true))
    private var step=1
    private var objectiveVisible=false
    private let collectionTap=UIButton(type:.custom)
    private let carrierTap=UIButton(type:.custom)
    private var backpackReady=false
    private var backpackVisible=false
    private var backpackArcade=false
    private var arcadeDelivery:Bool {backpackVisible && backpackArcade}
    private var worldIntroVisible=false
    private let worldHandCarrier=UIView()
    private var worldTarget:(()->CGRect?)?
    private weak var worldCard:UIView?
    private var specialSheetDismissed=false
    private var guidedSheetDismissed=false
    private var generation=0
    private var disposed=false
    private var suspended=false
    private var pointerStart:CGPoint?,pointerEnd:CGPoint?
    private var pointerKey:String?
    private var collectionPointerReady=false
    private var collectionInteractionReady=true
    private final class SheetCompletion:NSObject,CAAnimationDelegate {
        var completed:(()->Void)?
        init(_ completed:@escaping()->Void){self.completed=completed}
        func animationDidStop(_ animation:CAAnimation,finished:Bool){
            let callback=completed;completed=nil
            if finished {callback?()}
        }
        func retire(){completed=nil}
    }
    private var sheetCompletion:SheetCompletion?
    private var sourceIntro:NativeSourceTutorialIntroOwner?
    private var referenceSheetSize:(width:CGFloat,height:CGFloat)?
    private var sourceSheetProgress:Double?
    private var sourceCTA:NativeSourceTutorialCTAOwner?
    private let sourceCTAVisual=JimiV9PlainButton(type:.custom)
    private var sourceCTACaptured=false
    var sourceCTAState:NativeSourceTutorialCTAOwner.State?{sourceCTA?.state}
    var sourceCTAHitFrame:CGRect{button.cartoonBounceFrame}
    var sourceCTAVisualTransform:CGAffineTransform{sourceCTAVisual.transform}
    private var sourceFreeHint:NativeSourceTutorialFreePlayHintOwner?
    private var sourceFourthPointer:NativeSourceTutorialFourthPointerOwner?
    private let sourceFourthAccessibleDie=UIView(),sourceFourthAccessibleTarget=UIView()
    var sourceFreeHintActive:Bool{sourceFreeHint?.active==true}
    var sourceIntroOwner:NativeSourceTutorialIntroOwner?{sourceIntro}
    var sourceSheetTranslation:CGFloat{sheet.transform.ty}
    var sourceSheetExitStart:Double?{((sheet.layer.animation(forKey:"tutorial.sheet") as? CAKeyframeAnimation)?.values?.first as? NSNumber)?.doubleValue}
    var sourceSheetHeight:CGFloat{sheet.bounds.height}
    var sourceSheetSurfaceFrame:CGRect{sheetSurface.convert(sheetSurface.bounds,to:self)}
    var sourcePointerVisible:Bool{!pointer.isHidden}
    var sourcePointerFrame:CGRect{pointer.convert(pointer.bounds,to:self)}
    var sourcePointerSize:CGSize{pointer.bounds.size}
    var worldMotionFollower:CALayer{worldHandCarrier.layer}
    var objectiveSheetVisible:Bool{objectiveVisible && !sheet.isHidden}
    var backpackPromptVisible:Bool{backpackVisible && !sheet.isHidden && !isHidden}
    var sourcePointerAlpha:CGFloat{pointerImage.alpha}
    var sourceHintTransform:CGAffineTransform{pointer.transform}
    var sourceHintUsesCoreAnimation:Bool{pointer.layer.animation(forKey:"tutorial.hint") != nil}
    var sourcePointerTransform:CGAffineTransform{pointerImage.transform}
    private var freePlayMoves:[(CGPoint,CGPoint)]=[]
    init(resourceRoot:URL,arcade:Bool=false) {
        backpackArcade=arcade
        assets=JimiV9Artwork(resourceRoot:resourceRoot)
        super.init(frame:.zero);backgroundColor=UIColor(red:1,green:247/255,blue:239/255,alpha:0.08)
        collectionTap.accessibilityIdentifier="native.tutorial.collection-backpack"
        collectionTap.accessibilityLabel=arcade ? "Open box":"Open backpack"
        collectionTap.addTarget(self,action:#selector(collectionBackpackTapped),for:.touchUpInside)
        collectionTap.isHidden=true;addSubview(collectionTap)
        carrierTap.accessibilityIdentifier="native.tutorial.open-backpack"
        carrierTap.accessibilityLabel=arcade ? "Open box":"Open backpack"
        carrierTap.addTarget(self,action:#selector(gotIt),for:.touchUpInside)
        carrierTap.isHidden=true;addSubview(carrierTap)
        pointerImage.image=assets.image("assets/hand-pointer.png");pointerImage.contentMode = .scaleAspectFit
        pointerImage.layer.shadowColor=UIColor(red:161/255,green:96/255,blue:69/255,alpha:1).cgColor
        pointerImage.layer.shadowOpacity=0.22;pointerImage.layer.shadowOffset=CGSize(width:0,height:14);pointerImage.layer.shadowRadius=18
        pointer.layer.anchorPoint=CGPoint(x:0.72,y:0.22);pointer.addSubview(pointerImage);addSubview(pointer)
        paper.image=assets.image("assets/paper-bg.png");paper.contentMode = .scaleAspectFill;paper.clipsToBounds=true
        sheetSurface.backgroundColor=UIColor(red:1,green:253/255,blue:249/255,alpha:0.96)
        sheetSurface.isUserInteractionEnabled=false
        sheetSurface.layer.cornerRadius=36;sheetSurface.layer.maskedCorners=[.layerMinXMinYCorner,.layerMaxXMinYCorner]
        sheetSurface.layer.shadowColor=UIColor(red:173/255,green:118/255,blue:92/255,alpha:1).cgColor
        sheetSurface.layer.shadowOpacity=0.14;sheetSurface.layer.shadowRadius=45;sheetSurface.layer.shadowOffset=CGSize(width:0,height:-18)
        sheetSurface.addSubview(paper);sheet.addSubview(sheetSurface)
        lessonArt.contentMode = .scaleAspectFit;lessonArt.isUserInteractionEnabled=false;lessonArt.isHidden=true
        sheet.addSubview(lessonArt);sheet.addSubview(heading);sheet.addSubview(subtitle);sheet.addSubview(button);addSubview(sheet)
        worldTapSurface.cornerRadius=12;worldTapSurface.edgeDetailScale=0.4;worldTapSurface.alpha=0.8
        worldTapPaper.addSubview(worldTapSurface)
        worldTapPaper.layer.shadowColor=UIColor(red:0.68,green:0.40,blue:0.20,alpha:1).cgColor
        worldTapPaper.layer.shadowOpacity=0.18;worldTapPaper.layer.shadowRadius=6
        worldTapPaper.layer.shadowOffset=CGSize(width:0,height:4)
        worldTapPaper.isUserInteractionEnabled=false;worldTapPaper.isHidden=true
        addSubview(worldTapPaper)
        let worldHint=NSMutableAttributedString(string:"Tap the card",attributes:[
            .font:assets.font(size:17,weight:"ExtraBold"),
            .foregroundColor:NativeTextPalette.modalTitle
        ])
        worldHint.addAttribute(.foregroundColor,value:UIColor(red:231/255,green:116/255,blue:73/255,alpha:1),range:NSRange(location:0,length:3))
        worldTapHint.attributedText=worldHint
        worldTapHint.textAlignment = .center
        worldTapHint.numberOfLines=1
        worldTapHint.isHidden=true
        addSubview(worldTapHint)
        heading.textAlignment = .center;heading.numberOfLines=0
        subtitle.numberOfLines=0;subtitle.textAlignment = .center;subtitle.textColor=NativeTextPalette.subtitle
        button.setTitle("Got it!",for:.normal);button.applyModalCTA(artwork:assets,preparesSculptedFaceOffMain:true);button.enableCartoonBounce()
        button.accessibilityIdentifier="native.tutorial.got-it";button.addTarget(self,action:#selector(gotIt),for:.touchUpInside)
        button.addTarget(self,action:#selector(sourceCTADown),for:.touchDown)
        button.addTarget(self,action:#selector(sourceCTAOutside),for:[.touchUpOutside,.touchCancel])
        accessibilityIdentifier="native.tutorial.sheet"
        for (target,identifier,label) in [(sourceFourthAccessibleDie,"native.tutorial.drag-source","Special die"),(sourceFourthAccessibleTarget,"native.tutorial.drag-target","Merge target")] {
            target.isUserInteractionEnabled=false;target.isAccessibilityElement=true
            target.accessibilityIdentifier=identifier;target.accessibilityLabel=label;target.accessibilityTraits = .image
            target.backgroundColor = .clear
        }
        sourceFourthAccessibleDie.accessibilityHint="Drag this special die onto the highlighted regular die."
        pointer.isHidden=true;button.isHidden=true;setCopy()
    }
    required init?(coder:NSCoder) {fatalError("Use native tutorial initializer")}
    override func hitTest(_ point:CGPoint,with event:UIEvent?)->UIView? {
        guard !disposed,!suspended,!isHidden,alpha>0.01 else{return nil}
        if backpackVisible,backpackReady,!carrierTap.isHidden,button.isEnabled,carrierTap.frame.contains(point){return carrierTap}
        if worldIntroVisible {
            if worldTarget?()?.contains(point)==true || point.y<safeAreaInsets.top+120{return nil}
            return self
        }
        if step==8 {
            if !collectionTap.isHidden,collectionTap.frame.contains(point){return collectionTap}
            if !sheet.frame.contains(point){return self}
        }
        if (step==9 || step==10),!sheet.frame.contains(point){return self}
        guard sheet.frame.contains(point) else{return nil}
        return sheet.hitTest(convert(point,to:sheet),with:event)
    }
    override func layoutSubviews() {
        super.layoutSubviews()
        let small=bounds.width <= 428
        // Measure authored copy so longer translations/copy cannot be clipped.
        setCopy()
        let subtitleWidth=min(280,max(0,bounds.width-56))
        let subtitleTextHeight=ceil(subtitle.sizeThatFits(CGSize(width:subtitleWidth,height:.greatestFiniteMagnitude)).height)
        let subtitleHeight=max(56,subtitleTextHeight)
        // Delivery keeps its real carrier behind the paper, so only copy and CTA
        // contribute to the sheet height. Leave room for the overlapping hands.
        let top:CGFloat=backpackVisible ? 44:28,headingHeight:CGFloat=small ? 38.4:48
        let measuredHeight=top+headingHeight+10+subtitleHeight+(worldIntroVisible ? 0:16+JimiV9PlainButton.primaryCTAHeight)+max(12,safeAreaInsets.bottom)
        if referenceSheetSize?.width != bounds.width {referenceSheetSize=(bounds.width,measuredHeight)}
        if step==1 && !specialBarVisible && !objectiveVisible {referenceSheetSize=(bounds.width,max(referenceSheetSize?.height ?? 0,measuredHeight))}
        // Capture the first Stack sheet, including its real safe area. A hidden
        // transition must never shrink Merge or later lessons to a zero inset.
        let compactGuidedLesson=(step==1 || step==2) && !objectiveVisible && !specialBarVisible && !backpackVisible && !worldIntroVisible
        let lineAdvance=NativeModalTypography.subtitleParagraph(fontSize:subtitle.font.pointSize).minimumLineHeight
        let compactReduction=compactGuidedLesson ? min(lineAdvance,max(0,subtitleHeight-subtitleTextHeight)):0
        // The collection lesson and tablet text-only Special/combo lessons
        // measure their own content instead of inheriting the Backpack art slot.
        let measuredTextLesson=(step==8 || step==9 || step==10 || (NativeTabletLayout.applies(bounds.size) && (step==4 || step==7))) && !objectiveVisible && !backpackVisible && !specialBarVisible && !worldIntroVisible
        let height=(measuredTextLesson || backpackVisible ? measuredHeight:max(referenceSheetSize?.height ?? measuredHeight,measuredHeight))-compactReduction
        sheet.bounds=CGRect(x:0,y:0,width:bounds.width,height:height)
        sheet.center=CGPoint(x:bounds.midX,y:bounds.maxY-height/2)
        // Keep the painted bottom below the viewport during the authored
        // upward overshoot; content and its displacement retain their bounds.
        sheetSurface.frame=CGRect(x:0,y:0,width:sheet.bounds.width,height:height+max(64,height*0.25))
        paper.frame=sheetSurface.bounds;paper.layer.cornerRadius=36;paper.layer.maskedCorners=sheetSurface.layer.maskedCorners
        let characterArtScale:CGFloat=NativeTabletLayout.applies(bounds.size) ? 1.4:1
        let artWidth=min(bounds.width-28,360*characterArtScale)
        let artRatio=(lessonArt.image?.size.height ?? 240)/max(1,lessonArt.image?.size.width ?? 360)
        let artHeight=artWidth*artRatio
        // The illustration belongs to the moving sheet; its hands rest on the paper edge.
        let arcadeArtOffset:CGFloat=backpackVisible && backpackArcade ? 24:0
        // Original @3x Box art has its straight torso cutoff at row625 of741.
        // Align that ink edge with paper y0; the box/hands may overlap the paper.
        let artBottom=arcadeDelivery ? artHeight*(116.0/741):
            (objectiveVisible ? 37:backpackVisible || step==9 || step==10 ? 21:29)*characterArtScale+arcadeArtOffset+(step==10 ? 14*characterArtScale:0)-(step==9 && NativeTabletLayout.applies(bounds.size) ? 16:0)
        // Neutral geometry remains stable while the entry transform is active.
        lessonArt.bounds=CGRect(x:0,y:0,width:artWidth,height:artHeight)
        lessonArt.layer.anchorPoint=CGPoint(x:0.5,y:1)
        lessonArt.layer.position=CGPoint(x:bounds.midX,y:artBottom)
        heading.frame=CGRect(x:28,y:top,width:max(0,bounds.width-56),height:headingHeight)
        // Top-align a one-line description to the same baseline as longer copy.
        // Keep the reserved copy slot separate so CTA placement never follows line count.
        let subtitleTop=heading.frame.maxY+10
        subtitle.frame=CGRect(x:(bounds.width-subtitleWidth)/2,y:subtitleTop,width:subtitleWidth,height:subtitleTextHeight)
        let width=JimiV9PlainButton.modalCTAWidth(sourceCTA == nil ? [button]:[sourceCTAVisual],maxWidth:bounds.width-56)
        button.setCartoonBounceFrame(CGRect(x:(bounds.width-width)/2,y:subtitleTop+subtitleHeight-compactReduction+16,width:width,height:JimiV9PlainButton.primaryCTAHeight))
        if sourceCTA != nil || !deliveryCTAConfigured {sourceCTAVisual.bounds=button.bounds;sourceCTAVisual.center=CGPoint(x:button.bounds.midX,y:button.bounds.midY)}

        collectionTap.isHidden=step != 8
        if step==8 {collectionTap.frame=collectionTargetFrame?() ?? .zero}
        let pointerWidth=Self.handWidth(in:bounds.width)
        let ratio=(pointerImage.image?.size.height ?? 180)/max(1,pointerImage.image?.size.width ?? 180)
        pointer.bounds=CGRect(x:0,y:0,width:pointerWidth,height:pointerWidth*ratio);pointerImage.transform = .identity;pointerImage.frame=pointer.bounds
        if let progress=sourceSheetProgress{sheet.transform=CGAffineTransform(translationX:0,y:sheet.bounds.height*progress)}
        setCopy();updatePointer(force:false)
        if worldIntroVisible,let card=worldCard {
            let hintWidth:CGFloat=150
            let hintFrame=CGRect(x:card.bounds.midX-hintWidth/2,y:-48,width:hintWidth,height:40)
            worldTapPaper.frame=hintFrame;worldTapHint.frame=hintFrame
            worldTapSurface.frame=worldTapPaper.bounds;worldTapSurface.setNeedsLayout();worldTapSurface.layoutIfNeeded()
            worldTapPaper.layer.shadowPath=worldTapSurface.outline
        }

    }
    private func setCopy() {
        if step==10 {backgroundColor=JimiNativeModalV10.backdropColor}
        lessonArt.layer.zPosition=0
        let artPath=step==10 ? "assets/tutorial/hi five.png" : step==9 ? "assets/tutorial/clear board.png" : objectiveVisible ? "assets/tutorial/clean board.png" : specialBarVisible ? "assets/tutorial/special dice.png" : backpackVisible ? (backpackArcade ? "assets/tutorial/zajedno likovi box.png":"assets/tutorial/ekipa backpack.png") : nil
        if let artPath {
            if lessonArt.accessibilityIdentifier != artPath {
                lessonArt.image=assets.image(artPath,densityAware:true)
                lessonArt.accessibilityIdentifier=artPath
                setNeedsLayout()
            }
            lessonArt.isHidden=false
        } else {lessonArt.isHidden=true}
        let deliveryCopy=arcadeDelivery ? "Your box drops\na random Special die.":backpackArcade ? "When the Special bar fills,\nyour box drops\na random Special die.":"Your backpack drops\na random Special die."
        let copies=[("Let’s stack!","Drag 3 onto 2 to make 5."),("Merge and clear!","Drag 5 onto 1."),
            ("Special delivery!",deliveryCopy),("Let’s try your Special!","Merge it with any regular die.\nEither one can go on top.")]
        let collectionCopy=backpackArcade ? ("Your box","Tap the box to meet\nyour little helpers."):("Your backpack","Tap the backpack to meet\nyour little helpers.")
        let copy=step==10 ? ("You’re ready!","Discover new dice and cards.\nBeat your best and have fun!") : step==9 ? ("Clear the board!","Stack and merge anywhere.\nClear every die and have fun!") : worldIntroVisible ? ("Start here","Clear this stage to unlock the next card.") : objectiveVisible ? ("Clear the board","Merge anywhere to make 6.\nClear every die to win.") : specialBarVisible ? ("Special bar","Merge to fill the bar.\nA Special die is waiting!") : step == 8 ? collectionCopy : step == 7 ? ("Your combo","Stack and merge quickly\nto boost your combo and score.") : copies[max(0,min(3,step-1))]
        let font=assets.font(size:bounds.width > 0 && bounds.width <= 428 ? 26 : 30,weight:"ExtraBold")
        let title=NSMutableAttributedString(string:copy.0,attributes:[.font:font,.foregroundColor:NativeTextPalette.modalTitle])
        let firstWord=copy.0.prefix(while:{$0 != " "})
        let accentRange=copy.0.hasPrefix("Make 6") ? (copy.0 as NSString).range(of:"6"):NSRange(location:0,length:(String(firstWord) as NSString).length)
        title.addAttribute(.foregroundColor,value:UIColor(red:231/255,green:116/255,blue:73/255,alpha:1),range:accentRange)
        heading.attributedText=title;subtitle.font=assets.font(size:18,weight:"Medium");subtitle.attributedText=NativeModalTypography.attributedSubtitle(copy.1,font:subtitle.font);subtitle.lineBreakMode = .byWordWrapping;subtitle.numberOfLines=arcadeDelivery ? 2:0
        button.isHidden = worldIntroVisible || (!specialBarVisible && step==3 && sourceCTA?.state == .hidden)
        let ctaTitle=step==10 ? "High five!":step==9 ? "Keep going":step==7 ? "Got it":(step==8 || backpackVisible) ? (backpackArcade ? "Open box":"Open backpack"):"Got it"
        if backpackVisible,deliveryCTAConfigured,sourceCTAVisual.title(for:.normal) != ctaTitle {sourceCTAVisual.setTitle(ctaTitle,for:.normal)}
        if button.title(for:.normal) != ctaTitle {button.setTitle(ctaTitle,for:.normal);setNeedsLayout()}
        if sourceCTA != nil{button.isEnabled=sourceCTA?.enabled==true && (!backpackVisible || backpackReady)}
        else if backpackVisible{button.isEnabled=backpackReady}
        if step==8{button.isEnabled=collectionInteractionReady}
        updateCarrierTapAdmission()
    }
    @discardableResult func showSourceIntro(from:CGPoint?,to:CGPoint?,service:NativeSourceAnimationClockService,
        timeouts:NativeSourceAppTimeoutOwner,boardGeneration:UInt64,immediateSheet:Bool=false,deferInitialPointer:Bool=false,objectiveFirst:Bool=false,initialStep:Int=1,entering:@escaping()->Void={},current:@escaping()->Bool)->Bool {
        guard !disposed,sourceIntro==nil else{return false}
        generation += 1;let captured=generation
        step=initialStep;objectiveVisible=objectiveFirst;isHidden=false;pointerStart=from;pointerEnd=to;pointerKey=nil
        pointer.isHidden=true;pointer.layer.removeAllAnimations();pointerImage.layer.removeAllAnimations();sheet.layer.removeAllAnimations()
        sourceSheetProgress=1;setNeedsLayout();layoutIfNeeded()
        let owner=NativeSourceTutorialIntroOwner(service:service,timeouts:timeouts,generation:boardGeneration,
            immediateSheet:immediateSheet,nativeSheetMotion:true,deferInitialPointer:deferInitialPointer,
            current:{[weak self] in guard let self,!self.disposed,self.generation==captured else{return false};let valid=current();return valid && !self.disposed && self.generation==captured},
            sheet:{[weak self] progress in guard let self else{return};self.sourceSheetProgress=progress;self.sheet.transform=CGAffineTransform(translationX:0,y:self.sheet.bounds.height*progress)},
            pointer:{[weak self] pose in guard let self else{return};self.pointerImage.alpha=pose.alpha;self.pointerImage.transform=CGAffineTransform(rotationAngle:pose.rotation*Double.pi/180).scaledBy(x:pose.scale,y:pose.scale)},
            reveal:{[weak self] in self?.showPointer(allowSuspended:true)},focus:{[weak self] in self?.updatePointer(force:false)},conceal:{[weak self] in self?.pointer.isHidden=true},dim:{[weak self] alpha in self?.backgroundColor=UIColor(red:1,green:247/255,blue:239/255,alpha:CGFloat(alpha)*0.08)},sheetEntering:{[weak self] in self?.sheetSpeechEntered();entering()},sheetEntered:{[weak self] in self?.sheetSpeechEntered()},sheetExiting:{[weak self] in self?.sheetSpeechExiting()})
        guard let owner else{sourceSheetProgress=nil;return false}
        sourceIntro=owner
        guard owner.start() else{sourceIntro=nil;owner.dispose();return false}
        return true
    }
    @discardableResult func transitionObjectiveToStack(revealing:@escaping()->Void={},entered:@escaping()->Void)->Bool {
        guard !disposed,objectiveVisible else{return false}
        button.isEnabled=false
        guard let intro=sourceIntro else {
            let captured=generation
            translateSheet(from:sheet.layer.presentation()?.transform.m42 ?? sheet.transform.ty,to:sheet.bounds.height,begin:0,duration:0.28,ease:.powerIn(3)) {[weak self] in
                guard let self,!self.disposed,self.generation==captured,self.objectiveVisible else{return}
                self.objectiveVisible=false;self.referenceSheetSize=nil;revealing()
                self.show(step:1,from:self.pointerStart,to:self.pointerEnd,initial:true,entered:entered)
            }
            return true
        }
        return intro.exitSheet{[weak self,weak intro] in
            guard let self,let intro,!self.disposed,self.sourceIntro === intro,self.objectiveVisible else{return}
            self.objectiveVisible=false;self.referenceSheetSize=nil;revealing();self.setNeedsLayout();self.layoutIfNeeded()
            _=intro.enterSheet{[weak self] in
                guard let self,!self.disposed,self.sourceIntro === intro else{return}
                self.button.isEnabled=true;self.restorePointer();entered()
            }
        }
    }
    func tutorialCarrierFrame(arcade:Bool)->CGRect {
        layoutIfNeeded()
        return tutorialCarrierFrameForCurrentLayout(arcade:arcade)
    }
    private func tutorialCarrierFrameForCurrentLayout(arcade:Bool)->CGRect {
        let size=tutorialCarrierSize(arcade:arcade)
        // Closed ink: Backpack y106...359/379 wide; Box y112...370/290 wide.
        // Keep the closed ink below the paper edge at the existing opening anchor.
        let top:CGFloat=(arcade ? 68:64)-size.width*(arcade ? 112/290.0:106/379.0)
        return CGRect(x:bounds.midX-size.width/2,y:bounds.maxY-sheet.bounds.height+top,width:size.width,height:size.height)
    }
    private func tutorialCarrierSize(arcade:Bool)->CGSize {
        let backpackWidth=min(216,bounds.width*0.5)
        // Match the visible closed Backpack height, excluding sprite transparency.
        let width=arcade ? backpackWidth*(359-106)/379*290/(370-112):backpackWidth
        return CGSize(width:width,height:width*(arcade ? 403.0/290:438.0/379))
    }
    /// Paint the actual carrier's current original sprite frame behind UIKit paper.
    /// Driven only by its existing Source clock; one current image, no renderer/timer.
    func paintBackpack(_ node:SKSpriteNode?,scene:NativeBoardScene) {
        guard backpackVisible,!disposed,let node,let texture=node.texture,
              let host=scene.gameplayRenderHost,let image=scene.tutorialBackpackInkImage(for:texture) else{clearBackpackInk();return}
        func point(_ local:CGPoint)->CGPoint {
            convert(host.scenePointToView(node.convert(local,to:scene),scene:scene),from:host.renderView)
        }
        let anchor=point(.zero),x=point(CGPoint(x:1,y:0)),y=point(CGPoint(x:0,y:-1))
        CATransaction.begin();CATransaction.setDisableActions(true)
        if backpackInk.superlayer==nil{layer.insertSublayer(backpackInk,below:sheet.layer);backpackInk.zPosition=0}
        let id=ObjectIdentifier(texture)
        if backpackTextureID != id{backpackInk.contents=image;backpackInkImage=image;backpackTextureID=id}
        backpackInk.bounds=CGRect(origin:.zero,size:texture.size())
        backpackInk.anchorPoint=CGPoint(x:0.5,y:0.72);backpackInk.position=anchor
        backpackInk.setAffineTransform(CGAffineTransform(a:x.x-anchor.x,b:x.y-anchor.y,c:y.x-anchor.x,d:y.y-anchor.y,tx:0,ty:0))
        backpackInk.opacity=Float(node.alpha)
        // Retain the real ink geometry for diagnostics; covered artwork stays
        // excluded from input admission.
        let originalHeight:CGFloat=backpackArcade ? 403:438
        let top:CGFloat=backpackArcade ? 112:106,bottom:CGFloat=backpackArcade ? 370:359
        let ink=CGRect(x:0,y:backpackInk.bounds.height*top/originalHeight,width:backpackInk.bounds.width,height:backpackInk.bounds.height*(bottom-top)/originalHeight)
        carrierTap.frame=backpackInk.convert(ink,to:layer)
        updateCarrierTapAdmission()
        CATransaction.commit()
        if backpackReady {startBackpackIdleEffect()}
    }
    private func updateCarrierTapAdmission(){
        // The covered carrier is never an alternate hit target. The named CTA
        // owns admission while the sheet is present.
        carrierTap.isHidden=true;carrierTap.isEnabled=false
    }
    private func clearBackpackInk(){carrierTap.isHidden=true;carrierTap.frame = .zero;retireBackpackIdleEffect();backpackInk.removeFromSuperlayer();backpackInk.contents=nil;backpackInkImage=nil;backpackTextureID=nil}
    func presentBackpackPrompt(arcade:Bool) {
        guard !disposed else{return}
        backpackArcade=arcade;backpackVisible=true;backpackReady=false;setCopy()
    }
    func showWorldIntro(card:UIView,target:@escaping()->CGRect?) {
        guard !disposed,let parent=card.superview,let frame=target(),!frame.isEmpty else{return}
        worldIntroVisible=true;worldTarget=target;worldCard=card
        // Inherit the actual card tilt, squash and bounce, including its tap exit.
        card.addSubview(worldTapPaper);card.addSubview(worldTapHint)
        worldHandCarrier.isUserInteractionEnabled=false
        worldHandCarrier.accessibilityIdentifier="native.tutorial.world-hand-carrier"
        worldHandCarrier.layer.zPosition=12
        parent.addSubview(worldHandCarrier);worldHandCarrier.addSubview(pointer)
        worldTapPaper.accessibilityIdentifier="native.tutorial.card-cue-paper"
        worldTapHint.accessibilityIdentifier="native.tutorial.card-cue-title"
        worldTapPaper.layer.zPosition=10;worldTapHint.layer.zPosition=11
        worldTapHint.isHidden=false;worldTapPaper.isHidden=false
        worldTapHint.alpha=0;worldTapPaper.alpha=0
        backgroundColor = .clear
        worldHandCarrier.bringSubviewToFront(pointer)
        let point=CGPoint(x:frame.midX,y:frame.midY)
        generation += 1;step=6;pointerStart=point;pointerEnd=point
        isHidden=false;sheet.isHidden=true;button.isHidden=true
        // Local slower cue entry: retain the Home scale-in language without
        // its front-loaded ease. The real card owns subsequent idle motion.
        let track=UIAccessibility.isReduceMotionEnabled
            ? JimiV9Motion.Track(tweens:[.init(begin:0,duration:0.15,from:.scale(1,opacity:0),to:.scale(1),ease:.powerOut(1))])
            : JimiV9Motion.Track(tweens:[
                .init(begin:0,duration:0.78,from:.scale(0),to:.scale(1.025),ease:.cubicBezier(0.42,0,0.2,1)),
                .init(begin:0.78,duration:0.27,from:.scale(1.025),to:.scale(1),ease:.cubicBezier(0.42,0,0.58,1))])
        setNeedsLayout();layoutIfNeeded()
        // Start after synchronous layout so cold artwork/layout cannot consume
        // the visible entrance.
        let epoch=CACurrentMediaTime()
        showPointer()
        for view in [pointerImage,worldTapPaper,worldTapHint] {
            view.alpha=1
            let sample=JimiV9Motion.sampledTrack(track)
            let scale=CAKeyframeAnimation(keyPath:"transform")
            scale.values=sample.poses.map {NSValue(caTransform3D:CATransform3DMakeScale($0.scaleX,$0.scaleY,1))}
            let opacity=CAKeyframeAnimation(keyPath:"opacity")
            opacity.values=sample.poses.map {$0.opacity}
            scale.duration=sample.duration;opacity.duration=sample.duration
            scale.calculationMode = .linear;opacity.calculationMode = .linear
            scale.timingFunction=CAMediaTimingFunction(name:.linear);opacity.timingFunction=CAMediaTimingFunction(name:.linear)
            let group=CAAnimationGroup();group.animations=[scale,opacity];group.duration=sample.duration
            group.timingFunction=CAMediaTimingFunction(name:.linear)
            group.beginTime=view.layer.convertTime(epoch,from:nil);group.fillMode = .backwards
            view.layer.add(group,forKey:"tutorial.world-cue-enter")
        }
    }
    func setBackpackReady(service:NativeSourceAnimationClockService?=nil) {
        backpackReady=true;backpackIdleService=service;setCopy();setNeedsLayout()
        startBackpackIdleEffect()
    }
    private func startBackpackIdleEffect() {
        guard sheet.isHidden,backpackIdleEffect==nil,!backpackArcade,backpackReady,backpackVisible,!disposed,!isHidden,
              !UIAccessibility.isReduceMotionEnabled,let service=backpackIdleService,
              let image=backpackInkImage else{return}
        let effect=NativeTutorialCarrierIdleEffect(image:image,bounds:backpackInk.bounds,service:service,current:{[weak self] in
            guard let self else{return false}
            return !self.disposed && self.backpackVisible && self.backpackReady && !self.backpackArcade && !self.isHidden
        })
        backpackIdleEffect=effect;backpackInk.addSublayer(effect.layer);effect.setSuspended(suspended)
    }
    private func retireBackpackIdleEffect(){backpackIdleEffect?.dispose();backpackIdleEffect=nil}
    func retireBackpackPrompt() {
        backpackVisible=false;backpackReady=false;backpackIdleService=nil;clearBackpackInk();setCopy()
    }
    @discardableResult private func transitionSourceSheet(prepare:@escaping()->Void,entering:@escaping()->Void={},entered:@escaping()->Void)->Bool {
        guard !disposed,let intro=sourceIntro else{return false}
        let show={ [weak self,weak intro] in
            guard let self,let intro,!self.disposed,self.sourceIntro === intro else{return}
            self.isHidden=false;self.sheet.isHidden=false;self.guidedSheetDismissed=false;self.button.isEnabled=true;prepare();self.setNeedsLayout();self.layoutIfNeeded();entering();_=intro.enterSheet(completed:entered)
        }
        // Monitors already finish the previous exit before handing off. Do not
        // run a second hidden exit before the next authored enter.
        if (sourceSheetProgress ?? 0)>=1 {show();return true}
        return intro.exitSheet(completed:show)
    }
    @discardableResult func transitionSourceSheetToSecondStep(from:CGPoint?,to:CGPoint?,preparationReady:Bool=true,entered:@escaping()->Void)->Bool {
        secondSheetEntered=false;secondStepReady=preparationReady
        return transitionSourceSheet(prepare:{[weak self] in
            guard let self else{return};self.step=2;self.pointerStart=from;self.pointerEnd=to;self.pointerKey=nil;self.button.isEnabled=false
        },entered:{[weak self] in
            guard let self,!self.disposed,self.step==2 else{return};self.secondSheetEntered=true;self.button.isEnabled=self.secondStepReady;entered()
        })
    }
    func admitSourceSecondStepInteraction() {
        guard !disposed,step==2 else{return};secondStepReady=true;button.isEnabled=secondSheetEntered
    }
    func admitSpecialBarInteraction() {
        guard !disposed,specialBarVisible else{return};specialBarReady=true;button.isEnabled=specialBarEntered
    }
    @discardableResult func transitionSourceSheetToThirdStep(entering:@escaping()->Void={},entered:@escaping()->Void)->Bool {
        transitionSourceSheet(prepare:{[weak self] in
            guard let self else{return};self.step=3;self.pointerStart=nil;self.pointerEnd=nil;self.pointerKey=nil;_=self.sourceCTA?.enter()
        },entering:entering,entered:entered)
    }
    @discardableResult func activateSourceFourthStepDim()->Bool {
        guard !disposed,let intro=sourceIntro else{return false}
        sourceFreeHint?.dispose();sourceFreeHint=nil
        isHidden=false;pointerStart=nil;pointerEnd=nil;pointerKey=nil
        return intro.setDimVisible(true)
    }
    @discardableResult func transitionSourceSheetToFourthStep(entered:@escaping()->Void)->Bool {
        transitionSourceSheet(prepare:{[weak self] in guard let self else{return};self.retireSourceCTA();self.specialSheetDismissed=false;self.sheet.isHidden=false;self.step=4;self.button.isEnabled=false;self.pointerStart=nil;self.pointerEnd=nil;self.pointerKey=nil},entered:{[weak self] in self?.button.isEnabled=true;entered()})
    }
    @discardableResult func startSourceFreePlayHint(plan:NativeSourceTutorialFreePlayPlan,service:NativeSourceAnimationClockService,key:String,current:@escaping()->Bool)->Bool {
        guard !disposed,step==3,!plan.moves.isEmpty,let intro=sourceIntro,current() else{return false}
        sourceFreeHint?.dispose();sourceFreeHint=nil;intro.primePointerImage(.init(alpha:1,scale:1,rotation:0))
        pointerKey=key;pointerStart=nil;pointerEnd=nil
        pointer.layer.removeAllAnimations();pointerImage.layer.removeAllAnimations()
        pointerImage.alpha=1;pointerImage.transform = .identity;pointer.alpha=0;pointer.isHidden=false
        let captured=generation
        let owner=NativeSourceTutorialFreePlayHintOwner(service:service,plan:plan,fingertip:CGPoint(x:pointer.bounds.width*0.16,y:pointer.bounds.height*0.12),
            current:{[weak self] in guard let self,!self.disposed,self.generation==captured,self.pointerKey==key,self.step==3 else{return false};return current()},
            paint:{[weak self] pose in guard let self else{return}
                self.pointer.layer.position=CGPoint(x:pose.position.x+self.pointer.bounds.width*0.72,y:pose.position.y+self.pointer.bounds.height*0.22)
                self.pointer.alpha=CGFloat(pose.alpha);self.pointer.transform=CGAffineTransform(rotationAngle:pose.rotation*Double.pi/180).scaledBy(x:pose.scale,y:pose.scale)
            })
        guard let owner else{return false};sourceFreeHint=owner
        if !owner.start(){sourceFreeHint=nil;owner.dispose();return false};return true
    }
    @discardableResult func startSourceFourthPointer(service:NativeSourceAnimationClockService,timeouts:NativeSourceAppTimeoutOwner,
        boardGeneration:UInt64,current:@escaping()->Bool,select:@escaping()->NativeSourceTutorialFourthPointerPlan?)->Bool {
        guard !disposed,step==4,current() else{return false}
        sourceFourthAccessibleDie.accessibilityLabel="Special die";sourceFourthAccessibleTarget.accessibilityLabel="Merge target"
        sourceFourthPointer?.dispose();sourceFourthPointer=nil
        sourceIntro?.primePointerImage(.init(alpha:1,scale:1,rotation:0));pointerKey=nil
        pointer.alpha=0
        if sourceIntro==nil{pointerImage.alpha=1;pointerImage.transform = .identity}
        pointer.layer.removeAllAnimations();pointerImage.layer.removeAllAnimations();pointer.isHidden=false
        let captured=generation
        let owner=NativeSourceTutorialFourthPointerOwner(service:service,timeouts:timeouts,generation:boardGeneration,
            current:{[weak self] in guard let self,!self.disposed,self.generation==captured,self.step==4 else{return false};return current()},
            select:{[weak self] in
                guard let self,!self.disposed,self.generation==captured,self.step==4,current(),let plan=select(),
                      !self.disposed,self.generation==captured,self.step==4 else{return nil}
                // Borrow the same genuine selected rectangles as the visible
                // hand. Do not select again or consume another shared RNG draw.
                self.sourceFourthAccessibleDie.frame=plan.from
                self.sourceFourthAccessibleTarget.frame=plan.to
                if self.sourceFourthAccessibleDie.superview == nil {self.addSubview(self.sourceFourthAccessibleDie)}
                if self.sourceFourthAccessibleTarget.superview == nil {self.addSubview(self.sourceFourthAccessibleTarget)}
                return plan
            },fingertip:CGPoint(x:pointer.bounds.width*0.16,y:pointer.bounds.height*0.12),
            paint:{[weak self] pose in guard let self else{return}
                self.pointer.layer.position=CGPoint(x:pose.position.x+self.pointer.bounds.width*0.72,y:pose.position.y+self.pointer.bounds.height*0.22)
                self.pointer.alpha=CGFloat(pose.alpha);self.pointer.transform=CGAffineTransform(rotationAngle:pose.rotation*Double.pi/180).scaledBy(x:pose.scale,y:pose.scale)
            })
        guard let owner else{return false};sourceFourthPointer=owner
        guard owner.start() else{sourceFourthPointer=nil;owner.dispose();return false};return true
    }
    @discardableResult func exitSourceFourthStep(beforeSheet:(()->Bool)?=nil,completed:@escaping()->Void)->Bool {
        guard !disposed,step==4,let intro=sourceIntro else{return false}
        stopSourceFourthPointer()
        return intro.popOutPointer{[weak self,weak intro] in
            guard let self,let intro,!self.disposed,self.step==4,self.sourceIntro === intro else{return}
            guard beforeSheet?() != false else{return}
            _=intro.exitSheet(completed:completed)
        }
    }
    func stopSourceFourthPointer(){
        sourceFourthAccessibleDie.removeFromSuperview();sourceFourthAccessibleTarget.removeFromSuperview()
        let old=sourceFourthPointer;sourceFourthPointer=nil;old?.dispose()
    }
    func stopSourceFreePlayHintAndPopOutPointer(){
        sourceFreeHint?.dispose();sourceFreeHint=nil
        _=sourceIntro?.popOutPointer(completed:{})
    }
    @discardableResult func exitSourceThirdSheetForWild(halfway:(()->Void)?=nil,completed:@escaping()->Void)->Bool {
        guard !disposed,let intro=sourceIntro else{return false}
        _=intro.setDimVisible(false)
        return intro.exitSheet(halfway:halfway,completed:completed)
    }
    var sourceDimAlpha:CGFloat{backgroundColor?.cgColor.alpha ?? 0}
    func scheduleSourceSecondStepPointer(){
        sourceIntro?.scheduleSecondStepPointer(current:{[weak self] in self?.step==2 && self?.disposed==false},updateFocus:{[weak self] in self?.updatePointer(force:true)})
    }
    private func retireSourceIntro(){sheetSpeechExiting();stopSourceFourthPointer();retireSourceCTA();sourceFreeHint?.dispose();sourceFreeHint=nil;let old=sourceIntro;sourceIntro=nil;sourceSheetProgress=nil;old?.dispose();pointerImage.transform = .identity}
    func show(step:Int,from:CGPoint?,to:CGPoint?,initial:Bool=false,moves:[(CGPoint,CGPoint)]=[],objectiveFirst:Bool=false,entering:@escaping()->Void={},entered:@escaping()->Void={}) {
        guard !disposed,(1...10).contains(step) else{return}
        retireSourceIntro()
        collectionPointerReady=false
        if step==8 || step==9 || step==10 {pointer.isHidden=true}
        generation += 1;let owner=generation;objectiveVisible=objectiveFirst;isHidden=false;sheet.isHidden=false;guidedSheetDismissed=false;button.isEnabled=true;pointerStart=from;pointerEnd=to;freePlayMoves=moves
        pointerKey=nil;pointer.layer.removeAllAnimations();sheet.layer.removeAllAnimations()
        if initial {
            self.step=step;setNeedsLayout();layoutIfNeeded();if step==7{showPointer()};if step==4{button.isEnabled=false}
            entering()
            translateSheet(from:sheet.bounds.height,to:0,begin:0,duration:NativeTutorialSheetMotion.duration,ease:.backOut(1.25),completion:{[weak self] in guard self?.generation == owner else{return};self?.collectionPointerReady=true;self?.showPointer();if step==4{self?.button.isEnabled=true};entered()})
        } else {
            hidePointer()
            translateSheet(from:sheet.layer.presentation()?.transform.m42 ?? sheet.transform.ty,to:sheet.bounds.height,begin:0,duration:0.28,ease:.powerIn(3)) { [weak self] in
                guard let self,self.generation==owner,!self.disposed else{return}
                self.step=step;self.setNeedsLayout();self.layoutIfNeeded();if step==4{self.button.isEnabled=false}
                entering()
                self.translateSheet(from:self.sheet.bounds.height,to:0,begin:0,duration:NativeTutorialSheetMotion.duration,ease:.backOut(1.25)) {[weak self] in guard self?.generation==owner else{return};self?.collectionPointerReady=true;self?.showPointer();if step==4{self?.button.isEnabled=true};entered()}
            }
        }
    }
    private var deliveryCTAConfigured=false
    var deliveryCTAPrepared:Bool {deliveryCTAConfigured && sourceCTAVisual.isSculptedFacePrepared}
    private func prepareDeliveryCTA() {
        guard !disposed,sourceCTA==nil else{return}
        if !deliveryCTAConfigured {
            sourceCTAVisual.isUserInteractionEnabled=false
            sourceCTAVisual.accessibilityIdentifier="native.tutorial.source-cta"
            sourceCTAVisual.setTitle(backpackArcade ? "Open box":"Open backpack",for:.normal)
            sourceCTAVisual.applyModalCTA(artwork:assets,preparesSculptedFaceOffMain:true)
            sourceCTAVisual.setSculptedFacePreparationSuspended(suspended)
            sourceCTAVisual.isHidden=true
            if sourceCTAVisual.superview !== button {button.addSubview(sourceCTAVisual)}
            deliveryCTAConfigured=true
        }
        let width=JimiV9PlainButton.modalCTAWidth([sourceCTAVisual],maxWidth:bounds.width-56)
        sourceCTAVisual.bounds=CGRect(x:0,y:0,width:width,height:JimiV9PlainButton.primaryCTAHeight)
        sourceCTAVisual.prepareSculptedFaceForEntrance()
    }
    @discardableResult func showSpecialBar(interactionReady:Bool=true,entered:@escaping()->Void)->Bool {
        guard !disposed,!specialBarVisible else{return false}
        specialBarEntered=false;specialBarReady=interactionReady
        sourceFreeHint?.dispose();sourceFreeHint=nil;hidePointer();retireSourceCTA()
        specialBarVisible=true;isHidden=false;sheet.isHidden=false;guidedSheetDismissed=false;setNeedsLayout();layoutIfNeeded();button.isEnabled=false
        prepareDeliveryCTA()
        if let intro=sourceIntro {
            _=intro.setDimVisible(false)
            return intro.enterSheet{[weak self] in guard let self,!self.disposed,self.specialBarVisible else{return};self.specialBarEntered=true;self.button.isEnabled=self.specialBarReady;entered()}
        }
        translateSheet(from:sheet.bounds.height,to:0,begin:0,duration:NativeTutorialSheetMotion.duration,ease:.backOut(1.25)){[weak self] in
            guard let self,!self.disposed,self.specialBarVisible else{return};self.specialBarEntered=true;self.button.isEnabled=self.specialBarReady;entered()
        }
        return true
    }
    @discardableResult func dismissGuidedSheet()->Bool {
        guard !disposed,(step==1 || step==2),!guidedSheetDismissed else{return false}
        guidedSheetDismissed=true;button.isEnabled=false
        let capturedStep=step
        let completed={ [weak self] in
            guard let self,!self.disposed,self.step==capturedStep else{return}
            self.sheet.isHidden=true;self.onPresentationChanged?()
        }
        if let intro=sourceIntro{return intro.exitSheet(completed:completed)}
        translateSheet(from:sheet.layer.presentation()?.transform.m42 ?? sheet.transform.ty,to:sheet.bounds.height,begin:0,duration:0.28,ease:.powerIn(3),completion:completed)
        return true
    }
    @discardableResult func dismissSpecialSheet()->Bool {
        guard !disposed,step==4,!specialSheetDismissed else{return false}
        specialSheetDismissed=true;button.isEnabled=false
        let completed={ [weak self] in guard let self,!self.disposed,self.step==4 else{return};self.sheet.isHidden=true;self.onPresentationChanged?() }
        if let intro=sourceIntro{return intro.exitSheet(completed:completed)}
        translateSheet(from:sheet.layer.presentation()?.transform.m42 ?? sheet.transform.ty,to:sheet.bounds.height,begin:0,duration:0.28,ease:.powerIn(3),completion:completed)
        return true
    }
    func setContinueEnabled(_ enabled:Bool){button.isEnabled=enabled}
    @discardableResult func replaceSpecialBarWithClear(completed:@escaping()->Void)->Bool {
        guard !disposed,specialBarVisible else{return false};button.isEnabled=false;sheetSpeechExiting()
        let captured=generation
        let prepare={ [weak self] in
            guard let self,!self.disposed,self.generation==captured else{return}
            self.specialBarVisible=false;self.step=3;self.isHidden=false;self.setCopy();self.setNeedsLayout();self.layoutIfNeeded()
        }
        let paint={ [weak self] (alpha:Double,y:Double) in
            guard let self,!self.disposed,self.generation==captured else{return}
            for child in [self.heading,self.subtitle,self.button,self.lessonArt] {child.alpha=alpha;child.transform=CGAffineTransform(translationX:0,y:y)}
        }
        let finish={ [weak self] in guard let self,!self.disposed,self.generation==captured else{return};paint(1,0);self.button.isEnabled=true;completed() }
        if let intro=sourceIntro{return intro.replaceSheetContent(prepare:prepare,paint:paint,completed:finish)}
        UIView.animate(withDuration:0.14,delay:0,options:[.curveEaseInOut,.beginFromCurrentState],animations:{paint(0,-6)}){[weak self] success in
            guard let self,success,!self.disposed,self.generation==captured else{return};prepare();paint(0,6)
            UIView.animate(withDuration:0.24,delay:0,options:[.curveEaseInOut,.beginFromCurrentState],animations:{paint(1,0)}){success in if success{finish()}}
        }
        return true
    }
    func revealSourceClearCTA(){isHidden=false;step=3;_=sourceCTA?.enter();setCopy()}
    @discardableResult func exitSpecialVisuals(completed:@escaping()->Void)->Bool {
        guard !disposed else{return false};stopSourceFourthPointer()
        if let intro=sourceIntro {_=intro.popOutPointer(completed:{});return intro.exitSheet(completed:completed)}
        hide(completion:completed);return true
    }
    @discardableResult func hideSpecialBar(completed:@escaping()->Void)->Bool {
        guard !disposed,specialBarVisible else{return false};button.isEnabled=false
        let finish={ [weak self] in guard let self,!self.disposed,self.specialBarVisible else{return};self.specialBarVisible=false;self.isHidden=true;completed() }
        if let intro=sourceIntro{return intro.exitSheet(completed:finish)}
        translateSheet(from:sheet.layer.presentation()?.transform.m42 ?? sheet.transform.ty,to:sheet.bounds.height,begin:0,duration:0.28,ease:.powerIn(3),completion:finish);return true
    }
    func setCollectionInteractionReady(_ ready:Bool){collectionInteractionReady=ready;collectionTap.isEnabled=ready;if step==8 {button.isEnabled=ready;if ready{admitSheetSpeech()}}}
    func updateTargets(from:CGPoint?,to:CGPoint?) {pointerStart=from;pointerEnd=to;updatePointer(force:false)}
    private func showPointer(allowSuspended:Bool=false) {
        guard step != 9 && step != 10 else{pointer.isHidden=true;return}
        guard step != 8 || collectionPointerReady else{pointer.isHidden=true;return}
        guard !objectiveVisible else{pointer.isHidden=true;return}
        if step==7 || step==8 {pointerStart=comboTarget?();pointerEnd=pointerStart}
        guard !disposed,(!suspended || allowSuspended) else{return}
        if sourceFourthPointer != nil{pointer.isHidden=false;return}
        guard pointerStart != nil,pointerEnd != nil else{return}
        let appearing=pointer.isHidden
        pointer.isHidden=false;pointerImage.alpha=1;updatePointer(force:true)
        if appearing,sourceIntro==nil,!worldIntroVisible {NativeTutorialHandMotion.enter(pointerImage)}
    }
    func hidePointer() {
        if !disposed,!pointer.isHidden,!isHidden {NativeTutorialHandMotion.exit(pointerImage,in:self)}
        sourceFreeHint?.dispose();sourceFreeHint=nil;sourceIntro?.hidePointerImage();pointer.isHidden=true;pointer.layer.removeAllAnimations();pointerImage.layer.removeAllAnimations()
    }
    func restorePointer() {if let sourceIntro{sourceIntro.restorePointer()}else{showPointer()}}
    private func updatePointer(force:Bool) {
        if sourceFourthPointer != nil{return}
        if step==7 || step==8,let target=comboTarget?() ?? pointerStart {
            if step==8 {collectionTap.frame=collectionTargetFrame?() ?? .zero}
            pointer.transform = .identity
            pointer.layer.position=CGPoint(x:step==8 ? target.x-pointer.bounds.width*0.12-20:target.x+pointer.bounds.width*0.56+20,y:target.y+pointer.bounds.height*0.10)
            pointer.alpha=1;pointerImage.alpha=1;pointerImage.transform = step==8 ? CGAffineTransform(scaleX:-1,y:1):.identity
            if !pointer.isHidden,!UIAccessibility.isReduceMotionEnabled,pointer.layer.animation(forKey:"tutorial.combo-point")==nil {
                let rock=CAKeyframeAnimation(keyPath:"transform")
                rock.duration=1.4;rock.repeatCount = .infinity
                rock.keyTimes=[0,0.25,0.5,0.75,1]
                let excursion=pointer.bounds.width*0.05
                if step==8 {
                    rock.keyTimes=[0,0.32,0.46,0.65,1]
                    rock.values=zip([0.0,1.0,1.0,0.0,0.0],[1.0,1.0,0.9,1.0,1.0]).map { direction,scale in
                        NSValue(caTransform3D:CATransform3DScale(CATransform3DMakeTranslation(direction*excursion,-direction*excursion,0),scale,scale,1))
                    }
                } else {
                    rock.values=[0.0,-1.0,0.0,1.0,0.0].map { direction in
                        NSValue(caTransform3D:CATransform3DMakeTranslation(direction*excursion,direction*excursion,0))
                    }
                }
                rock.calculationMode = .cubic
                pointer.layer.add(rock,forKey:"tutorial.combo-point")
            }
            return
        }
        if worldIntroVisible,let card=worldCard,let frame=worldTarget?() {
            // Match the card's resting geometry; its owner supplies the delayed track.
            worldHandCarrier.bounds=card.bounds;worldHandCarrier.layer.anchorPoint=card.layer.anchorPoint
            worldHandCarrier.layer.position=card.layer.position;worldHandCarrier.layer.transform=card.layer.transform
            let origin=card.convert(CGPoint.zero,from:self)
            let x=card.convert(CGPoint(x:1,y:0),from:self),y=card.convert(CGPoint(x:0,y:1),from:self)
            let anchor=CGPoint(x:frame.midX+pointer.bounds.width*0.38+32+Self.worldHandAdjustment.x,y:frame.midY+pointer.bounds.height*0.18+2+Self.worldHandAdjustment.y)
            pointer.layer.position=card.convert(anchor,from:self)
            pointer.transform=CGAffineTransform(a:x.x-origin.x,b:x.y-origin.y,c:y.x-origin.x,d:y.y-origin.y,tx:0,ty:0)
            pointerImage.alpha=1
            return
        }
        if (step==1 || step==2),let from=pointerStart,let to=pointerEnd {
            sourceFourthAccessibleDie.accessibilityLabel="Die to stack";sourceFourthAccessibleTarget.accessibilityLabel="Stack target"
            sourceFourthAccessibleDie.frame=CGRect(x:from.x-24,y:from.y-24,width:48,height:48)
            sourceFourthAccessibleTarget.frame=CGRect(x:to.x-24,y:to.y-24,width:48,height:48)
            if sourceFourthAccessibleDie.superview==nil{addSubview(sourceFourthAccessibleDie)}
            if sourceFourthAccessibleTarget.superview==nil{addSubview(sourceFourthAccessibleTarget)}
        } else if step != 4 {
            sourceFourthAccessibleDie.removeFromSuperview();sourceFourthAccessibleTarget.removeFromSuperview()
        }
        guard sourceSheetProgress==nil || !pointer.isHidden else{return}
        guard let from=pointerStart,let to=pointerEnd,pointer.bounds.width>0 else{return}
        if let intro=sourceIntro {
            let start=CGPoint(x:from.x+16-pointer.bounds.width*0.16,y:from.y-pointer.bounds.height*0.12)
            pointer.layer.position=CGPoint(x:start.x+pointer.bounds.width*0.72,y:start.y+pointer.bounds.height*0.22)
            let key="source:\(step):\(Int((from.x+16).rounded())):\(Int(from.y.rounded())):\(Int((to.x+16).rounded())):\(Int(to.y.rounded()))"
            guard force || pointerKey != key else{return};pointerKey=key
            pointer.layer.removeAllAnimations()
            pointer.transform=CGAffineTransform(rotationAngle:-8*Double.pi/180)
            _=intro.startGuidedHint{[weak self] t in
                guard let self else{return}
                self.pointer.transform=CGAffineTransform(translationX:(to.x-from.x)*t,y:(to.y-from.y)*t)
                    .rotated(by:(-8+7*t)*Double.pi/180).scaledBy(x:1-0.06*t,y:1-0.06*t)
            }
            return
        }
        let key="\(step):\(from):\(to):\(pointer.bounds.size)"
        guard force || pointerKey != key else{return};pointerKey=key
        let start=CGPoint(x:from.x+16-pointer.bounds.width*0.16,y:from.y-pointer.bounds.height*0.12)
        pointer.frame.origin=start;pointer.layer.removeAnimation(forKey:"tutorial.hint")
        let animation=CAKeyframeAnimation(keyPath:"transform");animation.duration=2.6;animation.repeatCount = .infinity
        animation.values=(0...312).map { index -> NSValue in
            let time=Double(index)*2.6/312
            let phase=time <= 1.18 ? time/1.18 : time <= 1.30 ? 1 : time <= 2.48 ? 1-(time-1.30)/1.18 : 0
            let t=phase<0.5 ? 2*phase*phase : 1-pow(-2*phase+2,2)/2
            var transform=CATransform3DMakeTranslation((to.x-from.x)*t,(to.y-from.y)*t,0)
            transform=CATransform3DRotate(transform,(-8+7*t)*Double.pi/180,0,0,1)
            transform=CATransform3DScale(transform,1-0.06*t,1-0.06*t,1)
            return NSValue(caTransform3D:transform)
        }
        animation.calculationMode = .linear
        if step==3,!freePlayMoves.isEmpty {installFreePlayHints()}
        else {pointer.layer.add(animation,forKey:"tutorial.hint")}
    }
    private func quadraticInOut(_ value:Double)->Double {let t=max(0,min(1,value));return t<0.5 ? 2*t*t : 1-pow(-2*t+2,2)/2}
    private func sineIn(_ value:Double)->Double {1-cos(max(0,min(1,value))*Double.pi/2)}
    private func installFreePlayHints() {
        // Source step-three directions have independent starts/fades, a .58s
        // drag, then a .16s repeat gap. One layer owns the whole visible loop.
        pointer.frame.origin = .zero
        let duration=Double(freePlayMoves.count)*1.08-0.08+0.16
        let frames=max(1,Int(ceil(duration*120)))
        let transforms=CAKeyframeAnimation(keyPath:"transform"),opacities=CAKeyframeAnimation(keyPath:"opacity")
        transforms.values=(0...frames).map { index -> NSValue in
            let seconds=Double(index)*duration/Double(frames),slot=min(freePlayMoves.count-1,Int(seconds/1.08))
            let t=seconds-Double(slot)*1.08,move=freePlayMoves[slot]
            let progress=quadraticInOut((t-0.16)/0.58)
            let dx=move.1.x-move.0.x,dy=move.1.y-move.0.y
            let scale:Double=t<0.16 ? NativeTutorialHandMotion.entryScale(t/0.16) : t<0.84 ? 1-0.06*progress : 0.94*NativeTutorialHandMotion.exitScale((t-0.84)/0.16)
            var matrix=CATransform3DMakeTranslation(move.0.x+16-pointer.bounds.width*0.16+dx*progress,move.0.y-pointer.bounds.height*0.12+dy*progress,0)
            matrix=CATransform3DRotate(matrix,(-8+((dx>=0 ? -1.0 : -12.0)+8)*progress)*Double.pi/180,0,0,1)
            matrix=CATransform3DScale(matrix,scale,scale,1);return NSValue(caTransform3D:matrix)
        }
        opacities.values=(0...frames).map { index -> Double in
            let seconds=Double(index)*duration/Double(frames),slot=min(freePlayMoves.count-1,Int(seconds/1.08)),t=seconds-Double(slot)*1.08
            return t<0.16 ? JimiV9Motion.Ease.backOut(1.8).value(t/0.16) : t<0.84 ? 1 : 1-sineIn((t-0.84)/0.16)
        }
        for animation in [transforms,opacities] {animation.duration=duration;animation.calculationMode = .linear;animation.repeatCount = .infinity}
        let group=CAAnimationGroup();group.animations=[transforms,opacities];group.duration=duration;group.repeatCount = .infinity
        pointer.layer.add(group,forKey:"tutorial.hint")
    }
    private func translateSheet(from:CGFloat,to:CGFloat,begin:Double,duration:Double,ease:JimiV9Motion.Ease,completion:@escaping ()->Void) {
        if to>0{sheetSpeechExiting()}else{sheetSpeechReady=false}
        let animation=CAKeyframeAnimation(keyPath:"transform.translation.y")
        animation.duration=begin+duration;animation.values=(0...120).map { index in
            let time=Double(index)*animation.duration/120
            let entering=to==0 && from>0
            let progress=entering ? 1-NativeTutorialSheetMotion.progress(time-begin):ease.value((time-begin)/duration)
            return from+(to-from)*progress
        }
        animation.calculationMode = .linear
        sheetCompletion?.retire()
        let receipt=SheetCompletion{[weak self] in
            guard let self,!self.disposed else{return}
            self.sheetCompletion=nil
            if to==0{self.sheetSpeechEntered()}
            completion()
        }
        sheetCompletion=receipt;animation.delegate=receipt
        CATransaction.begin();CATransaction.setDisableActions(true)
        sheet.transform=CGAffineTransform(translationX:0,y:to);sheet.layer.add(animation,forKey:"tutorial.sheet")
        CATransaction.commit()
        if to==0,from>0,begin==0{sheetSpeechEntered()}
    }
    func hide(completion:@escaping ()->Void) {
        guard !disposed else{return};retireSourceIntro();generation += 1;let owner=generation;hidePointer()
        if worldIntroVisible {
            onWorldIntroRetire?(true);onWorldIntroRetire=nil
            UIView.animate(withDuration:UIAccessibility.isReduceMotionEnabled ? 0.15:0.28,animations:{[weak self] in self?.alpha=0;self?.worldTapPaper.alpha=0;self?.worldTapHint.alpha=0}) {[weak self] _ in
                guard let self,self.generation==owner else{return}
                self.isHidden=true;completion()
            }
            return
        }
        translateSheet(from:sheet.layer.presentation()?.transform.m42 ?? sheet.transform.ty,to:sheet.bounds.height,begin:0,duration:0.28,ease:.powerIn(3)) { [weak self] in
            guard let self,self.generation==owner else{return};self.isHidden=true;completion()
        }
    }
    /// Separate visual child preserves the original static outer touch rectangle.
    /// Caller supplies the genuine third-dismiss callback; this API does not
    /// substitute prototype dismissal for the Source coroutine.
    @discardableResult func installSourceCTA(service:NativeSourceAnimationClockService,current:@escaping()->Bool,contact:@escaping()->Void,activate:@escaping()->Void)->Bool {
        guard !disposed,sourceCTA==nil else{return false}
        let captured=generation
        let owner=NativeSourceTutorialCTAOwner(service:service,current:{[weak self] in
            guard let self,!self.disposed,self.generation==captured else{return false};return current()
        },paint:{[weak self] pose in
            guard let self else{return}
            self.sourceCTAVisual.alpha=CGFloat(pose.alpha)
            self.sourceCTAVisual.transform=CGAffineTransform(translationX:0,y:pose.y).scaledBy(x:pose.scale,y:pose.scale)
        },contact:contact,activate:activate)
        guard let owner else{return false}
        // Keep the prewarmed face attached: reparenting retires its pixel backing.
        if !deliveryCTAConfigured {
            if backpackVisible {prepareDeliveryCTA()}
            else {
                // Preserve the standalone/legacy CTA seam's immediate paint.
                sourceCTAVisual.isUserInteractionEnabled=false
                sourceCTAVisual.accessibilityIdentifier="native.tutorial.source-cta"
                sourceCTAVisual.setTitle("Got it",for:.normal);sourceCTAVisual.applyModalCTA(artwork:assets)
            }
        }
        sourceCTA=owner;sourceCTAVisual.isHidden=false
        if sourceCTAVisual.superview !== button {button.addSubview(sourceCTAVisual)}
        button.setTitle(nil,for:.normal);button.removeModalCTAPaint()
        owner.prime(hidden:true);setNeedsLayout();setCopy();return true
    }
    @discardableResult func exitSourceCTA(completed:@escaping(Bool)->Void)->Bool {
        guard let owner=sourceCTA else{return false};sourceCTACaptured=false;button.isEnabled=false
        return owner.exit{[weak self,weak owner] success in
            guard let self,let owner,self.sourceCTA === owner else{completed(false);return}
            self.setCopy();completed(success)
        }
    }
    private func retireSourceCTA(){
        let old=sourceCTA;sourceCTA=nil;sourceCTACaptured=false;old?.dispose();deliveryCTAConfigured=false;sourceCTAVisual.retireSculptedFacePreparation();sourceCTAVisual.removeFromSuperview()
        button.setTitle("Got it!",for:.normal);button.backgroundColor=UIColor(red:233/255,green:122/255,blue:85/255,alpha:1)
        button.applyModalCTA(artwork:assets,preparesSculptedFaceOffMain:true);button.enableCartoonBounce();button.isEnabled=true
    }
    @objc private func sourceCTADown(){guard !disposed,!suspended,!sourceCTACaptured,(!backpackVisible || backpackReady),step==3,let owner=sourceCTA,owner.enabled else{return};sourceCTACaptured=true;owner.pointerDown()}
    @objc private func sourceCTAOutside(){guard sourceCTACaptured else{return};sourceCTACaptured=false;sourceCTA?.pointerCancel()}
    @objc private func gotIt() {
        guard !disposed,!suspended else{return}
        if step==10,!button.isEnabled{return}
        if backpackVisible && !backpackReady{return}
        if backpackVisible {guard button.isEnabled else{return};carrierTap.isHidden=true;retireBackpackIdleEffect();backpackIdleService=nil}
        if specialBarVisible{guard button.isEnabled else{return};onSpecialBarContinue?();return}
        if objectiveVisible {guard button.isEnabled else{return};onObjectiveGotIt?();return}
        if step==1 || step==2 {guard button.isEnabled else{return};onGotIt?();return}
        if step==4 {guard button.isEnabled,!specialSheetDismissed else{return};onGotIt?();return}
        if step==8 && !collectionInteractionReady{return}
        if step==5 || step==7 || step==8 || step==9 || step==10 {onGotIt?();return}
        guard step==3 else{return}
        if let owner=sourceCTA{if sourceCTACaptured{sourceCTACaptured=false;owner.pointerUp(inside:true)}else{owner.keyboardActivate()};setCopy()}
        else{onGotIt?()}
    }
    @objc private func collectionBackpackTapped(){guard !disposed,!suspended,step==8,collectionInteractionReady else{return};onCollectionBackpackOpen?()}
    func setSuspended(_ value:Bool) {
        suspended=value
        if value{stopSheetSpeech()}
        button.setSculptedFacePreparationSuspended(value)
        backpackIdleEffect?.setSuspended(value)
        if deliveryCTAConfigured {sourceCTAVisual.setSculptedFacePreparationSuspended(value);if !value {sourceCTAVisual.prepareSculptedFaceForEntrance()}}
        for clock in worldIntroVisible ? [layer,worldHandCarrier.layer]:[layer] {
            if value,clock.speed != 0 {clock.timeOffset=clock.convertTime(CACurrentMediaTime(),from:nil);clock.speed=0}
            else if !value,clock.speed==0 {let offset=clock.timeOffset;clock.speed=1;clock.timeOffset=0;clock.beginTime=0;clock.beginTime=clock.convertTime(CACurrentMediaTime(),from:nil)-offset}
        }
    }
    func dispose() {stopSheetSpeech();onSpeechEvent=nil;sheetCompletion?.retire();sheetCompletion=nil;button.retireSculptedFacePreparation();NativeTutorialHandMotion.removeExits(in:self);retireSourceIntro();retireBackpackPrompt();onWorldIntroRetire?(false);onWorldIntroRetire=nil;disposed=true;generation += 1;sheet.layer.removeAllAnimations();pointer.layer.removeAllAnimations();pointerImage.layer.removeAllAnimations();worldTapHint.layer.removeAllAnimations();worldTapPaper.layer.removeAllAnimations();worldTarget=nil;worldCard=nil;worldHandCarrier.layer.removeAllAnimations();worldHandCarrier.removeFromSuperview();if worldIntroVisible{pointer.removeFromSuperview()};worldTapPaper.removeFromSuperview();worldTapHint.removeFromSuperview();onGotIt=nil;comboTarget=nil;collectionTargetFrame=nil;onCollectionBackpackOpen=nil;onObjectiveGotIt=nil;onSpecialBarContinue=nil;specialBarVisible=false;removeFromSuperview();onPresentationChanged=nil}
}

/// Authored hand entrances and exits share existing finite Core Animation owners.
enum NativeTutorialHandMotion {
    nonisolated static func entryScale(_ fraction:Double)->Double {
        let t=max(0,min(1,fraction))-1
        return 1+2.8*t*t*t+1.8*t*t
    }
    nonisolated static func exitScale(_ fraction:Double)->Double {
        let t=max(0,min(1,fraction))
        return 1-(2.7*t*t*t-1.7*t*t)
    }
    @MainActor static func enter(_ image:UIImageView) {
        let base=image.transform,duration=UIAccessibility.isReduceMotionEnabled ? 0.12:0.49
        let transform=CAKeyframeAnimation(keyPath:"transform")
        transform.values=(0...60).map{index in
            let scale=UIAccessibility.isReduceMotionEnabled ? 1:NativeSourceTutorialIntroOwner.pointerPose(Double(index)/60*0.49).scale
            return NSValue(caTransform3D:CATransform3DMakeAffineTransform(base.scaledBy(x:scale,y:scale)))
        }
        let opacity=CAKeyframeAnimation(keyPath:"opacity");opacity.values=[0,1];opacity.duration=min(0.08,duration)
        transform.duration=duration;transform.calculationMode = .linear
        let group=CAAnimationGroup();group.animations=[transform,opacity];group.duration=duration
        image.layer.add(group,forKey:"tutorial.hand.enter")
    }
    /// A bounded visual tail borrows the same original image. It retains no
    /// controller or hint owner, and never delays gameplay/modal transitions.
    @MainActor static func removeExits(in host:UIView) {
        for child in host.subviews {
            if child.accessibilityIdentifier=="native.tutorial.hand-exit" {child.layer.removeAllAnimations();child.removeFromSuperview()}
            else {removeExits(in:child)}
        }
    }
    @MainActor static func exit(_ image:UIImageView,in host:UIView) {
        guard let artwork=image.image,!image.bounds.isEmpty,image.alpha>0.001 else{return}
        for old in host.subviews where old.accessibilityIdentifier=="native.tutorial.hand-exit" {old.layer.removeAllAnimations();old.removeFromSuperview()}
        let source=image.layer.presentation() ?? image.layer,destination=host.layer.presentation() ?? host.layer
        var alpha:Float=1,cursor:CALayer?=source
        while let current=cursor,current !== destination {alpha *= current.opacity;cursor=current.superlayer}
        guard alpha>0.001 else{return}
        func point(_ p:CGPoint)->CGPoint {source.convert(p,to:destination)}
        let origin=point(.zero),x=point(CGPoint(x:1,y:0)),y=point(CGPoint(x:0,y:1))
        let base=CGAffineTransform(a:x.x-origin.x,b:x.y-origin.y,c:y.x-origin.x,d:y.y-origin.y,tx:0,ty:0)
        let ghost=UIImageView(image:artwork);ghost.isUserInteractionEnabled=false;ghost.accessibilityIdentifier="native.tutorial.hand-exit"
        ghost.bounds=image.bounds;ghost.layer.position=point(CGPoint(x:image.bounds.midX,y:image.bounds.midY))
        ghost.transform=base;host.addSubview(ghost)
        let duration=UIAccessibility.isReduceMotionEnabled ? 0.12:0.2
        let transform=CAKeyframeAnimation(keyPath:"transform")
        transform.values=(0...40).map{index in
            let scale=UIAccessibility.isReduceMotionEnabled ? 1:exitScale(Double(index)/40)
            return NSValue(caTransform3D:CATransform3DMakeAffineTransform(base.scaledBy(x:scale,y:scale)))
        }
        transform.duration=duration;transform.calculationMode = .linear
        let opacity=CAKeyframeAnimation(keyPath:"opacity");opacity.values=[alpha,alpha,0];opacity.keyTimes=[0,0.4,1];opacity.duration=duration
        let group=CAAnimationGroup();group.animations=[transform,opacity];group.duration=duration
        CATransaction.begin();CATransaction.setCompletionBlock{[weak ghost] in ghost?.removeFromSuperview()}
        ghost.alpha=0;ghost.layer.add(group,forKey:"tutorial.hand.exit");CATransaction.commit()
    }
}

/// One held tutorial Backpack borrows the existing Source shimmer clock.
/// The original closed CPU raster is an alpha mask, with no decode or readback.
@MainActor final class NativeTutorialCarrierIdleEffect {
    let layer=CALayer()
    private let mask=CALayer(),shimmer=CAGradientLayer()
    private let current:()->Bool
    private var shimmerClock:NativeSourceWildShimmerClock?
    private var disposed=false
    var shimmerOpacity:Float{shimmer.opacity}
    init(image:CGImage,bounds:CGRect,service:NativeSourceAnimationClockService,current:@escaping()->Bool) {
        self.current=current
        layer.frame=bounds;layer.name="tutorial.backpack.idle-effects"
        mask.frame=layer.bounds;mask.contents=image;layer.mask=mask
        shimmer.bounds=CGRect(x:0,y:0,width:bounds.width*2,height:bounds.height*2)
        shimmer.locations=[0,0.2,0.4,0.5,0.6,0.8,1]
        shimmer.colors=[0.0,0,0.6,0.9,0.6,0,0].map{UIColor(white:1,alpha:$0).cgColor}
        shimmer.startPoint=CGPoint(x:0,y:0.5);shimmer.endPoint=CGPoint(x:1,y:0.5)
        shimmer.setAffineTransform(CGAffineTransform(rotationAngle: -.pi/4));shimmer.opacity=0
        layer.addSublayer(shimmer)
        shimmerClock=NativeSourceWildShimmerClock(service:service,width:Double(bounds.width),height:Double(bounds.height),playback:.tutorialBackpack,current:{[weak self] in self?.live==true},random:{Double.random(in:0..<1)},paint:{[weak self] pose in
            guard let self,self.live else{return}
            CATransaction.begin();CATransaction.setDisableActions(true)
            self.shimmer.position=CGPoint(x:self.layer.bounds.midX+pose.x,y:self.layer.bounds.midY+pose.y)
            self.shimmer.opacity=Float(pose.alpha)
            CATransaction.commit()
        })
        guard live else{dispose();return}
        _=shimmerClock?.start(immediate:true)
    }
    private var live:Bool{!disposed && current()}
    func setSuspended(_ value:Bool){
        guard !disposed else{return};shimmerClock?.setVisible(!value)
    }
    func dispose(){
        guard !disposed else{return};disposed=true
        shimmerClock?.dispose();shimmerClock=nil
        shimmer.opacity=0;mask.contents=nil;layer.mask=nil;layer.removeFromSuperlayer()
    }
    isolated deinit{dispose()}
}
