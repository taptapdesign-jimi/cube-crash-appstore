import UIKit
import CoreImage
import StackToSixGameplay
import StackToSixNativeState

/// Single result lease: logical reward commits once, finite presentation retires once.
@MainActor
final class NativeResultOwner {
    private weak var gameplay: NativeGameplayViewController?
    private let root: URL
    private let resolution: NativeResolution
    private let sourceNoMovesReceipt: NativeSourceNoMovesCompletedReceipt?
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
    private let previousRewardStars:Int
    var onForestAmbience:((Bool,Bool)->Void)?
    var onMoment:((String,Int,Double?)->Void)?
    var onHaptic:((String)->Void)?
    var onError:((Error)->Void)?
    var onSourceFinalCleanup:((NativeSourceNoMovesCompletedReceipt)->Void)?
    var prepareExit:((@escaping (Bool)->Void)->Void)?
    static func finalScore(state:NativeBoardState,clean:Bool)->Int {
        let efficiency=clean ? NativeRewardMath.efficiencyBonus(baseBonus:500+(state.board-1)*200,
            remainingMoves:state.moves,maxMoves:state.maxMoves,maxStackDepth:state.maxStackDepth) : 0
        return NativeRewardMath.finalScore(currentScore:state.score,comboBonus:clean ? state.earnedComboBonus:0,efficiencyBonus:efficiency)
    }
    private static func removeReward(_ card:NativeJourneyRewardController,completion:@escaping ()->Void) {
        if card.parent != nil {
            card.willMove(toParent:nil);card.view.removeFromSuperview();card.removeFromParent();completion()
        } else if card.presentingViewController != nil {card.dismiss(animated:false,completion:completion)}
        else {completion()}
    }
    init(gameplay: NativeGameplayViewController, root: URL, resolution: NativeResolution,
         commit: @escaping (Int) throws -> Void, restart: @escaping () -> Void,
         continueArcade: @escaping () -> Void, exit: @escaping () -> Void,
         interimJourney:Bool=false,rewardScore:Int?=nil,continueJourney:(()->Void)?=nil,
         sourceNoMovesReceipt:NativeSourceNoMovesCompletedReceipt?=nil,previousRewardStars:Int=0) {
        self.previousRewardStars=previousRewardStars
        self.gameplay=gameplay;self.root=root;self.resolution=resolution;self.sourceNoMovesReceipt=sourceNoMovesReceipt
        self.commit=commit;self.restart=restart;self.continueArcade=continueArcade;self.exit=exit
        self.interimJourney=interimJourney;self.rewardScore=rewardScore;self.continueJourney=continueJourney
    }
    func present() {
        guard !disposed,!started,let gameplay,modal==nil,gameplay.presentedViewController==nil else{return}
        if let receipt=sourceNoMovesReceipt {
            guard receipt.admits(generation:gameplay.engine.state.generation,resolution:resolution),
                gameplay.engine.completedSourceNoMovesReceipt==receipt,
                gameplay.engine.state.terminal==resolution else{return}
        }
        // Source's real board exit is already acknowledged by Core. This owner
        // mounts the existing result sheet directly; it never replays text/exit.
        started=true;lease += 1;let token=lease
        let state=gameplay.engine.state
        // Reached-run success is presentation only; the captured terminal resolution
        // still commits a loss, so it cannot queue an uncleared next round.
        let arcadeReached=resolution.kind == .fail && state.mode == .arcade && state.board>=2
        let clean=resolution.kind == .complete || arcadeReached
        // Arcade bonuses belong to the final reached-run summary. Real round
        // clears retain their existing automatic cue and carry the raw score.
        // The captured fail resolution still prevents next-round progression.
        let awardsCleanBonus=clean && (state.mode != .arcade || arcadeReached)
        let efficiency=awardsCleanBonus ? NativeRewardMath.efficiencyBonus(baseBonus:500+(state.board-1)*200,
            remainingMoves:state.moves,maxMoves:state.maxMoves,maxStackDepth:state.maxStackDepth) : 0
        let combo=awardsCleanBonus ? state.earnedComboBonus : 0
        let score=Self.finalScore(state:state,clean:awardsCleanBonus)
        let showResult:()->Void = { [weak self,weak gameplay] in
            guard let self,let gameplay,!self.disposed,self.lease==token else{return}
            self.presentResult(gameplay:gameplay,state:state,clean:clean,combo:combo,efficiency:efficiency,score:score,arcadeReached:arcadeReached)
        }
        if clean,interimJourney,state.mode == .journey {
            do {try commit(score)} catch {
                gameplay.takePreparedJourneyReward(generation:state.generation)?.dispose(notify:false)
                onError?(error);return
            }
            gameplay.setSuspended(true)
            let prepared=gameplay.takePreparedJourneyReward(generation:state.generation)
            let stars=max(previousRewardStars,NativeJourneyContent.earnedStars(score:score,board:state.board))
            let card=prepared ?? NativeJourneyRewardController(root:root,board:state.board,score:max(score,rewardScore ?? 0),generation:state.generation,awardedStars:stars)
            reward=card;card.onSoundMoment = { [weak self] kind,index,_ in self?.onMoment?(kind,index,nil) };card.onHaptic=onHaptic
            card.onAssetFailure = { [weak self,weak card,weak gameplay] message in
                guard let self,let card,let gameplay,!self.disposed,self.lease==token,self.reward === card,
                      gameplay.engine.state.generation==state.generation else{return}
                self.reward=nil;card.dispose(notify:false)
                Self.removeReward(card) {
                    guard !self.disposed,self.lease==token,gameplay.engine.state.generation==state.generation else{return}
                    showResult()
                    self.onError?(NSError(domain:"NativeJourneyReward",code:1,userInfo:[NSLocalizedDescriptionKey:message]))
                }
            }
            card.onFinish = { [weak self,weak card,weak gameplay] action in
                guard let self,let card,let gameplay,!self.disposed,self.lease==token,self.reward === card,
                      gameplay.engine.state.generation==state.generation else{return}
                self.reward=nil
                Self.removeReward(card) {
                    guard !self.disposed,self.lease==token,gameplay.engine.state.generation==state.generation else{return}
                    if action == .collect {showResult()}
                }
            }
            card.loadViewIfNeeded()
            if card.phase=="asset-failed" {card.onAssetFailure?("Selected Native reward artwork preparation failed")}
            card.whenMagicCardPrepared { [weak self,weak card,weak gameplay] in
                guard let self,let card,let gameplay,!self.disposed,self.lease==token,self.reward === card,
                      gameplay.engine.state.generation==state.generation else{return}
                gameplay.mountJourneyRewardController(card,generation:state.generation)
            }
        } else {showResult()}
    }
    private func presentResult(gameplay:NativeGameplayViewController,state:NativeBoardState,clean:Bool,combo:Int,efficiency:Int,score:Int,arcadeReached:Bool) {
        let sheet=gameplay.takePreparedJourneyResult(generation:state.generation) ?? NativeResultController(root:root,state:state,clean:clean,combo:combo,efficiency:efficiency,finalScore:score,interimJourney:interimJourney,arcadeReached:arcadeReached,arcadeCelebrationPresented:gameplay.hasPresentedBoardCleared)
        sheet.onForestAmbience=onForestAmbience
        sheet.onMoment=onMoment
        sheet.onHaptic=onHaptic
        sheet.onCommit = { [weak self] in try self?.commit(score) }
        sheet.onAction = { [weak self,weak sheet] action in
            guard let self,let sheet,self.modal === sheet else {return}
            // Only the completed first-play Journey result returns to its
            // retained World. Later ordinary Continue keeps advancing Units.
            var destination=action
            if case .nextJourney=action,clean,state.mode == .journey,state.tutorial?.requiresResultCompletion==true {destination = .exit}
            let preparation:((@escaping (Bool)->Void)->Void)?
            if case .exit=destination,state.mode == .journey {preparation=self.prepareExit}else {preparation=nil}
            sheet.close(prepareDestination:preparation) {
                guard self.modal === sheet else {return}
                self.finishSourceFinalCleanup()
                guard !self.disposed,self.modal === sheet else{return}
                self.modal=nil
                switch destination {case .restart:self.restart();case .exit:self.exit();case .nextRound:self.continueArcade();case .nextJourney:self.continueJourney?()}
            }
        }
        sheet.followsConfirmedNoMoves = sourceNoMovesReceipt != nil
        modal=sheet;sheet.admitPreparedHandoff();gameplay.setSuspended(true);onMoment?("modal-open",0,nil);gameplay.present(sheet,animated:false)
        if let receipt=sourceNoMovesReceipt {
            gameplay.boardScene?.traceNoMovesHandoff("result-mount",token:receipt.planToken,owner:sheet,mounted:sheet.view.window != nil)
        }
    }
    private func finishSourceFinalCleanup() {
        let callback=onSourceFinalCleanup;onSourceFinalCleanup=nil
        if let receipt=sourceNoMovesReceipt {callback?(receipt)}
    }
    func dispose() {disposed=true;lease += 1;finishSourceFinalCleanup();let card=reward;reward=nil;card?.dispose(notify:false);if let card {Self.removeReward(card,completion:{})};modal?.dispose();modal?.dismiss(animated:false);modal=nil;onMoment=nil;onForestAmbience=nil;onHaptic=nil;onError=nil;prepareExit=nil}
}

/// Authored stars/text/score/result CTA layout; its native clock pauses with the app.
/// Celebration particles, reward cards and ship flybys have separate parity admissions.
@MainActor
final class NativeResultController:UIViewController {
    var followsConfirmedNoMoves=false
    enum Action {case restart,exit,nextRound,nextJourney}
    let state:NativeBoardState
    let clean:Bool
    let arcadeReached:Bool
    let combo:Int
    let efficiency:Int
    let finalScore:Int
    private let interimJourney:Bool
    private let assets:JimiV9Artwork
    private let resourceRoot:URL
    private let headline:String
    private let paperSurface:NativeAppPaperSurface
    private let arcadeCelebrationPresented:Bool
    private var arcadePresentation:NativeArcadeRoundPresentation?
    private let content=UIView(),cardContent=UIView(),headlineContent=UIView(),statusContent=UIView(),bonusContent=UIView()
    private let scoreMotion=UIView(),scoreShake=UIView()
    private let scoreBlur=UIImageView()
    private var scoreBlurContext:CIContext?
    private var scoreBlurInput:CIImage?
    private var scoreBlurText:String?
    private var scoreBlurSize=CGSize.zero
    private var scoreBlurRadius:Double = -1
    private let scoreBlurScale:CGFloat=2
    private let scoreBlurPadding:CGFloat=12
    private var scoreAccentVisible=false
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
    private var forestBees:NativeResultForestBees?
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
    private var presentationAdmitted=true
    private var commitFault:Error?
    var onCommit:(() throws -> Void)?
    var onAction:((Action)->Void)?
    var onForestAmbience:((Bool,Bool)->Void)?
    var onMoment:((String,Int,Double?)->Void)?
    var onHaptic:((String)->Void)?
    private var sentMoments:Set<String>=[]
    var celebrationTheme:NativeResultCelebrationTheme {
        if state.mode == .arcade {return state.lastSpecialMergeWorld.flatMap(NativeResultCelebrationTheme.init(rawValue:)) ?? .area55}
        return state.board>20 ? .area55:state.board>10 ? .beach:.forest
    }
    private var arcadeCue:Bool {clean && state.mode == .arcade && !arcadeReached}
    private var scoreOnlyArcadeSummary:Bool {arcadeReached && combo==0 && efficiency==0}
    init(root:URL,state:NativeBoardState,clean:Bool,combo:Int,efficiency:Int,finalScore:Int,interimJourney:Bool=false,arcadeReached:Bool=false,arcadeCelebrationPresented:Bool=false,headlineRandom:Double=Double.random(in:0..<1)) {
        self.arcadeCelebrationPresented=arcadeCelebrationPresented
        assets=JimiV9Artwork(resourceRoot:root);self.state=state;self.clean=clean;self.arcadeReached=arcadeReached
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
        cardContent.addSubview(scoreMotion);scoreMotion.addSubview(scoreShake)
        scoreMotion.accessibilityIdentifier="native.result.score-motion"
        scoreShake.addSubview(scoreBlur)
        for index in 0..<3 {
            let holder=UIView();stars.addSubview(holder)
            let back=UIImageView(image:assets.image("assets/modals/star-empty.png"))
            let front=UIImageView(image:assets.image("assets/modals/star.png"))
            for image in [back,front] {image.contentMode = .scaleAspectFit;holder.addSubview(image)}
            back.accessibilityIdentifier="native.result.star.empty.\(index)"
            front.accessibilityIdentifier="native.result.star.filled.\(index)"
            empty.append(back);filled.append(front)
            holder.transform=CGAffineTransform(rotationAngle:index == 0 ? -.pi*8/180 : index == 2 ? .pi*8/180 : 0)
        }
        let orange=UIColor(red:231/255,green:116/255,blue:73/255,alpha:1)
        let brown=NativeTextPalette.subtitle
        let values:[(UILabel,CGFloat,String,UIColor)]=[(heading,clean ? 40 : 56,"ExtraBold",orange),
            (scoreLabel,18,"SemiBold",brown),(score,80,"ExtraBold",orange),(status,18,"SemiBold",brown),
            (bonus,36,"ExtraBold",orange),(bonusLabel,18,"SemiBold",NativeTextPalette.subtitle)]
        for (label,size,weight,color) in values {
            label.font=assets.font(size:size,weight:weight);label.textColor=color;label.textAlignment = .center
            let parent=label === bonus || label === bonusLabel ? bonusContent:label === status ? statusContent:label === heading ? headlineContent:label === score ? scoreShake:cardContent
            parent.addSubview(label)
        }
        let paragraph=NSMutableParagraphStyle();paragraph.alignment = .center;paragraph.lineBreakMode = .byWordWrapping
        paragraph.minimumLineHeight=clean ? 40:56;paragraph.maximumLineHeight=paragraph.minimumLineHeight
        heading.attributedText=NSAttributedString(string:headline,attributes:[.font:heading.font!,.foregroundColor:heading.textColor!,.paragraphStyle:paragraph])
        heading.numberOfLines=0;heading.lineBreakMode = .byWordWrapping
        if finalScore > state.bestScore {
            let label=NSMutableAttributedString(string:"NEW ",attributes:[.font:assets.font(size:18,weight:"ExtraBold"),.foregroundColor:NativeTextPalette.subtitle,.kern:0.4])
            label.append(NSAttributedString(string:"Highscore",attributes:[.font:scoreLabel.font!,.foregroundColor:brown,.kern:0.4]))
            scoreLabel.attributedText=label
        } else {scoreLabel.text="Your score"}
        scoreBlur.isAccessibilityElement=false;scoreBlur.isUserInteractionEnabled=false;scoreBlur.isHidden=true
        scoreBlur.accessibilityIdentifier="native.result.score-motion-blur"
        score.accessibilityIdentifier="native.result.score"
        status.accessibilityIdentifier="native.result.status"
        status.text="\(state.mode == .arcade ? String(format:"Round %02d",state.stage) : String(format:"%@ %02d",state.board>20 ? "Area":state.board>10 ? "Beach":"Forest",(state.board-1)%10+1)) \(arcadeReached ? "reached" : clean ? "cleared" : "not cleared")"
        for (index,button) in buttons.enumerated() {
            button.setTitle(index == 0 ? (clean && interimJourney ? "Continue" : "Play Again") : "Exit",for:.normal)
            button.applyModalCTA(artwork:assets,primary:index == 0)
            button.setPairedModalCTA(independentIdleIndex:index)
            button.tag=index;button.accessibilityIdentifier=index == 0 ? "native.result.play-again" : "native.result.exit"
            button.addTarget(self,action:#selector(activate(_:)),for:.touchUpInside);content.addSubview(button);button.enableCartoonBounce()
        }
        thumb.image=assets.image("assets/thumbs-up@2x.png");thumb.contentMode = .scaleAspectFit;content.addSubview(thumb)
        observations=[NotificationCenter.default.addObserver(forName:UIApplication.willResignActiveNotification,object:nil,queue:.main) { [weak self] _ in MainActor.assumeIsolated{self?.setSuspended(true)} },
            NotificationCenter.default.addObserver(forName:UIApplication.didBecomeActiveNotification,object:nil,queue:.main) { [weak self] _ in MainActor.assumeIsolated{self?.setSuspended(false)} }]
        if arcadeCue {
            content.isHidden=true
            let presentation=NativeArcadeRoundPresentation(resourceRoot:resourceRoot,clearedRound:state.stage,nextRound:state.stage+1,continuationOnly:arcadeCelebrationPresented)
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
                case .thumbWhoosh:self.onMoment?("arcade-thumb",self.arcadePresentation?.isPuppyThumb == true ? 1:0,nil)
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
            let theme=celebrationTheme
            let canvas=NativeResultConfettiCanvas(root:resourceRoot,theme:theme,viewport:view.bounds.size,generation:state.generation)
            canvas.autoresizingMask=[.flexibleWidth,.flexibleHeight];canvas.layer.zPosition=3;view.addSubview(canvas);confetti=canvas
            if theme == .forest {
                content.layer.zPosition=1
                let bees=NativeResultForestBees(viewport:view.bounds.size,artwork:assets)
                bees.mount(in:view);forestBees=bees
                onForestAmbience?(true,suspended)
            }
            if theme == .area55 {
                let ships=NativeResultArea55Flybys(root:resourceRoot,viewport:view.bounds.size,generation:state.generation)
                ships.mount(overlay:view,content:content);area55Flybys=ships
            }
        }
        // The shared clean entry spring has an invisible anticipation segment.
        // CLEARED already supplied that anticipation: hand straight into the
        // first readable hero/title frame instead of mounting blank paper.
        if clean,state.mode == .journey,(arcadeCelebrationPresented || interimJourney) {elapsed=NativeResultPresentationPlan.cleanAfterClearedStart}
        // NO MOVES already supplied the lead-in. Start at the readable fail
        // pose only after its confirmed board-exit receipt reaches this sheet.
        if !clean,followsConfirmedNoMoves {elapsed=NativeResultPresentationPlan.failAfterNoMovesStart}
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
        var actionSize=JimiV9PlainButton.homeCTASize(maxWidth:view.bounds.width-48,font:assets.font(size:28,weight:"ExtraBold"))
        actionSize.width=min(view.bounds.width-48,actionSize.width*1.10)
        let layout=NativeResultPresentationPlan.layout(viewport:view.bounds.size,clean:clean,titleHeight:titleHeight,primarySize:actionSize,actionGap:JimiV9PlainButton.pairedModalCTAGap)
        place(cardContent,in:layout.card)
        place(stars,in:layout.hero.offsetBy(dx:-layout.card.minX,dy:-layout.card.minY))
        for index in 0..<3 {
            let holder=empty[index].superview!
            let frame=layout.star(index).offsetBy(dx:-layout.hero.minX,dy:-layout.hero.minY)
            holder.bounds=CGRect(origin:.zero,size:frame.size);holder.center=CGPoint(x:frame.midX,y:frame.midY)
            // Filled stars are initially scale zero; assigning frame then destroys bounds.
            place(empty[index],in:holder.bounds);place(filled[index],in:holder.bounds)
        }
        place(headlineContent,in:layout.title.offsetBy(dx:-layout.card.minX,dy:-layout.card.minY))
        // CSS line-height permits glyph overhang outside the title's line box.
        // Keep motion on that box while UILabel draws in a padded inner carrier.
        let overhang=max(0,(heading.font.lineHeight-lineHeight)/2)
        heading.frame=headlineContent.bounds.insetBy(dx:0,dy:-overhang)
        place(scoreLabel,in:layout.scoreLabel.offsetBy(dx:-layout.card.minX,dy:-layout.card.minY))
        place(scoreMotion,in:layout.score.offsetBy(dx:-layout.card.minX,dy:-layout.card.minY))
        scoreShake.bounds=scoreMotion.bounds;scoreShake.center=CGPoint(x:scoreMotion.bounds.midX,y:scoreMotion.bounds.midY)
        score.frame=scoreMotion.bounds
        scoreBlur.frame=scoreMotion.bounds.insetBy(dx:-scoreBlurPadding,dy:-scoreBlurPadding)
        place(statusContent,in:layout.status.offsetBy(dx:-layout.card.minX,dy:-layout.card.minY))
        place(status,in:statusContent.bounds)
        place(bonusContent,in:CGRect(x:0,y:statusContent.bounds.midY-30,width:statusContent.bounds.width,height:60))
        bonus.frame=CGRect(x:0,y:0,width:bonusContent.bounds.width,height:36)
        bonusLabel.frame=CGRect(x:0,y:42,width:bonusContent.bounds.width,height:18)
        place(buttons[0].cartoonBounceLayoutView,in:layout.primary);place(buttons[1].cartoonBounceLayoutView,in:layout.secondary.offsetBy(dx:0,dy:-JimiV9PlainButton.pairedModalCTAGap*0.60));buttons.forEach{$0.layoutCartoonContent()}
        // CSS reduces overlapping uniform40px corners to half the shortest
        // side. Use that painted radius for both authored result CTAs.
        for button in buttons {
            button.layer.cornerRadius=min(40,min(button.bounds.width,button.bounds.height)/2)
        }
        confetti?.frame=view.bounds
    }
    /// Entry and exit poses can be zero-scale during a layout pass. UIKit's
    /// frame setter is undefined then; bounds and center retain the same pose.
    private func place(_ target:UIView,in rect:CGRect) {
        target.bounds=CGRect(origin:.zero,size:rect.size);target.center=CGPoint(x:rect.midX,y:rect.midY)
    }
    func prepareForHandoff(viewport:CGSize) {
        guard !disposed,!isViewLoaded else{return}
        presentationAdmitted=false
        loadViewIfNeeded();view.frame=CGRect(origin:.zero,size:viewport);view.setNeedsLayout();view.layoutIfNeeded()
        setSuspended(true)
    }
    func admitPreparedHandoff(){guard !disposed else{return};presentationAdmitted=true;setSuspended(false);if isViewLoaded{paint()}}
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
        guard presentationAdmitted,!commitAttempted else {return};commitAttempted=true
        do {try onCommit?();committed=true;commitFault=nil}
        catch {commitFault=error;status.text=error.localizedDescription;status.numberOfLines=0}
    }
    private func apply(_ pose:NativeResultPresentationPlan.Pose,to target:UIView) {
        target.alpha=max(0,min(1,pose.opacity));target.transform=pose.transform
    }
    private var earnedStars:Int {clean ? NativeJourneyContent.earnedStars(score:finalScore,board:state.board):0}
    private var lastCounterValue:Int?
    private var lastCounterHapticAt = -Double.infinity
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
            let fields=clean ? [headlineContent,scoreLabel,scoreMotion,statusContent,status]:[headlineContent,status]
            for (field,pose) in zip(fields,plan.content) {apply(pose,to:field)}
            for index in 0..<3 {
                if clean {
                    let pose=NativeResultExitPlan.cleanStar(seconds:age,index:index,earned:earned,capturedScale:capturedStarScales.indices.contains(index) ? capturedStarScales[index]:1)
                    apply(pose,to:filled[index])
                    // Unearned grey stars are visible result components too.
                    // Preserve their entry opacity while sharing the authored exit.
                    let emptyPose=NativeResultExitPlan.cleanEmptyStar(seconds:age,index:index,earned:earned)
                    apply(emptyPose,to:empty[index])
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
        commitOnce();thumb.isHidden=true;scoreLabel.isHidden = !clean;scoreMotion.isHidden = !clean
        let plan=NativeResultPresentationPlan.sample(seconds:elapsed,clean:clean,baseScore:state.score,combo:combo,efficiency:efficiency,arcadeReached:scoreOnlyArcadeSummary)
        for (target,pose) in [(stars,plan.hero),(headlineContent,plan.title),(scoreLabel,plan.scoreLabel),(scoreMotion,plan.score),(status,plan.status),(buttons[0],plan.primary),(buttons[1],plan.secondary)] {apply(pose,to:target)}
        moment(clean ? "clean-applause":"fail-sax",at:0)
        if clean {
            if let titleIndex=NativeResultHeadlines.clean.firstIndex(of:headline) {
                moment("clean-title-prepare",at:0,index:titleIndex)
                moment("clean-title",at:0.22,index:titleIndex)
            }
            moment("clean-hero",at:0.1);moment("clean-sax",at:0);moment("clean-count",at:0.47,duration:NativeResultPresentationPlan.cleanCounterDuration(from:0,to:state.score))
            if !scoreOnlyArcadeSummary {moment("clean-bonus",at:NativeResultPresentationPlan.cleanComboStart,duration:NativeResultPresentationPlan.cleanCounterDuration(from:state.score,to:state.score+combo));moment("clean-bonus",at:NativeResultPresentationPlan.cleanEfficiencyStart,duration:NativeResultPresentationPlan.cleanCounterDuration(from:state.score+combo,to:finalScore))}
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
            score.text=String(plan.displayedScore)
            paintScoreAccent()
            if lastCounterValue != plan.displayedScore {
                let previous=lastCounterValue;lastCounterValue=plan.displayedScore
                if previous != nil,elapsed-lastCounterHapticAt>=0.05 {
                    lastCounterHapticAt=elapsed;onHaptic?("protected-light")
                }
            }
            let comboVisible=elapsed<NativeResultPresentationPlan.cleanEfficiencyReveal
            bonus.isHidden=scoreOnlyArcadeSummary;bonusLabel.isHidden=scoreOnlyArcadeSummary
            bonus.text="+\(comboVisible ? plan.displayedCombo:plan.displayedEfficiency)"
            bonusLabel.text=comboVisible ? "Combo bonus":"Efficiency"
            let pose=comboVisible ? plan.combo:plan.efficiency
            apply(pose,to:bonusContent)
            confetti?.paint(seconds:elapsed,generation:state.generation)
            area55Flybys?.paint(seconds:elapsed,generation:state.generation)
            forestBees?.paint(seconds:elapsed)
        } else {bonus.isHidden=true;bonusLabel.isHidden=true}
        for index in 0..<2 {
            let begin=clean ? (scoreOnlyArcadeSummary ? 2.05:NativeResultPresentationPlan.cleanPrimaryCTAStart)+Double(index)*0.35:0.64+Double(index)*0.18
            // The register accent belongs to the first visible CTA, once.
            if clean,index == 0 {moment("clean-score-stop",at:begin)}
            moment(clean ? "clean-cta":"fail-cta",at:begin,index:index)
            buttons[index].isUserInteractionEnabled=elapsed>=begin+0.34 && committed
        }
        if commitFault != nil {status.alpha=1;status.isHidden=false}
    }
    private func moment(_ kind:String,at time:Double,index:Int=0,duration:Double?=nil) {
        let key="\(kind):\(time):\(index)"
        guard presentationAdmitted,elapsed >= time,!sentMoments.contains(key) else{return};sentMoments.insert(key)
        onMoment?(kind,index,duration)
    }
    @objc private func activate(_ sender:UIButton) {
        guard !disposed,committed,closingAt == nil,!suspended,sender.isUserInteractionEnabled else {return}
        clickedPrimary=sender.tag==0
        onMoment?(sender.tag == 0 ? "cta":"back",sender.tag,nil);onHaptic?("selection")
        for button in buttons {button.isUserInteractionEnabled=false}
        onAction?(sender.tag == 0 ? (clean && interimJourney ? .nextJourney : .restart) : .exit);onAction=nil
    }
    func close(prepareDestination:((@escaping (Bool)->Void)->Void)?=nil,paperFadeDuration:Double=0.14,completion:@escaping ()->Void) {
        guard closingAt == nil,!disposed else {return}
        onMoment?("modal-exit",0,nil)
        if arcadeCue {dispose();dismiss(animated:false,completion:completion);return}
        retireScoreAccent()
        capturedStarScales=(0..<3).map{NativeResultPresentationPlan.filledStarScale(seconds:elapsed,index:$0)}
        onForestAmbience?(false,false)
        confetti?.dispose();confetti=nil;area55Flybys?.dispose();area55Flybys=nil;forestBees?.dispose();forestBees=nil;closingAt=elapsed;closed=completion
        destinationPreparation=prepareDestination;self.paperFadeDuration=max(0.001,paperFadeDuration)
        preparationFrames=prepareDestination == nil ? 0:2
    }
    private func paintScoreAccent() {
        let accent=NativeResultPresentationPlan.counterAccent(seconds:elapsed,baseScore:state.score,combo:combo,efficiency:efficiency,arcadeReached:scoreOnlyArcadeSummary,reducedMotion:UIAccessibility.isReduceMotionEnabled)
        guard accent.motion>0 || accent.blur>0 else{retireScoreAccent();return}
        scoreAccentVisible=true
        scoreShake.transform=CGAffineTransform(translationX:accent.x,y:accent.y+accent.bounceOffset).scaledBy(x:accent.bounceX,y:accent.bounceY)
        paintScoreBlur(radius:accent.blur)
    }
    /// One small transparent glyph raster, filtered vertically; no duplicate labels
    /// and no backdrop filter. Runs only on the existing visible result clock.
    private func paintScoreBlur(radius:Double) {
        let radius=(max(0,min(5,radius))*4).rounded()/4
        guard radius>=0.25,score.bounds.width>0,score.bounds.height>0 else {
            score.alpha=1;scoreBlur.isHidden=true;scoreBlur.image=nil
            scoreBlurRadius = -1
            return
        }
        if scoreBlurText != score.text || scoreBlurSize != score.bounds.size || scoreBlurInput==nil {
            let format=UIGraphicsImageRendererFormat();format.scale=scoreBlurScale;format.opaque=false
            let size=score.bounds.size,padding=scoreBlurPadding
            let image=UIGraphicsImageRenderer(size:CGSize(width:size.width+padding*2,height:size.height+padding*2),format:format).image { _ in
                score.drawText(in:CGRect(origin:CGPoint(x:padding,y:padding),size:size))
            }
            scoreBlurInput=image.cgImage.map{CIImage(cgImage:$0)}
            scoreBlurText=score.text;scoreBlurSize=size;scoreBlurRadius = -1
        }
        guard let input=scoreBlurInput else {score.alpha=1;scoreBlur.isHidden=true;return}
        if scoreBlurRadius != radius {
            if scoreBlurContext==nil {scoreBlurContext=CIContext(options:[.cacheIntermediates:false])}
            let output=input.applyingFilter("CIMotionBlur",parameters:[kCIInputRadiusKey:radius*Double(scoreBlurScale),kCIInputAngleKey:Double.pi/2])
            guard let raster=scoreBlurContext?.createCGImage(output,from:input.extent) else {
                score.alpha=1;scoreBlur.isHidden=true;return
            }
            scoreBlur.image=UIImage(cgImage:raster,scale:scoreBlurScale,orientation:.up)
            scoreBlurRadius=radius
        }
        score.alpha=0;scoreBlur.isHidden=false
    }
    private func retireScoreAccent() {
        guard scoreAccentVisible else{return};scoreAccentVisible=false
        scoreShake.transform = .identity;score.alpha=1
        scoreBlur.isHidden=true;scoreBlur.image=nil;scoreBlurInput=nil;scoreBlurText=nil
        scoreBlurSize = .zero;scoreBlurRadius = -1
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
        guard value || presentationAdmitted else{return}
        if clean,state.mode == .journey,(1...10).contains(state.board),closingAt == nil,!disposed {onForestAmbience?(true,value)}
        buttons.forEach{$0.setModalCTAIdleSuspended(value || disposed)}
        suspended=value;lastTime=nil;link?.isPaused=value;arcadePresentation?.setSuspended(value);confetti?.setForeground(!value);area55Flybys?.setForeground(!value)
        if destinationPreparation != nil {
            if value {destinationLease &+= 1;destinationReady=false;destinationPending=false;paperFadeAt=nil;view.alpha=1}
            else {preparationFrames=2}
        }
    }
    func dispose() {
        guard !disposed else {return};disposed=true;retireScoreAccent();buttons.forEach{$0.setModalCTAIdleSuspended(true)};onForestAmbience?(false,false);onForestAmbience=nil;link?.invalidate();link=nil;clockTarget=nil
        scoreBlurContext?.clearCaches();scoreBlurContext=nil
        arcadePresentation?.dispose();arcadePresentation=nil;confetti?.dispose();confetti=nil;area55Flybys?.dispose();area55Flybys=nil;forestBees?.dispose();forestBees=nil
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
