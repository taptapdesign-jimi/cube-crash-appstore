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
              gameplay.engine.state.tutorial?.shouldLockHUD != true,
              gameplay.engine.state.effectiveArcadeVariant != .pureDice,
              UIApplication.shared.applicationState == .active else{return}
        let state=gameplay.engine.state
        let sections=NativeBackpackCatalog.sections(progression()).filter { section in
            state.mode == .journey && section.dice.contains {($0.board-1)/10 == (state.board-1)/10}
        }
        guard let app=gameplay.parent as? NativeAppController else{return}
        let controller=NativeGameplayBackpackController(root:root,sections:sections,includesArcade:state.mode == .arcade,motion:NativeRouteMotion(home:app.home,hub:app.hub))
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
        }
        controller.onReadDie={[weak self] id in self?.onReadDie?(id) ?? false}
        controller.onFeedback={[weak self] cue in self?.onFeedback?(cue)}
        gameplay.present(controller,animated:false)
    }
    func present(combo:Bool) {
        guard let gameplay,sheet==nil,gameplay.presentedViewController==nil,
            gameplay.boardScene?.navigationLocked != true,gameplay.engine.state.terminal==nil,
            gameplay.engine.state.tutorial?.shouldLockHUD != true,
            UIApplication.shared.applicationState == .active else{return}
        gameplay.setSuspended(true);lease += 1;let token=lease
        let modal=NativeScoreModal(model:.init(state:gameplay.engine.state,progression:progression(),combo:combo),root:root)
        sheet=modal;onFeedback?("hud-modal-open");onFeedback?(combo ? "combo-modal-speech":"high-score-modal-speech")
        modal.onCloseRequested = { [weak self] in guard let self,self.lease==token else{return};self.onFeedback?("modal-close") }
        modal.onClosed = { [weak self] in guard let self,self.lease==token else{return};self.sheet=nil;self.gameplay?.setSuspended(false) }
        gameplay.present(modal,animated:false)
    }
    func dispose() {lease += 1;backpack?.dispose();backpack?.dismiss(animated:false);backpack=nil;sheet?.dispose();sheet?.dismiss(animated:false);sheet=nil;for token in observers {NotificationCenter.default.removeObserver(token)};observers.removeAll();gameplay?.onHelp=nil;gameplay?.onScore=nil;gameplay?.onCombo=nil;gameplay=nil;onFeedback=nil;onReadDie=nil}
}

/// Gameplay retains its exact paused generation while the scoped collection modal is visible.
@MainActor
final class NativeGameplayBackpackController:UIViewController {
    private(set) var seenUnreadDice=Set<String>()
    private let assets:JimiV9Artwork,sections:[NativeBackpackCatalog.Section],includesArcade:Bool
    private let motion:NativeRouteMotion
    let card=UIView(),heading=UILabel(),subtitle=UILabel()
    private let flip=JimiNativeModalTransformView(),idle=UIView(),paper=UIImageView(),backdrop=JimiV9PlainButton(type:.custom),closeButton=JimiV9PlainButton(type:.custom)
    private(set) var screen:NativeBackpackView?
    private(set) var detail:NativeBackpackDetail?
    private(set) var modalDrag:JimiNativeModalDrag?
    private let exchangeMarker=CALayer()
    private var exchangeGeneration=0
    private var pendingDie:NativeBackpackCatalog.Die?
    private var returningDetail=false
    private(set) var returnSelectionPress:UILongPressGestureRecognizer?
    private(set) var switchingDetail=false
    private var foreground=true,closing=false,entered=false,admitted=false,disposed=false
    var onReadDie:((String)->Bool)?
    var onHUDCloseRequested:(()->Void)?
    var onCloseRequested:(()->Void)?,onClosed:(()->Void)?,onFeedback:((String)->Void)?
    init(root:URL,sections:[NativeBackpackCatalog.Section],includesArcade:Bool,motion:NativeRouteMotion) {
        assets=JimiV9Artwork(resourceRoot:root);self.sections=sections;self.includesArcade=includesArcade;self.motion=motion
        super.init(nibName:nil,bundle:nil);modalPresentationStyle = .overFullScreen
    }
    required init?(coder:NSCoder){fatalError("Use scoped initializer")}
    override func loadView() {
        view=UIView();view.backgroundColor = .clear;view.accessibilityViewIsModal=true
        var camera=CATransform3DIdentity;camera.m34 = -1/920;view.layer.sublayerTransform=camera
        backdrop.accessibilityIdentifier="native.gameplay.backpack.backdrop"
        backdrop.backgroundColor=JimiNativeModalV10.backdropColor;backdrop.alpha=0
        backdrop.addTarget(self,action:#selector(close),for:.touchUpInside)
        view.addSubview(backdrop);view.addSubview(card);card.addSubview(flip);flip.addSubview(idle);idle.addSubview(paper)
        card.layer.anchorPoint=CGPoint(x:0.5,y:0.55);flip.layer.anchorPoint=CGPoint(x:0.5,y:1);idle.layer.anchorPoint=CGPoint(x:0.5,y:0.52)
        card.alpha=0;card.accessibilityIdentifier="native.gameplay.backpack-modal";idle.layer.isDoubleSided=false
        paper.image=assets.image("assets/modals/paper.png");paper.layer.cornerRadius=40;paper.clipsToBounds=true
        idle.layer.shadowColor=UIColor(red:185/255,green:145/255,blue:119/255,alpha:1).cgColor
        idle.layer.shadowOpacity=0.8;idle.layer.shadowOffset=CGSize(width:0,height:13);idle.layer.shadowRadius=16.8
        heading.text=includesArcade ? "Box":"Backpack";heading.textAlignment = .center
        heading.font=assets.font(size:28,weight:"ExtraBold");heading.textColor=NativeTextPalette.modalTitle
        idle.addSubview(heading)
        let world=sections.first?.title ?? "Arcade"
        let copy:String
        switch world {
        case "Forest":copy="Little wonders, big forest magic!"
        case "Beach":copy="Splashy pals, sunny surprises!"
        case "Area 55":copy="Cosmic pals, out-of-this-world surprises!"
        default:copy="Boom, swoop, hop — ready to play!"
        }
        subtitle.text="\(world) \(includesArcade ? "crate":"backpack") items\n\(copy)";subtitle.numberOfLines=0;subtitle.textAlignment = .center
        subtitle.font=assets.font(size:18,weight:"Medium");subtitle.textColor=NativeTextPalette.subtitle
        subtitle.attributedText=NativeModalTypography.attributedSubtitle(subtitle.text ?? "",font:subtitle.font)
        idle.addSubview(subtitle)
        let screen=NativeBackpackView(frame:.zero,assets:assets,title:includesArcade ? "Box":"Backpack",arcadeCrate:includesArcade);self.screen=screen
        screen.useModalLayout();screen.apply(sections,includesArcade:includesArcade);idle.addSubview(screen)
        screen.onDie={[weak self] die in self?.open(die)}
        closeButton.setBackgroundImage(paper.image,for:.normal);closeButton.layer.cornerRadius=26;closeButton.clipsToBounds=true
        closeButton.setImage(assets.image("assets/close-icon.png",densityAware:true),for:.normal);closeButton.imageView?.contentMode = .scaleAspectFit;closeButton.artworkOpacity = 0.8;closeButton.enableArtworkTapFeedback()
        closeButton.imageEdgeInsets=UIEdgeInsets(top:14,left:14,bottom:14,right:14);closeButton.accessibilityIdentifier="native.gameplay.backpack.close"
        closeButton.accessibilityLabel=includesArcade ? "Close Box":"Close Backpack";closeButton.addTarget(self,action:#selector(close),for:.touchUpInside);idle.addSubview(closeButton)
        modalDrag=JimiNativeModalDrag(target:card,idle:idle,viewport:view,canDrag:{[weak self] in
            guard let self else{return false}
            return self.foreground && self.admitted && !self.closing && !self.disposed && !self.switchingDetail && self.detail==nil
        },onDismiss:{[weak self] in self?.close()})
        let tap=UILongPressGestureRecognizer(target:self,action:#selector(returnSelectionPressed(_:)))
        tap.minimumPressDuration=0;tap.isEnabled=false;view.addGestureRecognizer(tap);returnSelectionPress=tap
        view.isUserInteractionEnabled=false
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews();backdrop.frame=view.bounds
        let width=min(390,max(0,view.bounds.width-48))
        heading.frame=CGRect(x:24,y:28,width:max(0,width-48),height:38.4)
        let subtitleHeight=ceil(subtitle.sizeThatFits(CGSize(width:max(0,width-48),height:CGFloat.greatestFiniteMagnitude)).height)
        subtitle.frame=CGRect(x:24,y:heading.frame.maxY+12,width:max(0,width-48),height:subtitleHeight)
        let count=includesArcade ? NativeBackpackCatalog.arcade.count:sections.first?.dice.count ?? 0
        let columns:CGFloat=2,side=floor((width-48-(columns-1)*16)/columns)
        let rows=ceil(CGFloat(count)/columns),gridHeight=rows*side+max(0,rows-1)*16
        let height=min(subtitle.frame.maxY+24+gridHeight+32,max(0,view.bounds.height-view.safeAreaInsets.top-view.safeAreaInsets.bottom-48))
        card.bounds=CGRect(x:0,y:0,width:width,height:height);card.center=CGPoint(x:view.bounds.midX,y:view.safeAreaInsets.top+(view.bounds.height-view.safeAreaInsets.top-view.safeAreaInsets.bottom)/2)
        flip.bounds=card.bounds;flip.center=CGPoint(x:width/2,y:height);idle.bounds=card.bounds;idle.center=CGPoint(x:width/2,y:height*0.52)
        // Crop the authored folded paper tail just as selected Backpack details do.
        JimiNativeModalV10.paperLayout(paper,bounds:idle.bounds,bottomExtension:96)
        screen?.frame=CGRect(x:0,y:subtitle.frame.maxY+24,width:width,height:max(0,height-subtitle.frame.maxY-24-32))
        closeButton.frame=CGRect(x:width-42,y:-10,width:52,height:52)
    }
    override func viewDidAppear(_ animated:Bool) {
        super.viewDidAppear(animated);guard !closing,!entered,!disposed else{return};entered=true;card.alpha=1
        if UIAccessibility.isReduceMotionEnabled {completeEnter();backdrop.alpha=1;return}
        CATransaction.begin();CATransaction.setCompletionBlock{[weak self] in self?.completeEnter()}
        JimiNativeModalV10.enter(card:card,flip:flip,key:"gameplay.backpack.enter");CATransaction.commit()
        UIView.animate(withDuration:0.5){self.backdrop.alpha=1}
    }
    private func completeEnter(){
        guard !closing,!disposed else{return};admitted=true
        JimiNativeModalV10.startIdle(on:idle,key:"backpack.collection.idle")
        view.isUserInteractionEnabled=foreground && !switchingDetail;screen?.isUserInteractionEnabled=foreground && !switchingDetail
        screen?.setAlertsActive(foreground && !switchingDetail)
        guard !switchingDetail else{return}
        returningDetail=false;returnSelectionPress?.isEnabled=false;card.isUserInteractionEnabled=true
        let next=pendingDie;pendingDie=nil
        if let next,foreground {open(next)}
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
        guard foreground,admitted,!closing,!disposed,!switchingDetail,detail==nil,presentedViewController==nil else{return}
        screen?.setAlertsActive(false)
        pendingDie=nil;returningDetail=false;returnSelectionPress?.isEnabled=false
        onFeedback?("tab")
        modalDrag?.cancel()
        idle.layer.removeAnimation(forKey:"backpack.collection.idle")
        let detail=NativeBackpackDetail(die:die,assets:assets,motion:motion)
        detail.usesParentBackdrop=true;detail.entersImmediately=true
        self.detail=detail;switchingDetail=true;admitted=false;view.isUserInteractionEnabled=false
        detail.onPresentationStarted={[weak self,weak detail] in
            guard let self,let detail,self.detail === detail,!self.disposed,self.foreground else{return}
            self.onFeedback?("exit-modal")
            if self.onReadDie?(die.id)==true {self.screen?.markRead(die.id)}
        }
        detail.onCloseRequested={[weak self,weak detail] in
            guard let self,self.detail === detail,!self.disposed else{return}
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
        scheduleExchange(after:0.65*0.3){[weak self,weak detail] in
            guard let self,let detail,!self.disposed,!self.closing,self.detail === detail else{return}
            self.present(detail,animated:false){[weak self,weak detail] in
                guard let self,let detail,!self.disposed,self.detail === detail else{return}
                detail.beginImmediatePresentation()
            }
        }
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
        CATransaction.begin();CATransaction.setCompletionBlock{[weak self] in self?.completeEnter()}
        JimiNativeModalV10.enter(card:card,flip:flip,key:"gameplay.backpack.return")
        CATransaction.commit()
    }
    func setForeground(_ value:Bool){
        guard !disposed else{return};foreground=value;screen?.setAlertsActive(value && admitted && detail==nil && !closing && !switchingDetail);detail?.setForeground(value)
        if !value {pendingDie=nil;returnSelectionPress?.isEnabled=false}
        if !value,admitted,!switchingDetail,!closing {modalDrag?.cancel()}
        let layer=view.layer
        if !value,layer.speed != 0 {layer.timeOffset=layer.convertTime(CACurrentMediaTime(),from:nil);layer.speed=0}
        else if value,layer.speed==0 {let t=layer.timeOffset;layer.speed=1;layer.timeOffset=0;layer.beginTime=0;layer.beginTime=layer.convertTime(CACurrentMediaTime(),from:nil)-t}
        view.isUserInteractionEnabled=value && admitted && !closing && !switchingDetail;screen?.isUserInteractionEnabled=value && admitted && detail==nil
        if value,!admitted {admitReturnTap()}
    }
    @objc private func close(){
        guard admitted,!closing,!disposed,foreground,detail==nil else{return};closeButton.playArtworkTapFeedback();modalDrag?.cancel(preservePose:true);closing=true;view.isUserInteractionEnabled=false
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
    func dispose(){guard !disposed else{return};screen?.setAlertsActive(false);onReadDie=nil;modalDrag?.dispose();modalDrag=nil;disposed=true;pendingDie=nil;returningDetail=false;returnSelectionPress.map{view.removeGestureRecognizer($0)};returnSelectionPress=nil;exchangeGeneration += 1;exchangeMarker.removeAllAnimations();exchangeMarker.removeFromSuperlayer();motion.cancel();detail?.dispose();detail?.dismiss(animated:false);detail=nil;screen?.onClose=nil;screen?.onDie=nil;[card,flip,idle,backdrop].forEach{$0.layer.removeAllAnimations()};onHUDCloseRequested=nil;onCloseRequested=nil;onClosed=nil;onFeedback=nil}
}
