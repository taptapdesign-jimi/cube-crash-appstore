import UIKit
import StackToSixGameplay

/// First-play sheet/pointer presentation. The pure tutorial owner selects cells
/// and admits drops; this overlay never mutates dice or completion preferences.
@MainActor
final class NativeTutorialOverlay:UIView {
    var onGotIt:(()->Void)?
    var onSpecialBarContinue:(()->Void)?
    private(set) var specialBarVisible=false
    private let assets:JimiV9Artwork
    private let sheet=UIView(),sheetSurface=UIView(),paper=UIImageView(),pointer=UIView(),pointerImage=UIImageView()
    private let heading=UILabel(),subtitle=UILabel(),button=JimiV9PlainButton(type:.custom)
    private var step=1
    private var generation=0
    private var disposed=false
    private var suspended=false
    private var pointerStart:CGPoint?,pointerEnd:CGPoint?
    private var pointerKey:String?
    private var sourceIntro:NativeSourceTutorialIntroOwner?
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
    var sourcePointerAlpha:CGFloat{pointerImage.alpha}
    var sourceHintTransform:CGAffineTransform{pointer.transform}
    var sourceHintUsesCoreAnimation:Bool{pointer.layer.animation(forKey:"tutorial.hint") != nil}
    var sourcePointerTransform:CGAffineTransform{pointerImage.transform}
    private var freePlayMoves:[(CGPoint,CGPoint)]=[]
    init(resourceRoot:URL) {
        assets=JimiV9Artwork(resourceRoot:resourceRoot)
        super.init(frame:.zero);backgroundColor=UIColor(red:1,green:247/255,blue:239/255,alpha:0.08)
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
        sheetSurface.addSubview(paper);sheet.addSubview(sheetSurface);sheet.addSubview(heading);sheet.addSubview(subtitle);sheet.addSubview(button);addSubview(sheet)
        heading.textAlignment = .center;heading.numberOfLines=0
        subtitle.numberOfLines=0;subtitle.textAlignment = .center;subtitle.textColor=NativeTextPalette.subtitle
        button.setTitle("Got it!",for:.normal);button.applyModalCTA(artwork:assets);button.enableCartoonBounce()
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
                guard sheet.frame.contains(point) else{return nil}
        return sheet.hitTest(convert(point,to:sheet),with:event)
    }
    override func layoutSubviews() {
        super.layoutSubviews()
        let small=bounds.width <= 428
        let subtitleFont=assets.font(size:small ? 18 : 20,weight:"Medium")
        let measuredSpecialHeight=ceil(("Stack and merge dice to fill the bar and earn special dice." as NSString).boundingRect(with:CGSize(width:min(280,bounds.width-56),height:.greatestFiniteMagnitude),options:[.usesLineFragmentOrigin,.usesFontLeading],attributes:[.font:subtitleFont,.paragraphStyle:NativeModalTypography.subtitleParagraph(fontSize:subtitleFont.pointSize)],context:nil).height)
        let subtitleHeight:CGFloat=specialBarVisible ? max(56,measuredSpecialHeight) : (step == 1 || step == 2 ? max(28,subtitleFont.lineHeight) : max(56,subtitleFont.lineHeight*2+2))
        let top:CGFloat=58,headingHeight:CGFloat=small ? 38.4 : 48
        let height=max(178,top+headingHeight+12+subtitleHeight+(step == 3 || specialBarVisible ? 98 : 0)+62+(JimiV9PlainButton.primaryCTAHeight-72)+safeAreaInsets.bottom)
        sheet.bounds=CGRect(x:0,y:0,width:bounds.width,height:height)
        sheet.center=CGPoint(x:bounds.midX,y:bounds.maxY-height/2)
        // Keep the painted bottom below the viewport during the authored
        // upward overshoot; content and its displacement retain their bounds.
        sheetSurface.frame=CGRect(x:0,y:0,width:sheet.bounds.width,height:height+max(64,height*0.25))
        paper.frame=sheetSurface.bounds;paper.layer.cornerRadius=36;paper.layer.maskedCorners=sheetSurface.layer.maskedCorners
        heading.frame=CGRect(x:28,y:top,width:max(0,bounds.width-56),height:headingHeight)
        subtitle.frame=CGRect(x:(bounds.width-min(280,bounds.width-56))/2,y:heading.frame.maxY+12,width:min(280,bounds.width-56),height:subtitleHeight)
        let width=button.primaryCTASize(maxWidth:bounds.width-56).width
        button.setCartoonBounceFrame(CGRect(x:(bounds.width-width)/2,y:subtitle.frame.maxY+34,width:width,height:JimiV9PlainButton.primaryCTAHeight))
        sourceCTAVisual.bounds=button.bounds;sourceCTAVisual.center=CGPoint(x:button.bounds.midX,y:button.bounds.midY)

        let pointerWidth=min(bounds.width*0.34,190)
        let ratio=(pointerImage.image?.size.height ?? 180)/max(1,pointerImage.image?.size.width ?? 180)
        pointer.bounds=CGRect(x:0,y:0,width:pointerWidth,height:pointerWidth*ratio);pointerImage.frame=pointer.bounds
        if let progress=sourceSheetProgress{sheet.transform=CGAffineTransform(translationX:0,y:sheet.bounds.height*progress)}
        setCopy();updatePointer(force:false)
    }
    private func setCopy() {
        let copies=[("Drag to stack","Drag a dice onto another dice.","Drag"),("Merge dice","Drag to stack this dice to make 6.","Merge"),
            ("Clear the stage","Stack and merge dice until\nthe stage is clear.","Clear"),("Special dice","They can merge with any regular\ndice to get the value 6","Special")]
        let copy=specialBarVisible ? ("Special Bar","Stack and merge dice to fill the bar and earn special dice.","Special") : copies[max(0,min(3,step-1))]
        let font=assets.font(size:bounds.width > 0 && bounds.width <= 428 ? 32 : 40,weight:"ExtraBold")
        let text=NSMutableAttributedString(string:copy.0,attributes:[.font:font,.foregroundColor:UIColor(red:173/255,green:135/255,blue:117/255,alpha:1)])
        let range=(copy.0 as NSString).range(of:copy.2)
        if range.location != NSNotFound {text.addAttribute(.foregroundColor,value:UIColor(red:233/255,green:122/255,blue:85/255,alpha:1),range:range)}
        heading.attributedText=text;subtitle.font=assets.font(size:bounds.width <= 428 ? 18 : 20,weight:"Medium");subtitle.attributedText=NativeModalTypography.attributedSubtitle(copy.1,font:subtitle.font);subtitle.lineBreakMode = .byWordWrapping
        button.isHidden=specialBarVisible ? false : (step != 3 || sourceCTA?.state == .hidden)
        let ctaTitle=specialBarVisible ? "Continue":"Got it!"
        if button.title(for:.normal) != ctaTitle {button.setTitle(ctaTitle,for:.normal);setNeedsLayout()}
        if sourceCTA != nil{button.isEnabled=sourceCTA?.enabled==true}
    }
    @discardableResult func showSourceIntro(from:CGPoint?,to:CGPoint?,service:NativeSourceAnimationClockService,
        timeouts:NativeSourceAppTimeoutOwner,boardGeneration:UInt64,immediateSheet:Bool=false,current:@escaping()->Bool)->Bool {
        guard !disposed,sourceIntro==nil else{return false}
        generation += 1;let captured=generation
        step=1;isHidden=false;pointerStart=from;pointerEnd=to;pointerKey=nil
        pointer.isHidden=true;pointer.layer.removeAllAnimations();pointerImage.layer.removeAllAnimations();sheet.layer.removeAllAnimations()
        sourceSheetProgress=1;setNeedsLayout();layoutIfNeeded()
        let owner=NativeSourceTutorialIntroOwner(service:service,timeouts:timeouts,generation:boardGeneration,
            immediateSheet:immediateSheet,
            current:{[weak self] in guard let self,!self.disposed,self.generation==captured else{return false};let valid=current();return valid && !self.disposed && self.generation==captured},
            sheet:{[weak self] progress in guard let self else{return};self.sourceSheetProgress=progress;self.sheet.transform=CGAffineTransform(translationX:0,y:self.sheet.bounds.height*progress)},
            pointer:{[weak self] pose in guard let self else{return};self.pointerImage.alpha=pose.alpha;self.pointerImage.transform=CGAffineTransform(rotationAngle:pose.rotation*Double.pi/180).scaledBy(x:pose.scale,y:pose.scale)},
            reveal:{[weak self] in self?.showPointer(allowSuspended:true)},focus:{[weak self] in self?.updatePointer(force:false)},conceal:{[weak self] in self?.pointer.isHidden=true},dim:{[weak self] alpha in self?.backgroundColor=UIColor(red:1,green:247/255,blue:239/255,alpha:CGFloat(alpha)*0.08)})
        guard let owner else{sourceSheetProgress=nil;return false}
        sourceIntro=owner
        guard owner.start() else{sourceIntro=nil;owner.dispose();return false}
        return true
    }
    @discardableResult private func transitionSourceSheet(prepare:@escaping()->Void,entered:@escaping()->Void)->Bool {
        guard !disposed,let intro=sourceIntro else{return false}
        let show={ [weak self,weak intro] in
            guard let self,let intro,!self.disposed,self.sourceIntro === intro else{return}
            prepare();self.setNeedsLayout();self.layoutIfNeeded();_=intro.enterSheet(completed:entered)
        }
        // Monitors already finish the previous exit before handing off. Do not
        // run a second hidden exit before the next authored enter.
        if (sourceSheetProgress ?? 0)>=1 {show();return true}
        return intro.exitSheet(completed:show)
    }
    @discardableResult func transitionSourceSheetToSecondStep(from:CGPoint?,to:CGPoint?,entered:@escaping()->Void)->Bool {
        transitionSourceSheet(prepare:{[weak self] in guard let self else{return};self.step=2;self.pointerStart=from;self.pointerEnd=to;self.pointerKey=nil},entered:entered)
    }
    @discardableResult func transitionSourceSheetToThirdStep(entered:@escaping()->Void)->Bool {
        transitionSourceSheet(prepare:{[weak self] in
            guard let self else{return};self.step=3;self.pointerStart=nil;self.pointerEnd=nil;self.pointerKey=nil;_=self.sourceCTA?.enter()
        },entered:entered)
    }
    @discardableResult func activateSourceFourthStepDim()->Bool {
        guard !disposed,let intro=sourceIntro else{return false}
        sourceFreeHint?.dispose();sourceFreeHint=nil
        isHidden=false;pointerStart=nil;pointerEnd=nil;pointerKey=nil
        return intro.setDimVisible(true)
    }
    @discardableResult func transitionSourceSheetToFourthStep(entered:@escaping()->Void)->Bool {
        transitionSourceSheet(prepare:{[weak self] in guard let self else{return};self.step=4;self.pointerStart=nil;self.pointerEnd=nil;self.pointerKey=nil},entered:entered)
    }
    @discardableResult func startSourceFreePlayHint(plan:NativeSourceTutorialFreePlayPlan,service:NativeSourceAnimationClockService,key:String,current:@escaping()->Bool)->Bool {
        guard !disposed,step==3,!plan.moves.isEmpty,let intro=sourceIntro,current() else{return false}
        sourceFreeHint?.dispose();sourceFreeHint=nil;intro.primePointerImage(.init(alpha:1,scale:1,rotation:0))
        pointerKey=key;pointerStart=nil;pointerEnd=nil
        pointer.layer.removeAllAnimations();pointerImage.layer.removeAllAnimations()
        pointerImage.alpha=1;pointerImage.transform = .identity;pointer.isHidden=false
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
        guard !disposed,step==4,let intro=sourceIntro,current() else{return false}
        sourceFourthPointer?.dispose();sourceFourthPointer=nil
        intro.primePointerImage(.init(alpha:1,scale:1,rotation:0));pointerKey=nil
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
    @discardableResult func exitSourceThirdSheetForWild(completed:@escaping()->Void)->Bool {
        guard !disposed,let intro=sourceIntro else{return false}
        _=intro.setDimVisible(false)
        return intro.exitSheet(completed:completed)
    }
    var sourceDimAlpha:CGFloat{backgroundColor?.cgColor.alpha ?? 0}
    func scheduleSourceSecondStepPointer(){
        sourceIntro?.scheduleSecondStepPointer(current:{[weak self] in self?.step==2 && self?.disposed==false},updateFocus:{[weak self] in self?.updatePointer(force:true)})
    }
    private func retireSourceIntro(){stopSourceFourthPointer();retireSourceCTA();sourceFreeHint?.dispose();sourceFreeHint=nil;let old=sourceIntro;sourceIntro=nil;sourceSheetProgress=nil;old?.dispose();pointerImage.transform = .identity}
    func show(step:Int,from:CGPoint?,to:CGPoint?,initial:Bool=false,moves:[(CGPoint,CGPoint)]=[]) {
        guard !disposed,(1...4).contains(step) else{return}
        retireSourceIntro()
        generation += 1;let owner=generation;isHidden=false;pointerStart=from;pointerEnd=to;freePlayMoves=moves
        pointerKey=nil;pointer.layer.removeAllAnimations();sheet.layer.removeAllAnimations()
        if initial {
            self.step=step;setNeedsLayout();layoutIfNeeded()
            translateSheet(from:sheet.bounds.height,to:0,begin:0,duration:0.42,ease:.backOut(1.25),completion:{[weak self] in guard self?.generation == owner else{return};self?.showPointer()})
        } else {
            hidePointer()
            translateSheet(from:sheet.layer.presentation()?.transform.m42 ?? sheet.transform.ty,to:sheet.bounds.height,begin:0,duration:0.28,ease:.powerIn(3)) { [weak self] in
                guard let self,self.generation==owner,!self.disposed else{return}
                self.step=step;self.setNeedsLayout();self.layoutIfNeeded()
                self.translateSheet(from:self.sheet.bounds.height,to:0,begin:0,duration:0.42,ease:.backOut(1.25)) {[weak self] in guard self?.generation==owner else{return};self?.showPointer()}
            }
        }
    }
    @discardableResult func showSpecialBar(entered:@escaping()->Void)->Bool {
        guard !disposed,!specialBarVisible else{return false}
        sourceFreeHint?.dispose();sourceFreeHint=nil;hidePointer();retireSourceCTA()
        specialBarVisible=true;isHidden=false;setNeedsLayout();layoutIfNeeded();button.isEnabled=false
        if let intro=sourceIntro {
            _=intro.setDimVisible(false)
            return intro.enterSheet{[weak self] in guard let self,!self.disposed,self.specialBarVisible else{return};self.button.isEnabled=true;entered()}
        }
        translateSheet(from:sheet.bounds.height,to:0,begin:0,duration:0.42,ease:.backOut(1.25)){[weak self] in
            guard let self,!self.disposed,self.specialBarVisible else{return};self.button.isEnabled=true;entered()
        }
        return true
    }
    @discardableResult func hideSpecialBar(completed:@escaping()->Void)->Bool {
        guard !disposed,specialBarVisible else{return false};button.isEnabled=false
        let finish={ [weak self] in guard let self,!self.disposed,self.specialBarVisible else{return};self.specialBarVisible=false;self.isHidden=true;completed() }
        if let intro=sourceIntro{return intro.exitSheet(completed:finish)}
        translateSheet(from:sheet.layer.presentation()?.transform.m42 ?? sheet.transform.ty,to:sheet.bounds.height,begin:0,duration:0.28,ease:.powerIn(3),completion:finish);return true
    }
    func updateTargets(from:CGPoint?,to:CGPoint?) {pointerStart=from;pointerEnd=to;updatePointer(force:false)}
    private func showPointer(allowSuspended:Bool=false) {guard !disposed,(!suspended || allowSuspended),pointerStart != nil,pointerEnd != nil else{return};pointer.isHidden=false;pointerImage.alpha=1;updatePointer(force:true)}
    func hidePointer() {sourceFreeHint?.dispose();sourceFreeHint=nil;sourceIntro?.hidePointerImage();pointer.isHidden=true;pointer.layer.removeAllAnimations();pointerImage.layer.removeAllAnimations()}
    func restorePointer() {if let sourceIntro{sourceIntro.restorePointer()}else{showPointer()}}
    private func updatePointer(force:Bool) {
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
            let scale:Double=t<0.16 ? 0.9+0.1*JimiV9Motion.Ease.backOut(1.8).value(t/0.16) : t<0.84 ? 1-0.06*progress : 0.94-0.08*sineIn((t-0.84)/0.16)
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
        let animation=CAKeyframeAnimation(keyPath:"transform.translation.y")
        animation.duration=begin+duration;animation.values=(0...120).map { index in
            let time=Double(index)*animation.duration/120
            return from+(to-from)*ease.value((time-begin)/duration)
        }
        animation.calculationMode = .linear
        CATransaction.begin();CATransaction.setCompletionBlock(completion)
        sheet.transform=CGAffineTransform(translationX:0,y:to);sheet.layer.add(animation,forKey:"tutorial.sheet")
        CATransaction.commit()
    }
    func hide(completion:@escaping ()->Void) {
        guard !disposed else{return};retireSourceIntro();generation += 1;let owner=generation;hidePointer()
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
        guard let owner else{return false};sourceCTA=owner
        sourceCTAVisual.isUserInteractionEnabled=false
        sourceCTAVisual.accessibilityIdentifier="native.tutorial.source-cta"
        sourceCTAVisual.setTitle("Got it!",for:.normal);sourceCTAVisual.applyModalCTA(artwork:assets)
        button.addSubview(sourceCTAVisual)
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
        let old=sourceCTA;sourceCTA=nil;sourceCTACaptured=false;old?.dispose();sourceCTAVisual.removeFromSuperview()
        button.setTitle("Got it!",for:.normal);button.backgroundColor=UIColor(red:233/255,green:122/255,blue:85/255,alpha:1)
        button.applyModalCTA(artwork:assets);button.enableCartoonBounce();button.isEnabled=true
    }
    @objc private func sourceCTADown(){guard !disposed,!suspended,!sourceCTACaptured,step==3,let owner=sourceCTA,owner.enabled else{return};sourceCTACaptured=true;owner.pointerDown()}
    @objc private func sourceCTAOutside(){guard sourceCTACaptured else{return};sourceCTACaptured=false;sourceCTA?.pointerCancel()}
    @objc private func gotIt() {
        guard !disposed,!suspended else{return}
        if specialBarVisible{guard button.isEnabled else{return};onSpecialBarContinue?();return}
        guard step==3 else{return}
        if let owner=sourceCTA{if sourceCTACaptured{sourceCTACaptured=false;owner.pointerUp(inside:true)}else{owner.keyboardActivate()};setCopy()}
        else{onGotIt?()}
    }
    func setSuspended(_ value:Bool) {
        suspended=value
        if value,layer.speed != 0 {layer.timeOffset=layer.convertTime(CACurrentMediaTime(),from:nil);layer.speed=0}
        else if !value,layer.speed==0 {let offset=layer.timeOffset;layer.speed=1;layer.timeOffset=0;layer.beginTime=0;layer.beginTime=layer.convertTime(CACurrentMediaTime(),from:nil)-offset}
    }
    func dispose() {retireSourceIntro();disposed=true;generation += 1;sheet.layer.removeAllAnimations();pointer.layer.removeAllAnimations();onGotIt=nil;onSpecialBarContinue=nil;specialBarVisible=false;removeFromSuperview()}
}
