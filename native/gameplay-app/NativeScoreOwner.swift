import UIKit
import StackToSixGameplay
import StackToSixNativeState

@MainActor
final class NativeScoreOwner {
    private weak var gameplay:NativeGameplayViewController?
    private let root:URL,progression:()->NativeProgressionState
    private var sheet:NativeScoreModal?,lease=0
    private var backpack:NativeGameplayBackpackController?
    private var observers:[NSObjectProtocol]=[]
    var onTutorialCollectionAdmitted:(()->Void)?
    var onReadDie:((String)->Bool)?
    var onFeedback:((String)->Void)?
    init(gameplay:NativeGameplayViewController,root:URL,progression:@escaping ()->NativeProgressionState) {
        self.gameplay=gameplay;self.root=root;self.progression=progression
        gameplay.onHelp = { [weak self] in self?.presentBackpack() }
        gameplay.onScore = { [weak self] in self?.present(combo:false) }
        gameplay.onCombo = { [weak self] in self?.present(combo:true) }
        for (name,suspended) in [(UIApplication.willResignActiveNotification,true),(UIApplication.didBecomeActiveNotification,false)] {
            observers.append(NotificationCenter.default.addObserver(forName:name,object:nil,queue:.main) {[weak self] _ in MainActor.assumeIsolated {self?.sheet?.setSuspended(suspended);self?.backpack?.setForeground(!suspended)}})
        }
    }
    func presentBackpack() {
        guard let gameplay,backpack==nil,sheet==nil,gameplay.presentedViewController==nil,
              gameplay.boardScene?.navigationLocked != true,gameplay.engine.state.terminal==nil,
              gameplay.boardScene?.tutorialInfoHUDUnlocked == true,
              UIApplication.shared.applicationState == .active else{return}
        let state=gameplay.engine.state
        let sections=NativeBackpackCatalog.sections(progression()).filter { section in
            state.mode == .journey && section.dice.contains {($0.board-1)/10 == (state.board-1)/10}
        }
        guard let app=gameplay.parent as? NativeAppController else{return}
        // An interrupted collection lesson must keep its full walkthrough even
        // when an earlier admission already persisted the one-time seen marker.
        let collectionLessonPending=state.tutorial?.collectionLessonAcknowledged == false
        let tutorialGuidance=state.tutorial != nil && !progression().firstPlayTutorialComplete &&
            (collectionLessonPending || !progression().tutorialCollectionGuidanceSeen)
        let tutorialDieID=state.mode == .arcade ? state.tutorial.map { $0.reward.variant ?? ($0.reward.archetype == .tnt ? "tnt":$0.reward.archetype.rawValue) }:nil
        let controller=NativeGameplayBackpackController(root:root,sections:sections,includesArcade:state.mode == .arcade,arcadeDice:NativeBackpackCatalog.box(progression()),motion:NativeRouteMotion(home:app.home,hub:app.hub),tutorialGuidance:tutorialGuidance,tutorialDieID:tutorialDieID)
        backpack=controller;lease += 1;let token=lease;gameplay.boardScene?.setBackpackPresented(true);gameplay.setSuspended(true);onFeedback?("exit-modal");onFeedback?("collection-icon-speech")
        // A collection visit acknowledges only the notifications it displayed, and
        // only after dismissal returns to this exact board. Discovery never opens UI.
        controller.onHUDCloseRequested={[weak self,weak gameplay] in
            guard let self,let gameplay,self.lease==token,self.gameplay === gameplay,
                  gameplay.engine.state.generation==state.generation else{return}
            gameplay.boardScene?.setBackpackPresented(false)
            gameplay.setSuspended(true)
        }
        controller.onClosed={[weak self,weak gameplay,weak controller] in
            guard let self,let gameplay,self.lease==token,self.gameplay === gameplay,
                  gameplay.engine.state.generation==state.generation else{return}
            let seen=controller?.seenUnreadDice ?? []
            self.backpack=nil
            for id in seen.sorted() {_ = self.onReadDie?(id)}
            gameplay.setSuspended(false)
            gameplay.boardScene?.setBackpackPresented(false)
            gameplay.boardScene?.completeBackpackVisit()
            gameplay.onTutorialBackpackVisitClosed?()
        }
        controller.onTutorialGuidanceAdmitted={[weak self,weak gameplay] in
            guard let self,let gameplay,self.lease==token,self.gameplay === gameplay,
                  gameplay.engine.state.generation==state.generation else{return}
            self.onTutorialCollectionAdmitted?()
        }
        controller.onReadDie={[weak self] id in self?.onReadDie?(id) ?? false}
        controller.onFeedback={[weak self] cue in self?.onFeedback?(cue)}
        gameplay.present(controller,animated:false)
    }
    func present(combo:Bool) {
        guard let gameplay,sheet==nil,gameplay.presentedViewController==nil,
            gameplay.boardScene?.navigationLocked != true,gameplay.engine.state.terminal==nil,
            gameplay.boardScene?.tutorialInfoHUDUnlocked == true,
            UIApplication.shared.applicationState == .active else{return}
        gameplay.setSuspended(true);lease += 1;let token=lease
        let modal=NativeScoreModal(model:.init(state:gameplay.engine.state,progression:progression(),combo:combo),root:root)
        sheet=modal;onFeedback?("hud-modal-open");onFeedback?(combo ? "combo-modal-speech":"high-score-modal-speech")
        modal.onCloseRequested = { [weak self] in guard let self,self.lease==token else{return};self.onFeedback?("modal-close") }
        modal.onClosed = { [weak self] in guard let self,self.lease==token else{return};self.sheet=nil;self.gameplay?.setSuspended(false) }
        gameplay.present(modal,animated:false)
    }
    func dispose() {lease += 1;backpack?.dispose();backpack?.dismiss(animated:false);backpack=nil;sheet?.dispose();sheet?.dismiss(animated:false);sheet=nil;for token in observers {NotificationCenter.default.removeObserver(token)};observers.removeAll();gameplay?.onHelp=nil;gameplay?.onScore=nil;gameplay?.onCombo=nil;gameplay=nil;onFeedback=nil;onReadDie=nil;onTutorialCollectionAdmitted=nil}
}

/// Gameplay retains its exact paused generation while the scoped collection modal is visible.
@MainActor
final class NativeGameplayBackpackController:UIViewController {
    private(set) var seenUnreadDice=Set<String>()
    private let assets:JimiV9Artwork,sections:[NativeBackpackCatalog.Section],includesArcade:Bool
    private let arcadeDice:[NativeBackpackCatalog.Die]
    private let motion:NativeRouteMotion
    let card=UIView(),heading=UILabel(),subtitle=UILabel()
    private let restTilt=JimiNativeModalTransformView()
    private let restTiltDegrees=JimiNativeModalV10.restTiltDegrees()
    private let flip=JimiNativeModalTransformView(),idle=UIView(),paper=NativeModalPaperView(),backdrop=JimiV9PlainButton(type:.custom),closeButton=JimiV9PlainButton(type:.custom)
    private(set) var screen:NativeBackpackView?
    private(set) var detail:NativeBackpackDetail?
    private(set) var modalDrag:JimiNativeModalDrag?
    private let exchangeMarker=CALayer()
    private var exchangeGeneration=0
    private var collectionEntryEpoch=0
    private var pendingDie:NativeBackpackCatalog.Die?
    private var returningDetail=false
    private(set) var returnSelectionPress:UILongPressGestureRecognizer?
    private(set) var switchingDetail=false
    private var foreground=true,closing=false,entered=false,admitted=false,disposed=false
    var onTutorialGuidanceAdmitted:(()->Void)?
    private let tutorialGuidance:Bool
    private let tutorialDieID:String?
    private var tutorialDetailVisited=false
    private(set) var tutorialHand:NativeCollectionTutorialHand?
    var onReadDie:((String)->Bool)?
    var onHUDCloseRequested:(()->Void)?
    var onCloseRequested:(()->Void)?,onClosed:(()->Void)?,onFeedback:((String)->Void)?
    init(root:URL,sections:[NativeBackpackCatalog.Section],includesArcade:Bool,arcadeDice:[NativeBackpackCatalog.Die]=NativeBackpackCatalog.arcade,motion:NativeRouteMotion,tutorialGuidance:Bool=false,tutorialDieID:String?=nil) {
        assets=JimiV9Artwork(resourceRoot:root);self.sections=sections;self.includesArcade=includesArcade;self.arcadeDice=arcadeDice;self.motion=motion
        self.tutorialGuidance=tutorialGuidance
        self.tutorialDieID=tutorialDieID
        super.init(nibName:nil,bundle:nil);modalPresentationStyle = .overFullScreen
    }
    required init?(coder:NSCoder){fatalError("Use scoped initializer")}
    override func loadView() {
        view=UIView();view.backgroundColor = .clear;view.accessibilityViewIsModal=true
        var camera=CATransform3DIdentity;camera.m34 = -1/920;view.layer.sublayerTransform=camera
        backdrop.accessibilityIdentifier="native.gameplay.backpack.backdrop"
        backdrop.backgroundColor=JimiNativeModalV10.backdropColor;backdrop.alpha=0
        backdrop.addTarget(self,action:#selector(close),for:.touchUpInside)
        view.addSubview(backdrop);view.addSubview(card);card.addSubview(restTilt);restTilt.addSubview(flip);flip.addSubview(idle);idle.addSubview(paper)
        card.layer.anchorPoint=CGPoint(x:0.5,y:0.55);flip.layer.anchorPoint=CGPoint(x:0.5,y:1);idle.layer.anchorPoint=CGPoint(x:0.5,y:0.52)
        card.alpha=0;card.accessibilityIdentifier="native.gameplay.backpack-modal";idle.layer.isDoubleSided=false
        paper.prepare(assets:assets)
        idle.layer.shadowColor=UIColor(red:185/255,green:145/255,blue:119/255,alpha:1).cgColor
        idle.layer.shadowOpacity=0.8;idle.layer.shadowOffset=CGSize(width:0,height:13);idle.layer.shadowRadius=16.8
        heading.text=includesArcade ? "Box":"Backpack";heading.textAlignment = .center
        heading.font=assets.font(size:28,weight:"ExtraBold");heading.textColor=NativeTextPalette.modalTitle
        idle.addSubview(heading)
        subtitle.text=includesArcade ? "Unlock dice in Journey.\nGrow your Arcade collection!":"Meet your little helpers.\nThey’ll drop in as you play."
        subtitle.numberOfLines=0;subtitle.textAlignment = .center
        subtitle.font=assets.font(size:18,weight:"Medium");subtitle.textColor=NativeTextPalette.subtitle
        subtitle.attributedText=NativeModalTypography.attributedSubtitle(subtitle.text ?? "",font:subtitle.font)
        idle.addSubview(subtitle)
        let screen=NativeBackpackView(frame:.zero,assets:assets,title:includesArcade ? "Box":"Backpack",arcadeCrate:includesArcade);self.screen=screen
        screen.useModalLayout();screen.apply(sections,includesArcade:includesArcade,arcadeDice:arcadeDice);idle.addSubview(screen)
        screen.onDie={[weak self] die in self?.open(die)}
        screen.installEntrySelectionCapture(on:view)
        closeButton.setBackgroundImage(paper.closeMaterial,for:.normal);closeButton.layer.cornerRadius=16;closeButton.clipsToBounds=true
        closeButton.setImage(assets.image("assets/close-icon.png",densityAware:true),for:.normal);closeButton.imageView?.contentMode = .scaleAspectFit;closeButton.artworkOpacity = 0.8;closeButton.enableArtworkTapFeedback(wholeControl:true)
        closeButton.imageEdgeInsets=UIEdgeInsets(top:14,left:14,bottom:14,right:14);closeButton.accessibilityIdentifier="native.gameplay.backpack.close"
        closeButton.accessibilityLabel=includesArcade ? "Close Box":"Close Backpack";closeButton.addTarget(self,action:#selector(close),for:.touchUpInside);idle.addSubview(closeButton)
        modalDrag=JimiNativeModalDrag(target:card,idle:idle,viewport:view,canDrag:{[weak self] in
            guard let self else{return false}
            return self.foreground && self.admitted && !self.closing && !self.disposed && !self.switchingDetail && self.detail==nil
        },onDismiss:{[weak self] in self?.close()})
        if includesArcade {modalDrag?.pan.require(toFail:screen.grid.panGestureRecognizer)}
        let tap=UILongPressGestureRecognizer(target:self,action:#selector(returnSelectionPressed(_:)))
        tap.minimumPressDuration=0;tap.isEnabled=false;view.addGestureRecognizer(tap);returnSelectionPress=tap
        view.isUserInteractionEnabled=false
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews();backdrop.frame=view.bounds
        let tabletJourney=NativeTabletLayout.applies(view.bounds.size) && !includesArcade
        let projectedPaperWidth=(NativeTabletLayout.collectionWidth(view.bounds.size,crate:false)-64)/NativeTabletLayout.modalScale(view.bounds.size)
        let referenceWidth:CGFloat=tabletJourney ? projectedPaperWidth+48:390
        let modalBounds=NativeTabletLayout.modalBounds(in:view,card:card,referenceWidth:referenceWidth)
        let modalSafeInsets=NativeTabletLayout.modalSafeInsets(in:view)
        let width=tabletJourney ? projectedPaperWidth:min(390,max(0,modalBounds.width-48))
        NativeTabletLayout.labelFont(heading,size:NativeTabletLayout.modalTitleSize(view.bounds.size,phone:28))
        let titleHeight=NativeTabletLayout.applies(view.bounds.size) ? max(38.4,ceil(heading.font.lineHeight)):38.4
        heading.frame=CGRect(x:24,y:47.2-titleHeight/2,width:max(0,width-48),height:titleHeight)
        let subtitleInset:CGFloat=includesArcade ? 12:24
        let subtitleWidth=max(0,width-subtitleInset*2)
        let subtitleHeight=ceil(subtitle.sizeThatFits(CGSize(width:subtitleWidth,height:CGFloat.greatestFiniteMagnitude)).height)
        subtitle.frame=CGRect(x:subtitleInset,y:78.4,width:subtitleWidth,height:subtitleHeight)
        let count=includesArcade ? arcadeDice.count:sections.first?.dice.count ?? 0
        let columns:CGFloat=includesArcade || tabletJourney ? 3:2,side=floor((width-48-(columns-1)*16)/columns)
        let rows=ceil(CGFloat(count)/columns),gridHeight=rows*side+max(0,rows-1)*16
        let height=min(subtitle.frame.maxY+24+gridHeight+32+(includesArcade ? 32:0),max(0,modalBounds.height-modalSafeInsets.top-modalSafeInsets.bottom-48))
        // Preserve the authored55% animation pivot while centering the visible paper.
        card.bounds=CGRect(x:0,y:0,width:width,height:height);card.center=CGPoint(x:modalBounds.midX,y:modalBounds.midY+height*(card.layer.anchorPoint.y-0.5))
        restTilt.bounds=card.bounds;restTilt.center=CGPoint(x:width/2,y:height/2)
        restTilt.layer.transform=CATransform3DMakeRotation(restTiltDegrees * .pi/180,0,0,1)
        flip.bounds=card.bounds;flip.center=CGPoint(x:width/2,y:height);idle.bounds=card.bounds;idle.center=CGPoint(x:width/2,y:height*0.52)
        // Crop the authored folded paper tail just as selected Backpack details do.
        JimiNativeModalV10.paperLayout(paper,bounds:idle.bounds,bottomExtension:96)
        screen?.frame=CGRect(x:0,y:subtitle.frame.maxY+24,width:width,height:max(0,height-subtitle.frame.maxY-24-32))
        screen?.useModalLayout(columns:Int(columns),scrolling:includesArcade && gridHeight>max(0,height-subtitle.frame.maxY-24-32)-32+0.01)
        JimiNativeModalV10.layoutClose(closeButton,frame:CGRect(x:width-42,y:-10,width:52,height:52),modalTilt:restTiltDegrees)
        if tutorialGuidance,admitted,detail==nil,!switchingDetail {
            screen?.layoutIfNeeded();screen?.grid.layoutIfNeeded();updateTutorialHand()
        }else{tutorialHand?.layout()}
    }
    override func viewDidAppear(_ animated:Bool) {
        super.viewDidAppear(animated);guard !closing,!entered,!disposed else{return};entered=true;card.alpha=1
        if UIAccessibility.isReduceMotionEnabled {completeEnter();backdrop.alpha=1;return}
        collectionEntryEpoch += 1;let epoch=collectionEntryEpoch
        view.isUserInteractionEnabled=foreground;screen?.setEntrySelectionEnabled(true)
        let paperEpoch=CACurrentMediaTime()
        JimiNativeModalV10.enterClose(closeButton,beginTime:paperEpoch)
        CATransaction.begin();CATransaction.setCompletionBlock{[weak self] in
            guard let self,self.collectionEntryEpoch==epoch else{return};self.completeEnter()
        }
        JimiNativeModalV10.enter(card:card,flip:flip,key:"gameplay.backpack.enter",beginTime:paperEpoch);CATransaction.commit()
        UIView.animate(withDuration:0.5){self.backdrop.alpha=1}
    }
    private func completeEnter(){
        guard !closing,!disposed else{return}
        if !admitted && tutorialGuidance {onTutorialGuidanceAdmitted?();onTutorialGuidanceAdmitted=nil}
        admitted=true
        screen?.setEntrySelectionEnabled(false)
        JimiNativeModalV10.startIdle(on:idle,key:"backpack.collection.idle")
        view.isUserInteractionEnabled=foreground && !switchingDetail;screen?.isUserInteractionEnabled=foreground && !switchingDetail
        screen?.setAlertsActive(foreground && !switchingDetail)
        guard !switchingDetail else{return}
        returningDetail=false;returnSelectionPress?.isEnabled=false;card.isUserInteractionEnabled=true
        let next=pendingDie;pendingDie=nil
        if let next,foreground {open(next)}else{updateTutorialHand()}
    }
    private func updateTutorialHand(){
        guard tutorialGuidance,foreground,!closing,!disposed else{return}
        let target:UIView,host:UIView,phase:String,mirrored:Bool
        if let detail {
            guard !returningDetail,detail.card.isUserInteractionEnabled,let parent=detail.close.superview else{return}
            target=detail.close;host=parent;phase="detail-close";mirrored=true
        }else{
            guard admitted,!switchingDetail else{return}
            if tutorialDetailVisited {target=closeButton;phase="collection-close";mirrored=true}
            else {
                let die:UIView?
                if let tutorialDieID {die=screen?.unlockedVisibleDieView(id:tutorialDieID)}
                else {die=screen?.firstUnlockedVisibleDieView}
                guard let die else{tutorialHand?.retire();return}
                target=die;phase="first-die"
                mirrored=die.convert(CGPoint(x:die.bounds.midX,y:die.bounds.midY),to:idle).x>idle.bounds.midX
            }
            host=idle
        }
        if tutorialHand==nil {tutorialHand=NativeCollectionTutorialHand(image:assets.image("assets/hand-pointer.png"))}
        tutorialHand?.point(at:target,in:host,mirrored:mirrored,phase:phase,viewport:view,firstDieCorner:true)
    }
    @objc private func returnSelectionPressed(_ gesture:UILongPressGestureRecognizer){
        guard gesture.state == .began else{return}
        captureReturnSelection(atWindowPoint:gesture.location(in:view.window))
    }
    func captureReturnSelection(atWindowPoint point:CGPoint){
        guard returningDetail,foreground,!closing,!disposed else{return}
        if let die=screen?.revealedDie(atWindowPoint:point){pendingDie=die}
    }
    private func admitReturnTap(){
        guard returningDetail,detail==nil,foreground,!closing,!disposed else{return}
        view.isUserInteractionEnabled=true;card.isUserInteractionEnabled=false;screen?.isUserInteractionEnabled=false;returnSelectionPress?.isEnabled=true
    }
    private func open(_ die:NativeBackpackCatalog.Die) {
        guard foreground,(admitted || screen?.entrySelectionEnabled==true),!closing,!disposed,!switchingDetail,detail==nil,presentedViewController==nil else{return}
        tutorialHand?.retire()
        let entryPose:([UIView],[CATransform3D])? = admitted ? nil:([card,flip],[card,flip].map{($0.layer.presentation() ?? $0.layer).transform})
        collectionEntryEpoch += 1;screen?.setEntrySelectionEnabled(false)
        screen?.setAlertsActive(false)
        pendingDie=nil;returningDetail=false;returnSelectionPress?.isEnabled=false
        onFeedback?("tab")
        modalDrag?.cancel()
        idle.layer.removeAnimation(forKey:"backpack.collection.idle")
        idle.layer.removeAnimation(forKey:JimiNativeModalV10.settledBounceKey)
        let detail=NativeBackpackDetail(die:die,assets:assets,motion:motion)
        detail.usesParentBackdrop=true;detail.entersImmediately=true
        self.detail=detail;switchingDetail=true;admitted=false;view.isUserInteractionEnabled=false
        detail.onEntered={[weak self,weak detail] in
            guard let self,let detail,self.detail === detail,!self.disposed,!self.closing else{return}
            self.tutorialDetailVisited=true;self.updateTutorialHand()
        }
        detail.onLayout={[weak self,weak detail] in
            guard let self,self.detail === detail else{return};self.tutorialHand?.layout()
        }
        detail.onSpeechRequested={[weak self] in self?.onFeedback?("scene-speech:"+NativeRecordedSceneSpeech.scene(forDie:die.id))}
        detail.onPresentationStarted={[weak self,weak detail] in
            guard let self,let detail,self.detail === detail,!self.disposed,self.foreground else{return}
            self.onFeedback?("exit-modal");detail.onSpeechRequested?()
            if self.onReadDie?(die.id)==true {self.screen?.markRead(die.id)}
        }
        detail.onCloseRequested={[weak self,weak detail] in
            guard let self,self.detail === detail,!self.disposed else{return}
            self.tutorialHand?.retire()
            self.returningDetail=true;self.pendingDie=nil
            self.onFeedback?("modal-close")
            self.scheduleExchange(after:0.65*0.4){[weak self] in self?.enterCollection()}
        }
        detail.onClose={[weak self,weak detail] in
            guard let self,!self.disposed,!self.closing,self.detail === detail else{return}
            self.detail=nil;self.switchingDetail=false
            if self.admitted {self.completeEnter()}else{self.admitReturnTap()}
        }
        detail.onExitSelection={[weak self,weak detail] point in
            guard let self,let detail,self.detail === detail else{return}
            self.captureReturnSelection(atWindowPoint:point)
        }
        // Prepare only the selected detail while the collection starts its exit.
        detail.loadViewIfNeeded()
        if UIAccessibility.isReduceMotionEnabled {card.alpha=0}
        else {
            JimiNativeModalV10.exit(card,flip:false,key:"gameplay.backpack.detail.exit")
            JimiNativeModalV10.exit(flip,flip:true,key:"gameplay.backpack.detail.exit")
        }
        if let entryPose {
            for (target,pose) in zip(entryPose.0,entryPose.1) {
                target.layer.removeAnimation(forKey:"gameplay.backpack.enter")
                retargetEntryExit(target,from:pose,key:"gameplay.backpack.detail.exit")
            }
        }
        scheduleExchange(after:0.65*0.3){[weak self,weak detail] in
            guard let self,let detail,!self.disposed,!self.closing,self.detail === detail else{return}
            self.present(detail,animated:false){[weak self,weak detail] in
                guard let self,let detail,!self.disposed,self.detail === detail else{return}
                detail.beginImmediatePresentation()
            }
        }
    }

    /// Keep early selection continuous through the existing exit anticipation.
    private func retargetEntryExit(_ target:UIView,from start:CATransform3D,key:String){
        guard let animation=target.layer.animation(forKey:key)?.copy() as? CAKeyframeAnimation,
              let values=animation.values as? [NSValue],let times=animation.keyTimes else{return}
        animation.values=zip(values,times).map{value,time in
            var pose=value.caTransform3DValue
            let weight=max(0,1-time.doubleValue/0.18)
            pose.m11 += (start.m11-1)*CGFloat(weight)
            pose.m12 += (start.m12)*CGFloat(weight)
            pose.m13 += (start.m13)*CGFloat(weight)
            pose.m14 += (start.m14)*CGFloat(weight)
            pose.m21 += (start.m21)*CGFloat(weight)
            pose.m22 += (start.m22-1)*CGFloat(weight)
            pose.m23 += (start.m23)*CGFloat(weight)
            pose.m24 += (start.m24)*CGFloat(weight)
            pose.m31 += (start.m31)*CGFloat(weight)
            pose.m32 += (start.m32)*CGFloat(weight)
            pose.m33 += (start.m33-1)*CGFloat(weight)
            pose.m34 += (start.m34)*CGFloat(weight)
            pose.m41 += (start.m41)*CGFloat(weight)
            pose.m42 += (start.m42)*CGFloat(weight)
            pose.m43 += (start.m43)*CGFloat(weight)
            pose.m44 += (start.m44-1)*CGFloat(weight)
            return NSValue(caTransform3D:pose)
        }
        target.layer.add(animation,forKey:key)
    }

    /// A finite marker shares the outgoing modal's root clock, including background pauses.
    private func scheduleExchange(after duration:TimeInterval,_ completion:@escaping ()->Void) {
        exchangeGeneration += 1;let generation=exchangeGeneration
        exchangeMarker.removeAllAnimations();exchangeMarker.removeFromSuperlayer()
        if UIAccessibility.isReduceMotionEnabled {completion();return}
        view.layer.addSublayer(exchangeMarker)
        CATransaction.begin()
        CATransaction.setCompletionBlock{[weak self] in
            guard let self,!self.disposed,self.exchangeGeneration==generation else{return}
            self.exchangeMarker.removeFromSuperlayer();completion()
        }
        let marker=CABasicAnimation(keyPath:"opacity");marker.fromValue=0;marker.toValue=0;marker.duration=duration
        exchangeMarker.add(marker,forKey:"backpack.exchange")
        CATransaction.commit()
    }

    private func enterCollection() {
        guard !disposed,!closing else{return}
        admitted=false;view.isUserInteractionEnabled=false
        [card,flip].forEach{$0.layer.removeAllAnimations();$0.layer.transform=CATransform3DIdentity}
        card.alpha=1
        if UIAccessibility.isReduceMotionEnabled {completeEnter();return}
        let paperEpoch=CACurrentMediaTime()
        JimiNativeModalV10.enterClose(closeButton,beginTime:paperEpoch)
        CATransaction.begin();CATransaction.setCompletionBlock{[weak self] in self?.completeEnter()}
        JimiNativeModalV10.enter(card:card,flip:flip,key:"gameplay.backpack.return",beginTime:paperEpoch)
        CATransaction.commit()
    }
    func setForeground(_ value:Bool){
        guard !disposed else{return};foreground=value;screen?.setAlertsActive(value && admitted && detail==nil && !closing && !switchingDetail);detail?.setForeground(value)
        if !value {pendingDie=nil;returnSelectionPress?.isEnabled=false}
        if !value,admitted,!switchingDetail,!closing {modalDrag?.cancel()}
        let layer=view.layer
        if !value,layer.speed != 0 {layer.timeOffset=layer.convertTime(CACurrentMediaTime(),from:nil);layer.speed=0}
        else if value,layer.speed==0 {let t=layer.timeOffset;layer.speed=1;layer.timeOffset=0;layer.beginTime=0;layer.beginTime=layer.convertTime(CACurrentMediaTime(),from:nil)-t}
        view.isUserInteractionEnabled=value && (admitted || screen?.entrySelectionEnabled==true) && !closing && !switchingDetail;screen?.isUserInteractionEnabled=value && (admitted || screen?.entrySelectionEnabled==true) && detail==nil
        if value,!admitted {admitReturnTap()}
        tutorialHand?.view.isHidden = !value
        if value {updateTutorialHand()}
    }
    @objc private func close(){
        guard admitted,!closing,!disposed,foreground,detail==nil else{return};closeButton.playArtworkTapFeedback();modalDrag?.cancel(preservePose:true);closing=true;view.isUserInteractionEnabled=false
        tutorialHand?.retire()
        screen?.setAlertsActive(false);onCloseRequested?();onFeedback?("modal-close")
        if UIAccessibility.isReduceMotionEnabled {onHUDCloseRequested?();finishClose();return}
        CATransaction.begin();CATransaction.setCompletionBlock{[weak self] in self?.finishClose()}
        JimiNativeModalV10.exit(card,flip:false,releaseY:card.layer.presentation()?.transform.m42 ?? 0,key:"gameplay.backpack.exit")
        JimiNativeModalV10.exit(flip,flip:true,key:"gameplay.backpack.exit")
        let fade=CAKeyframeAnimation(keyPath:"opacity");fade.values=[1,1,0];fade.keyTimes=[0,0.18,1];fade.duration=0.65;card.layer.opacity=0;card.layer.add(fade,forKey:"gameplay.backpack.fade")
        CATransaction.commit();UIView.animate(withDuration:0.2){self.backdrop.alpha=0}
        scheduleExchange(after:0.65*0.60){[weak self] in
            guard let self,self.closing,!self.disposed else{return}
            self.onHUDCloseRequested?()
        }
    }
    private func finishClose(){guard !disposed else{return};seenUnreadDice=screen?.seenUnreadDice ?? [];let completed=onClosed;dispose();dismiss(animated:false,completion:completed)}
    func dispose(){guard !disposed else{return};if isViewLoaded {NativeTutorialHandMotion.removeExits(in:view)};if let detail,detail.isViewLoaded{NativeTutorialHandMotion.removeExits(in:detail.view)};tutorialHand?.retire(animated:false);tutorialHand=nil;screen?.setEntrySelectionEnabled(false);screen?.setAlertsActive(false);onReadDie=nil;onTutorialGuidanceAdmitted=nil;modalDrag?.dispose();modalDrag=nil;disposed=true;pendingDie=nil;returningDetail=false;returnSelectionPress.map{view.removeGestureRecognizer($0)};returnSelectionPress=nil;exchangeGeneration += 1;exchangeMarker.removeAllAnimations();exchangeMarker.removeFromSuperlayer();motion.cancel();detail?.dispose();detail?.dismiss(animated:false);detail=nil;screen?.onClose=nil;screen?.onDie=nil;[card,restTilt,flip,idle,backdrop,closeButton].forEach{$0.layer.removeAllAnimations()};onHUDCloseRequested=nil;onCloseRequested=nil;onClosed=nil;onFeedback=nil}
}

/// One advisory hand follows the active modal's own transform/pause subtree.
/// Two finite taps settle to a static pointing pose, with no scheduler or loop.
@MainActor
final class NativeCollectionTutorialHand {
    let view=UIView()
    private static let closeAngle:CGFloat = .pi/18
    private static let phoneCloseAngle:CGFloat = .pi/8
    private let image=UIImageView()
    private weak var target:UIView?,host:UIView?,viewport:UIView?
    private var mirrored=false,firstDieCorner=false
    private(set) var phase:String?
    init(image:UIImage?){
        self.image.image=image;self.image.contentMode = .scaleAspectFit
        view.isUserInteractionEnabled=false;view.accessibilityIdentifier="native.tutorial.collection-hand"
        view.addSubview(self.image)
    }
    func point(at target:UIView,in host:UIView,mirrored:Bool,phase:String,viewport:UIView?=nil,firstDieCorner:Bool=false){
        let changed=self.target !== target || self.host !== host || self.phase != phase || self.mirrored != mirrored
        if changed,self.phase != nil,let previousHost=self.host {NativeTutorialHandMotion.exit(image,in:previousHost)}
        self.target=target;self.host=host;self.viewport=viewport;self.mirrored=mirrored;self.phase=phase;self.firstDieCorner=firstDieCorner
        if view.superview !== host {host.addSubview(view)}else{host.bringSubviewToFront(view)}
        view.isHidden=false;view.accessibilityValue=phase;layout()
        if changed {NativeTutorialHandMotion.enter(image)}
        guard changed,!UIAccessibility.isReduceMotionEnabled else{return}
        let pointsClose=phase=="detail-close" || phase=="collection-close"
        let mirrorClose=pointsClose && NativeTabletLayout.applies((self.viewport ?? host).bounds.size)
        let tap=CAKeyframeAnimation(keyPath:"transform")
        tap.duration=1.4;tap.repeatCount=2;tap.keyTimes=[0,0.32,0.46,0.65,1]
        tap.values=zip([0.0,1.0,1.0,0.0,0.0],[1.0,1.0,0.9,1.0,1.0]).map{direction,scale in
            let translation=CATransform3DMakeTranslation((!pointsClose && mirrored ? 1:-1)*direction*5,-direction*5,0)
            let rotated=CATransform3DRotate(translation,pointsClose ? (mirrorClose ? -Self.closeAngle:Self.phoneCloseAngle):0,0,0,1)
            return NSValue(caTransform3D:CATransform3DScale(rotated,mirrorClose ? -scale:scale,scale,1))
        }
        view.layer.add(tap,forKey:"tutorial.collection-hand.tap")
    }
    func layout(){
        guard let target,let host else{return}
        let viewport=self.viewport ?? host
        let origin=host.convert(CGPoint.zero,to:viewport),unit=host.convert(CGPoint(x:1,y:0),to:viewport)
        let projectionScale=max(0.01,hypot(unit.x-origin.x,unit.y-origin.y))
        let pointsClose=phase=="detail-close" || phase=="collection-close"
        let phoneClose=pointsClose && !NativeTabletLayout.applies(viewport.bounds.size)
        let width=NativeTutorialOverlay.handWidth(in:viewport.bounds.width)/projectionScale*(phoneClose ? 0.7:1)
        let height=width*(image.image?.size.height ?? 180)/max(1,image.image?.size.width ?? 180)
        CATransaction.begin();CATransaction.setDisableActions(true)
        view.bounds=CGRect(x:0,y:0,width:width,height:height)
        // The original176px hand has its index fingertip centred at(20,35).
        // Phone reference: smaller upright hand below/right of the X fingertip.
        // Tablet retains its mirrored close guide.
        let corner=phase=="first-die" && firstDieCorner
        view.layer.anchorPoint=pointsClose || corner ? CGPoint(x:corner && mirrored ? 1-20/176.0:20/176.0,y:35/176.0):CGPoint(x:mirrored ? 0.84:0.16,y:0.12)
        if pointsClose,let glyph=(target as? UIButton)?.imageView,!glyph.bounds.isEmpty {
            view.layer.position=glyph.convert(CGPoint(x:glyph.bounds.midX,y:glyph.bounds.midY),to:host)
        }else{
            let tip=corner ? CGPoint(x:target.bounds.width*(mirrored ? 0.1:0.9),y:target.bounds.maxY-target.bounds.height*0.1):CGPoint(x:target.bounds.midX,y:target.bounds.midY)
            view.layer.position=target.convert(tip,to:host)
        }
        if pointsClose {
            let point=host.convert(view.layer.position,to:viewport)
            // Keep the tablet close glyph visible in both collection and detail.
            let tablet=NativeTabletLayout.applies(viewport.bounds.size)
            view.layer.position=host.convert(CGPoint(x:point.x+(tablet ? -12:4),y:point.y+(tablet ? 20:8)),from:viewport)
        }
        let mirrorClose=pointsClose && !phoneClose
        view.transform=pointsClose ? CGAffineTransform(rotationAngle:mirrorClose ? -Self.closeAngle:Self.phoneCloseAngle).scaledBy(x:mirrorClose ? -1:1,y:1):.identity
        image.bounds=view.bounds;image.center=CGPoint(x:width/2,y:height/2)
        image.transform=CGAffineTransform(scaleX:!pointsClose && mirrored ? -1:1,y:1)
        CATransaction.commit()
    }
    func retire(animated:Bool=true){if animated,!view.isHidden,let host {NativeTutorialHandMotion.exit(image,in:host)};image.layer.removeAllAnimations();view.layer.removeAllAnimations();view.removeFromSuperview();target=nil;host=nil;viewport=nil;phase=nil}
}
