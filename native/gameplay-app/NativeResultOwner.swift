import UIKit
import StackToSixGameplay
import StackToSixNativeState

/// Single result lease: logical reward commits once, finite presentation retires once.
@MainActor
final class NativeResultOwner {
    private weak var gameplay: NativeGameplayViewController?
    private let root: URL
    private let resolution: NativeResolution
    private let commit: (Int) throws -> Void
    private let restart: () -> Void
    private let continueArcade: () -> Void
    private let exit: () -> Void
    private var modal: NativeResultController?
    private var reward:NativeJourneyRewardController?
    private var started=false,disposed=false,lease=0
    private let interimJourney:Bool
    private let continueJourney:(()->Void)?
    private let rewardScore:Int?
    var onMoment:((String,Int,Double?)->Void)?
    var onHaptic:((String)->Void)?
    var onError:((Error)->Void)?
    var afterReward:((@escaping ()->Void)->Void)?
    var prepareExit:((@escaping (Bool)->Void)->Void)?
    init(gameplay: NativeGameplayViewController, root: URL, resolution: NativeResolution,
         commit: @escaping (Int) throws -> Void, restart: @escaping () -> Void,
         continueArcade: @escaping () -> Void, exit: @escaping () -> Void,
         interimJourney:Bool=false,rewardScore:Int?=nil,continueJourney:(()->Void)?=nil) {
        self.gameplay=gameplay;self.root=root;self.resolution=resolution
        self.commit=commit;self.restart=restart;self.continueArcade=continueArcade;self.exit=exit
        self.interimJourney=interimJourney;self.rewardScore=rewardScore;self.continueJourney=continueJourney
    }
    func present() {
        guard !disposed,!started,let gameplay,modal==nil,gameplay.presentedViewController==nil else{return}
        started=true;lease += 1;let token=lease
        let state=gameplay.engine.state
        let clean=resolution.kind == .complete
        let arcadeCue=clean && state.mode == .arcade
        let efficiency=clean && !arcadeCue ? NativeRewardMath.efficiencyBonus(baseBonus:500+(state.board-1)*200,
            remainingMoves:state.moves,maxMoves:state.maxMoves,maxStackDepth:state.maxStackDepth) : 0
        let combo=clean && !arcadeCue ? state.earnedComboBonus : 0
        let score=NativeRewardMath.finalScore(currentScore:state.score,comboBonus:combo,efficiencyBonus:efficiency)
        let showResult:()->Void = { [weak self,weak gameplay] in
            guard let self,let gameplay,!self.disposed,self.lease==token else{return}
            self.presentResult(gameplay:gameplay,state:state,clean:clean,combo:combo,efficiency:efficiency,score:score)
        }
        if clean,interimJourney,state.mode == .journey {
            do {try commit(score)} catch {onError?(error);return}
            gameplay.setSuspended(true)
            let card=NativeJourneyRewardController(root:root,board:state.board,score:max(score,rewardScore ?? 0),generation:state.generation)
            reward=card;card.onSoundMoment = { [weak self] kind,index,_ in self?.onMoment?(kind,index,nil) };card.onHaptic=onHaptic
            card.onFinish = { [weak self,weak card] action in
                guard let self,let card,!self.disposed,self.lease==token,self.reward === card else{return}
                self.reward=nil
                card.dismiss(animated:false) {
                    guard !self.disposed,self.lease==token else{return}
                    if action == .collect {if let next=self.afterReward {next(showResult)} else {showResult()}}
                }
            }
            gameplay.present(card,animated:false)
        } else {showResult()}
    }
    private func presentResult(gameplay:NativeGameplayViewController,state:NativeBoardState,clean:Bool,combo:Int,efficiency:Int,score:Int) {
        let sheet=NativeResultController(root:root,state:state,clean:clean,combo:combo,efficiency:efficiency,finalScore:score,interimJourney:interimJourney)
        sheet.onMoment=onMoment
        sheet.onHaptic=onHaptic
        sheet.onCommit = { [weak self] in try self?.commit(score) }
        sheet.onAction = { [weak self,weak sheet] action in
            guard let self,let sheet,self.modal === sheet else {return}
            let preparation:((@escaping (Bool)->Void)->Void)?
            if case .exit=action,state.mode == .journey {preparation=self.prepareExit}else {preparation=nil}
            sheet.close(prepareDestination:preparation) {
                guard self.modal === sheet else {return}
                self.modal=nil
                switch action {case .restart:self.restart();case .exit:self.exit();case .nextRound:self.continueArcade();case .nextJourney:self.continueJourney?()}
            }
        }
        modal=sheet;gameplay.setSuspended(true);gameplay.present(sheet,animated:false)
    }
    func dispose() {disposed=true;lease += 1;let card=reward;reward=nil;card?.dispose(notify:false);card?.dismiss(animated:false);modal?.dispose();modal?.dismiss(animated:false);modal=nil;onMoment=nil;onHaptic=nil;onError=nil;afterReward=nil;prepareExit=nil}
}

/// Authored stars/text/score/result CTA layout; its native clock pauses with the app.
/// Celebration particles, reward cards and ship flybys have separate parity admissions.
@MainActor
final class NativeResultController:UIViewController {
    enum Action {case restart,exit,nextRound,nextJourney}
    let state:NativeBoardState
    let clean:Bool
    let combo:Int
    let efficiency:Int
    let finalScore:Int
    private let interimJourney:Bool
    private let assets:JimiV9Artwork
    private let resourceRoot:URL
    private let headline:String
    private let paperSurface:NativeAppPaperSurface
    private var arcadePresentation:NativeArcadeRoundPresentation?
    private let content=UIView(),cardContent=UIView(),headlineContent=UIView(),statusContent=UIView(),bonusContent=UIView()
    private let stars=UIView()
    private var empty:[UIImageView]=[]
    private var filled:[UIImageView]=[]
    private let heading=UILabel(),scoreLabel=UILabel(),score=UILabel(),status=UILabel(),bonus=UILabel(),bonusLabel=UILabel()
    private let buttons=[JimiV9PlainButton(type:.custom),JimiV9PlainButton(type:.custom)]
    private let thumb=UIImageView()
    private var link:CADisplayLink?
    private var clockTarget:NativeResultClockTarget?
    private var lastTime:CFTimeInterval?
    private(set) var elapsed=0.0
    private var confetti:NativeResultConfettiCanvas?
    private var area55Flybys:NativeResultArea55Flybys?
    private var clickedPrimary=true
    private var capturedStarScales:[Double]=[]
    private var closingAt:Double?
    private var closed:(()->Void)?
    private var destinationPreparation:((@escaping (Bool)->Void)->Void)?
    private var destinationReady=false,destinationPending=false
    private var destinationLease:UInt64=0
    private var preparationFrames=0
    private var paperFadeAt:Double?
    private var paperFadeDuration=0.14
    private var observations:[NSObjectProtocol]=[]
    private var committed=false
    private var commitAttempted=false
    private var disposed=false
    private var suspended=false
    private var commitFault:Error?
    var onCommit:(() throws -> Void)?
    var onAction:((Action)->Void)?
    var onMoment:((String,Int,Double?)->Void)?
    var onHaptic:((String)->Void)?
    private var sentMoments:Set<String>=[]
    private var arcadeCue:Bool {clean && state.mode == .arcade}
    init(root:URL,state:NativeBoardState,clean:Bool,combo:Int,efficiency:Int,finalScore:Int,interimJourney:Bool=false,headlineRandom:Double=Double.random(in:0..<1)) {
        assets=JimiV9Artwork(resourceRoot:root);self.state=state;self.clean=clean
        paperSurface=NativeAppPaperSurface(artwork:assets)
        resourceRoot=root
        self.combo=combo;self.efficiency=efficiency;self.finalScore=finalScore
        self.interimJourney=interimJourney
        headline=NativeResultHeadlines.choose(clean:clean,random:headlineRandom)
        super.init(nibName:nil,bundle:nil);modalPresentationStyle = .overFullScreen
    }
    required init?(coder:NSCoder) {fatalError("Use native result initializer")}
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = arcadeCue ? .clear : UIColor(red:243/255,green:238/255,blue:232/255,alpha:1)
        if !arcadeCue {
            paperSurface.frame=view.bounds;paperSurface.autoresizingMask=[.flexibleWidth,.flexibleHeight];paperSurface.isUserInteractionEnabled=false
            view.addSubview(paperSurface)
        }
        view.addSubview(content);content.addSubview(cardContent);cardContent.addSubview(stars)
        cardContent.addSubview(headlineContent)
        cardContent.addSubview(statusContent);statusContent.addSubview(bonusContent)
        for index in 0..<3 {
            let holder=UIView();stars.addSubview(holder)
            let back=UIImageView(image:assets.image("assets/modals/star-empty.png"))
            let front=UIImageView(image:assets.image("assets/modals/star.png"))
            for image in [back,front] {image.contentMode = .scaleAspectFit;holder.addSubview(image)}
            empty.append(back);filled.append(front)
            holder.transform=CGAffineTransform(rotationAngle:index == 0 ? -.pi*8/180 : index == 2 ? .pi*8/180 : 0)
        }
        let orange=UIColor(red:231/255,green:116/255,blue:73/255,alpha:1)
        let brown=UIColor(red:182/255,green:144/255,blue:119/255,alpha:1)
        let values:[(UILabel,CGFloat,String,UIColor)]=[(heading,clean ? 40 : 56,"ExtraBold",clean ? UIColor(red:176/255,green:127/255,blue:105/255,alpha:1) : orange),
            (scoreLabel,20,"SemiBold",brown),(score,80,"ExtraBold",orange),(status,20,"SemiBold",brown),
            (bonus,36,"ExtraBold",orange),(bonusLabel,18,"SemiBold",UIColor(red:196/255,green:138/255,blue:109/255,alpha:1))]
        for (label,size,weight,color) in values {
            label.font=assets.font(size:size,weight:weight);label.textColor=color;label.textAlignment = .center
            let parent=label === bonus || label === bonusLabel ? bonusContent:label === status ? statusContent:label === heading ? headlineContent:cardContent
            parent.addSubview(label)
        }
        let paragraph=NSMutableParagraphStyle();paragraph.alignment = .center;paragraph.lineBreakMode = .byWordWrapping
        paragraph.minimumLineHeight=clean ? 40:56;paragraph.maximumLineHeight=paragraph.minimumLineHeight
        heading.attributedText=NSAttributedString(string:headline,attributes:[.font:heading.font!,.foregroundColor:heading.textColor!,.paragraphStyle:paragraph])
        heading.numberOfLines=0;heading.lineBreakMode = .byWordWrapping
        if finalScore > state.bestScore {
            let label=NSMutableAttributedString(string:"NEW ",attributes:[.font:assets.font(size:20,weight:"ExtraBold"),.foregroundColor:UIColor(red:233/255,green:122/255,blue:85/255,alpha:1),.kern:0.4])
            label.append(NSAttributedString(string:"Highscore",attributes:[.font:scoreLabel.font!,.foregroundColor:brown,.kern:0.4]))
            scoreLabel.attributedText=label
        } else {scoreLabel.text="Your score"}
        status.text="\(state.mode == .arcade ? String(format:"Round %02d",state.stage) : "Stage \((state.board-1)%10+1)") \(clean ? "cleared" : "not cleared")"
        for (index,button) in buttons.enumerated() {
            button.setTitle(index == 0 ? (clean && interimJourney ? "Continue" : "Play Again") : "Exit",for:.normal)
            button.titleLabel?.font=assets.font(size:28,weight:"Bold")
            button.backgroundColor=index == 0 ? orange : UIColor(red:226/255,green:211/255,blue:198/255,alpha:1)
            button.setTitleColor(index == 0 ? .white : brown,for:.normal);button.layer.cornerRadius=40
            button.tag=index;button.accessibilityIdentifier=index == 0 ? "native.result.play-again" : "native.result.exit"
            button.addTarget(self,action:#selector(activate(_:)),for:.touchUpInside);content.addSubview(button)
        }
        thumb.image=assets.image("assets/thumbs-up@2x.png");thumb.contentMode = .scaleAspectFit;content.addSubview(thumb)
        observations=[NotificationCenter.default.addObserver(forName:UIApplication.willResignActiveNotification,object:nil,queue:.main) { [weak self] _ in MainActor.assumeIsolated{self?.setSuspended(true)} },
            NotificationCenter.default.addObserver(forName:UIApplication.didBecomeActiveNotification,object:nil,queue:.main) { [weak self] _ in MainActor.assumeIsolated{self?.setSuspended(false)} }]
        if arcadeCue {
            content.isHidden=true
            let presentation=NativeArcadeRoundPresentation(resourceRoot:resourceRoot,clearedRound:state.stage,nextRound:state.stage+1)
            presentation.frame=view.bounds;presentation.autoresizingMask=[.flexibleWidth,.flexibleHeight];view.addSubview(presentation)
            arcadePresentation=presentation
            presentation.onNextRoundPresented = { [weak self] in
                guard let self,!self.disposed else {throw CancellationError()}
                try self.onCommit?();self.committed=true
            }
            presentation.onCue = { [weak self] cue in
                guard let self else{return}
                switch cue {
                case .celebrationStarted:self.onMoment?("arcade-victory",0,nil)
                case .thumbWhoosh:self.onMoment?("arcade-thumb",0,nil)
                case .digitEntered(let index):self.onMoment?("arcade-digit",index,nil)
                case .heavyHaptic:self.onHaptic?("heavy")
                default:break
                }
            }
            presentation.onFinished = { [weak self] success in
                guard let self,!self.disposed,success,self.committed else{return}
                let action=self.onAction;self.onAction=nil;action?(.nextRound)
            }
            presentation.start();return
        }
        if clean {
            let theme:NativeResultCelebrationTheme=state.board>20 ? .area55:state.board>10 ? .beach:.forest
            let canvas=NativeResultConfettiCanvas(root:resourceRoot,theme:theme,viewport:view.bounds.size,generation:state.generation)
            canvas.autoresizingMask=[.flexibleWidth,.flexibleHeight];canvas.layer.zPosition=3;view.addSubview(canvas);confetti=canvas
            if theme == .area55 {
                let ships=NativeResultArea55Flybys(root:resourceRoot,viewport:view.bounds.size,generation:state.generation)
                ships.mount(overlay:view,content:content);area55Flybys=ships
            }
        }
        let target=NativeResultClockTarget(owner:self);clockTarget=target
        let link=CADisplayLink(target:target,selector:#selector(NativeResultClockTarget.tick(_:)));self.link=link;link.add(to:.main,forMode:.common)
        paint()
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        content.frame=view.bounds
        let titleWidth=max(1,min(340,view.bounds.width*0.88)-64)
        let measured=heading.sizeThatFits(CGSize(width:titleWidth,height:CGFloat.greatestFiniteMagnitude)).height
        let lineHeight:CGFloat=clean ? 40:56
        let lines=max(1,ceil((measured-0.5)/lineHeight))
        let titleHeight=lines*lineHeight
        let layout=NativeResultPresentationPlan.layout(viewport:view.bounds.size,clean:clean,titleHeight:titleHeight)
        place(cardContent,in:layout.card)
        place(stars,in:layout.hero.offsetBy(dx:-layout.card.minX,dy:-layout.card.minY))
        for index in 0..<3 {
            let holder=empty[index].superview!
            let frame=layout.star(index).offsetBy(dx:-layout.hero.minX,dy:-layout.hero.minY)
            holder.bounds=CGRect(origin:.zero,size:frame.size);holder.center=CGPoint(x:frame.midX,y:frame.midY)
            empty[index].frame=holder.bounds;filled[index].frame=holder.bounds
        }
        place(headlineContent,in:layout.title.offsetBy(dx:-layout.card.minX,dy:-layout.card.minY))
        // CSS line-height permits glyph overhang outside the title's line box.
        // Keep motion on that box while UILabel draws in a padded inner carrier.
        let overhang=max(0,(heading.font.lineHeight-lineHeight)/2)
        heading.frame=headlineContent.bounds.insetBy(dx:0,dy:-overhang)
        place(scoreLabel,in:layout.scoreLabel.offsetBy(dx:-layout.card.minX,dy:-layout.card.minY))
        place(score,in:layout.score.offsetBy(dx:-layout.card.minX,dy:-layout.card.minY))
        place(statusContent,in:layout.status.offsetBy(dx:-layout.card.minX,dy:-layout.card.minY))
        place(status,in:statusContent.bounds)
        place(bonusContent,in:CGRect(x:0,y:statusContent.bounds.midY-30,width:statusContent.bounds.width,height:60))
        bonus.frame=CGRect(x:0,y:0,width:bonusContent.bounds.width,height:36)
        bonusLabel.frame=CGRect(x:0,y:42,width:bonusContent.bounds.width,height:18)
        place(buttons[0],in:layout.primary);place(buttons[1],in:layout.secondary)
        confetti?.frame=view.bounds
    }
    /// Entry and exit poses can be zero-scale during a layout pass. UIKit's
    /// frame setter is undefined then; bounds and center retain the same pose.
    private func place(_ target:UIView,in rect:CGRect) {
        target.bounds=CGRect(origin:.zero,size:rect.size);target.center=CGPoint(x:rect.midX,y:rect.midY)
    }
    func tick(_ timestamp:CFTimeInterval) {
        guard !disposed,!suspended,!arcadeCue else {lastTime=nil;return}
        if let lastTime {elapsed += min(0.1,max(0,timestamp-lastTime))};lastTime=timestamp
        if closingAt != nil,preparationFrames>0 {
            preparationFrames-=1
            if preparationFrames==0 {requestDestinationPreparation()}
        }
        paint()
    }
    private func commitOnce() {
        guard !commitAttempted else {return};commitAttempted=true
        do {try onCommit?();committed=true;commitFault=nil}
        catch {commitFault=error;status.text=error.localizedDescription;status.numberOfLines=0}
    }
    private func apply(_ pose:NativeResultPresentationPlan.Pose,to target:UIView) {
        target.alpha=max(0,min(1,pose.opacity));target.transform=pose.transform
    }
    private var earnedStars:Int {clean ? NativeJourneyContent.earnedStars(score:finalScore,board:state.board):0}
    private func paint() {
        if let closingAt {
            var age=max(0,elapsed-closingAt)
            if !clean,destinationPreparation != nil,!destinationReady,age>0.74 {
                // Fail owns its200ms full-overlay fade at the collapse contact.
                // Retain its initial paper pose until the destination is ready.
                age=0.74;elapsed=closingAt+age
            }
            let earned=earnedStars
            let path:NativeResultExitPlan.CleanPath = !clickedPrimary && state.mode == .journey ? .journeyReturn:.replay
            let plan=clean ? NativeResultExitPlan.clean(seconds:age,earned:earned,path:path,clickedPrimary:clickedPrimary):NativeResultExitPlan.failed(seconds:age,clickedPrimary:clickedPrimary)
            apply(plan.primary,to:buttons[0]);apply(plan.secondary,to:buttons[1]);apply(plan.hero,to:stars);apply(plan.card,to:cardContent)
            let fields=clean ? [headlineContent,scoreLabel,score,statusContent,status]:[headlineContent,status]
            for (field,pose) in zip(fields,plan.content) {apply(pose,to:field)}
            for index in 0..<3 {
                if clean {
                    let pose=NativeResultExitPlan.cleanStar(seconds:age,index:index,earned:earned,capturedScale:capturedStarScales.indices.contains(index) ? capturedStarScales[index]:1)
                    apply(pose,to:filled[index]);empty[index].alpha=0
                } else {apply(NativeResultExitPlan.failedEmptyStar(seconds:age,index:index),to:empty[index])}
            }
            if !clean,destinationPreparation != nil,destinationReady {view.alpha=CGFloat(plan.paperOpacity)}
            if age>=plan.completionSeconds {
                if destinationPreparation != nil {
                    // The source transfers a static opaque paper only after
                    // independent component exits and destination preparation.
                    guard destinationReady else{return}
                    if !clean {finishClose();return}
                    if paperFadeAt == nil {paperFadeAt=elapsed}
                    let progress=min(1,max(0,(elapsed-paperFadeAt!)/paperFadeDuration))
                    view.alpha=CGFloat(1-NativeResultPresentationPlan.bezier(progress,0.25,0.1,0.25,1))
                    if progress>=1 {finishClose()}
                } else {finishClose()}
            };return
        }
        commitOnce();thumb.isHidden=true;scoreLabel.isHidden = !clean;score.isHidden = !clean
        let plan=NativeResultPresentationPlan.sample(seconds:elapsed,clean:clean,baseScore:state.score,combo:combo,efficiency:efficiency)
        for (target,pose) in [(stars,plan.hero),(headlineContent,plan.title),(scoreLabel,plan.scoreLabel),(score,plan.score),(status,plan.status),(buttons[0],plan.primary),(buttons[1],plan.secondary)] {apply(pose,to:target)}
        moment(clean ? "clean-applause":"fail-sax",at:0)
        if clean {
            moment("clean-sax",at:0);moment("clean-count",at:0.47,duration:NativeResultPresentationPlan.counterDuration(from:0,to:state.score))
            moment("clean-bonus",at:2.15,duration:combo>0 ? 1.4:0.8);moment("clean-bonus",at:4.6,duration:efficiency>0 ? 1.4:0.8)
        }
        for index in 0..<3 {
            if clean {
                filled[index].isHidden=index>=earnedStars
                empty[index].alpha=NativeResultPresentationPlan.emptyStarOpacity(seconds:elapsed,index:index,earned:earnedStars)
                let scale=NativeResultPresentationPlan.filledStarScale(seconds:elapsed,index:index)
                filled[index].transform=CGAffineTransform(scaleX:scale,y:scale)
                if index<earnedStars {moment("clean-star",at:0.6+Double(index)*0.5,index:index)}
            } else {
                filled[index].isHidden=true
                let scale=NativeResultPresentationPlan.failedStarScale(seconds:elapsed,index:index)
                empty[index].transform=CGAffineTransform(scaleX:scale,y:scale)
            }
        }
        if clean {
            score.text=plan.displayedScore.formatted()
            let comboVisible=elapsed<3.97
            bonus.isHidden=false;bonusLabel.isHidden=false
            bonus.text="+\(comboVisible ? plan.displayedCombo:plan.displayedEfficiency)"
            bonusLabel.text=comboVisible ? "Combo bonus":"Efficiency"
            let pose=comboVisible ? plan.combo:plan.efficiency
            apply(pose,to:bonusContent)
            confetti?.paint(seconds:elapsed,generation:state.generation)
            area55Flybys?.paint(seconds:elapsed,generation:state.generation)
        } else {bonus.isHidden=true;bonusLabel.isHidden=true}
        for index in 0..<2 {
            let begin=clean ? 6.62+Double(index)*0.35:0.64+Double(index)*0.18
            moment(clean ? "clean-cta":"fail-cta",at:begin,index:index)
            buttons[index].isUserInteractionEnabled=elapsed>=begin+0.34 && committed
        }
        if commitFault != nil {status.alpha=1;status.isHidden=false}
    }
    private func moment(_ kind:String,at time:Double,index:Int=0,duration:Double?=nil) {
        let key="\(kind):\(time):\(index)"
        guard elapsed >= time,!sentMoments.contains(key) else{return};sentMoments.insert(key)
        onMoment?(kind,index,duration)
    }
    @objc private func activate(_ sender:UIButton) {
        guard !disposed,committed,closingAt == nil,!suspended,sender.isUserInteractionEnabled else {return}
        clickedPrimary=sender.tag==0
        onMoment?("cta",sender.tag,nil);onHaptic?("selection")
        for button in buttons {button.isUserInteractionEnabled=false}
        onAction?(sender.tag == 0 ? (clean && interimJourney ? .nextJourney : .restart) : .exit);onAction=nil
    }
    func close(prepareDestination:((@escaping (Bool)->Void)->Void)?=nil,paperFadeDuration:Double=0.14,completion:@escaping ()->Void) {
        guard closingAt == nil,!disposed else {return}
        if arcadeCue {dispose();dismiss(animated:false,completion:completion);return}
        capturedStarScales=(0..<3).map{NativeResultPresentationPlan.filledStarScale(seconds:elapsed,index:$0)}
        confetti?.dispose();confetti=nil;area55Flybys?.dispose();area55Flybys=nil;closingAt=elapsed;closed=completion
        destinationPreparation=prepareDestination;self.paperFadeDuration=max(0.001,paperFadeDuration)
        preparationFrames=prepareDestination == nil ? 0:2
    }
    private func requestDestinationPreparation() {
        guard !disposed,!suspended,!destinationPending,!destinationReady,let destinationPreparation else{return}
        destinationPending=true;destinationLease &+= 1;let lease=destinationLease
        destinationPreparation { [weak self] ready in
            guard let self,!self.disposed,!self.suspended,self.destinationLease==lease else{return}
            self.destinationPending=false;self.destinationReady=ready
        }
    }
    private func finishClose() {let completion=closed;closed=nil;dispose();dismiss(animated:false,completion:completion)}
    func setSuspended(_ value:Bool) {
        suspended=value;lastTime=nil;link?.isPaused=value;arcadePresentation?.setSuspended(value);confetti?.setForeground(!value);area55Flybys?.setForeground(!value)
        if destinationPreparation != nil {
            if value {destinationLease &+= 1;destinationReady=false;destinationPending=false;paperFadeAt=nil;view.alpha=1}
            else {preparationFrames=2}
        }
    }
    func dispose() {
        guard !disposed else {return};disposed=true;link?.invalidate();link=nil;clockTarget=nil
        arcadePresentation?.dispose();arcadePresentation=nil;confetti?.dispose();confetti=nil;area55Flybys?.dispose();area55Flybys=nil
        for observer in observations {NotificationCenter.default.removeObserver(observer)};observations.removeAll()
        destinationLease &+= 1;destinationPreparation=nil;destinationPending=false
        closed=nil;onAction=nil;onCommit=nil;onHaptic=nil;onMoment=nil
    }
}
@MainActor
private final class NativeResultClockTarget:NSObject {
    weak var owner:NativeResultController?
    init(owner:NativeResultController) {self.owner=owner}
    @objc func tick(_ link:CADisplayLink) {owner?.tick(link.timestamp)}
}
