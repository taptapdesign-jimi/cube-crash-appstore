import UIKit
import StackToSixGameplay
import StackToSixNativeState

/// Read-only, mode-scoped projection of committed statistics. Opening a HUD
/// sheet never finishes an attempt or changes the live board.
struct NativeScoreModalModel {
    struct Stat {let value:String,label:String,icon:String}
    let title:String,subtitle:String,stats:[Stat]
    var history:[NativeJourneyStatPoint]?
    var historyIcon:String?
    var isGameplayHistory=false
    var currentCombo:Int?
    var currentScore:Int?
    init(boardStats:NativeBoardStats,combo:Bool) {
        title=combo ? "Best combo":"Best scores"
        historyIcon=combo ? "assets/combo-icon.png":"assets/highscore-icon.png"
        let best=combo ? boardStats.longestCombo:boardStats.highScore
        let points=(combo ? boardStats.comboHistory:boardStats.scoreHistory) ?? (best>0 ? [.init(value:best,date:nil)]:[])
        history=Array(points.sorted {a,b in a.value != b.value ? a.value>b.value:(a.date ?? 0)>(b.date ?? 0)}.prefix(3))
        let count=history?.count ?? 0
        let resultName=combo ? "combo":"score"
        subtitle=combo ? "Longest combos in the game.":count == 0 ? "No saved runs yet.":count == 1 ? "Your best \(resultName)":"Your best \(count) \(resultName)s"
        stats=[]
    }
    init(state:NativeBoardState,progression:NativeProgressionState,combo:Bool) {
        let arcade = state.mode == .arcade
        let board = progression.boardStats[state.board] ?? NativeBoardStats()
        let arcadeStats = progression.arcadeStats(for: state.effectiveArcadeVariant)
        let value = combo ? (arcade ? arcadeStats.longestCombo : board.longestCombo)
            : (arcade ? arcadeStats.highScore : board.highScore)
        title = combo ? "Combo" : "High Score"
        subtitle = combo ? "Stack and merge quickly\nto boost your score." : "Your best score so far."
        var rows = [Stat(value:value.formatted(),label:combo ? "Best combo" : "High score",
            icon:combo ? "assets/combo-icon.png" : "assets/highscore-icon.png")]
        if arcade && !combo {rows.append(.init(value:String(format:"%02d",max(1,arcadeStats.highestStageOpened)),
            label:"Rounds cleared",icon:"assets/clean-board.png"))}
        stats = rows
        isGameplayHistory=true
        historyIcon=combo ? "assets/combo-icon.png":"assets/highscore-icon.png"
        let saved=combo ? (arcade ? arcadeStats.comboHistory:board.comboHistory)
            : (arcade ? arcadeStats.scoreHistory:board.scoreHistory)
        let points=saved ?? (value>0 ? [.init(value:value,date:nil)]:[])
        history=Array(points.sorted {a,b in a.value != b.value ? a.value>b.value:(a.date ?? 0)>(b.date ?? 0)}.prefix(2))
        if combo {currentCombo=state.combo} else {currentScore=state.score}
    }
}

/// Matches the Journey card's centered icon / number / caption placement.
@MainActor private final class NativeScoreStatRow:UIView {
    private let icon:UIImageView,value=UILabel(),caption=UILabel()
    init(stat:NativeScoreModalModel.Stat,assets:JimiV9Artwork) {
        icon=UIImageView(image:assets.image(stat.icon,densityAware:true))
        super.init(frame:.zero)
        icon.contentMode = .scaleAspectFit
        value.text=stat.value;value.font=assets.font(size:34,weight:"Bold")
        value.textColor=UIColor(red:236/255,green:112/255,blue:69/255,alpha:1)
        caption.text=stat.label;caption.font=assets.font(size:18,weight:"Regular");caption.textColor=NativeTextPalette.subtitle
        for label in [value,caption] {
            label.textAlignment = .center;label.numberOfLines=1
            label.adjustsFontSizeToFitWidth=true;label.minimumScaleFactor=0.7;label.baselineAdjustment = .alignCenters
        }
        addSubview(icon);addSubview(value);addSubview(caption)
    }
    required init?(coder:NSCoder){fatalError("Use stat initializer")}
    override func layoutSubviews() {
        super.layoutSubviews()
        let scale=min(bounds.width/138,bounds.height/176),side=86*0.8*scale
        icon.frame=CGRect(x:(bounds.width-side)/2,y:18*scale,width:side,height:side).insetBy(dx:-side*0.05,dy:-side*0.05)
        value.frame=CGRect(x:6*scale,y:86*scale,width:max(0,bounds.width-12*scale),height:42*scale)
        caption.frame=CGRect(x:6*scale,y:127*scale,width:max(0,bounds.width-12*scale),height:24*scale)
    }
}

/// One tactile paper strip per saved result. Static borrowed artwork and mask;
/// the existing finite stat track owns the entire strip's motion.
@MainActor private final class NativeScoreHistoryRow:UIView {
    private let paper=UIImageView(),value=UILabel(),date=UILabel(),divider=UIView()
    private let scoreLayout:Bool
    init(index:Int,point:NativeJourneyStatPoint,dateText:String,combo:Bool,assets:JimiV9Artwork) {
        scoreLayout = !combo
        super.init(frame:.zero)
        paper.image=assets.image("assets/modals/paper.png",densityAware:true)
        paper.contentMode = .scaleAspectFill;paper.clipsToBounds=true
        paper.layer.cornerRadius=22;paper.layer.cornerCurve = .continuous
        paper.isUserInteractionEnabled=false;insertSubview(paper,at:0)
        layer.shadowColor=UIColor(red:0.68,green:0.40,blue:0.20,alpha:1).cgColor
        layer.shadowOpacity=0.18;layer.shadowRadius=6;layer.shadowOffset=CGSize(width:0,height:4)
        let formatter=NumberFormatter();formatter.numberStyle = .decimal
        formatter.groupingSeparator=".";formatter.groupingSize=3
        value.text=formatter.string(from:NSNumber(value:point.value)) ?? String(point.value)
        value.font=assets.font(size:30,weight:"Bold")
        value.textColor=UIColor(red:236/255,green:112/255,blue:69/255,alpha:1)
        date.text=dateText;date.font=assets.font(size:16,weight:"Regular");date.textColor=NativeTextPalette.subtitle
        if dateText == "Current" {
            date.font=assets.font(size:16,weight:"Medium");date.textColor=NativeTextPalette.modalTitle
        }
        divider.backgroundColor=NativeTextPalette.subtitle.withAlphaComponent(0.35)
        divider.isUserInteractionEnabled=false;addSubview(divider)
        for label in [value,date] {
            label.textAlignment = scoreLayout ? .left:.center;label.numberOfLines=1
            label.adjustsFontSizeToFitWidth=true;label.minimumScaleFactor=0.55
            label.baselineAdjustment = .alignCenters;addSubview(label)
        }
        if scoreLayout {date.textAlignment = .right}
        accessibilityIdentifier="native.score-history.row.\(index)"
        accessibilityLabel="\(point.value.formatted()), \(dateText)"
        isAccessibilityElement=true
    }
    required init?(coder:NSCoder){fatalError("Use result initializer")}
    override func layoutSubviews() {
        super.layoutSubviews();paper.frame=bounds
        let w=bounds.width,h=bounds.height
        // Preserve the original grain's aspect ratio; smooth continuous corners
        // replace the repeated zigzag edge. Only shadow geometry needs layout.
        CATransaction.begin();CATransaction.setDisableActions(true)
        layer.shadowPath=UIBezierPath(roundedRect:bounds,cornerRadius:min(22,h/2)).cgPath
        CATransaction.commit()
        if scoreLayout {
            divider.isHidden=false
            let inset:CGFloat=24,gap:CGFloat=8,dateGap:CGFloat=16
            let dateWidth=min(CGFloat(106),w*0.30),textX=inset
            let dateX=w-inset-dateWidth
            value.frame=CGRect(x:textX,y:(h-40)/2,width:max(0,dateX-dateGap-gap-textX),height:40)
            divider.frame=CGRect(x:dateX-dateGap,y:20,width:1,height:max(0,h-40))
            date.frame=CGRect(x:dateX,y:(h-30)/2,width:dateWidth,height:30)
            return
        }
        let split=w*0.46
        value.frame=CGRect(x:10,y:(h-44)/2,width:max(0,split-20),height:44)
        divider.frame=CGRect(x:split,y:20,width:1,height:max(0,h-40))
        date.frame=CGRect(x:split+9,y:(h-30)/2,width:max(0,w-split-19),height:30)
    }
}

/// The v10 centered gameplay modal recipe, with the source detail-stat tracks.
/// Its only decision is dismissal; pause and persistence belong to the owner.
@MainActor
final class NativeScoreModal:UIViewController,CAAnimationDelegate {
    var onClosed:(()->Void)?,onCloseRequested:(()->Void)?,onCloseReturnReady:(()->Void)?
    private let closeProgressLayer=CALayer()
    private var closeReturnDelivered=false
    private let model:NativeScoreModalModel,assets:JimiV9Artwork
    private let backdrop=JimiV9PlainButton(type:.custom),card=UIView(),flip=JimiNativeModalTransformView(),idle=UIView(),paper=UIImageView()
    private let historyIcon=UIImageView()
    private var historyIconAlphaBounds=CGRect(x:0,y:0,width:1,height:1)
    private let heading=UILabel(),subtitle=UILabel(),close=JimiV9PlainButton(type:.custom)
    private var rows:[UIView]=[],statTracks:[UIView]=[],drag:JimiNativeModalDrag?
    private var ready=false,closing=false,disposed=false
    init(model:NativeScoreModalModel,root:URL) {self.model=model;assets=JimiV9Artwork(resourceRoot:root);super.init(nibName:nil,bundle:nil);modalPresentationStyle = .overFullScreen}
    required init?(coder:NSCoder) {fatalError("Use native score initializer")}
    override func viewDidLoad() {
        super.viewDidLoad();view.backgroundColor = .clear;view.layer.addSublayer(closeProgressLayer)
        var camera=CATransform3DIdentity;camera.m34 = -1/920;view.layer.sublayerTransform=camera
        backdrop.backgroundColor=model.isGameplayHistory || model.history == nil ? JimiNativeModalV10.backdropColor:.clear;backdrop.alpha=0
        backdrop.addTarget(self,action:#selector(requestClose),for:.touchUpInside);view.addSubview(backdrop)
        view.addSubview(card);card.addSubview(flip);flip.addSubview(idle);idle.addSubview(paper)
        card.layer.anchorPoint=CGPoint(x:0.5,y:0.55);flip.layer.anchorPoint=CGPoint(x:0.5,y:1);idle.layer.anchorPoint=CGPoint(x:0.5,y:0.52)
        card.alpha=0;card.accessibilityIdentifier="native.score-modal";idle.layer.isDoubleSided=false
        paper.image=assets.image("assets/modals/paper.png");paper.layer.cornerRadius=40;paper.clipsToBounds=true
        idle.layer.shadowColor=UIColor(red:185/255,green:145/255,blue:119/255,alpha:1).cgColor
        idle.layer.shadowOpacity=0.8;idle.layer.shadowOffset=CGSize(width:0,height:13);idle.layer.shadowRadius=16.8
        heading.text=model.title;heading.font=assets.font(size:32,weight:"ExtraBold");heading.textAlignment = .center
        heading.textColor=NativeTextPalette.modalTitle
        heading.adjustsFontSizeToFitWidth=true;heading.minimumScaleFactor=0.7
        subtitle.attributedText=NativeModalTypography.attributedSubtitle(model.subtitle,font:assets.font(size:18,weight:"Medium"));subtitle.numberOfLines=0
        idle.addSubview(heading);idle.addSubview(subtitle)
        if let history=model.history {
            paper.image=assets.image("assets/modals/paper.png",densityAware:true)
            paper.layer.cornerRadius=32;paper.layer.cornerCurve = .continuous
            let dates=DateFormatter();dates.locale=Locale(identifier:"en_GB");dates.dateFormat="dd.MM.yyyy"
            historyIcon.image=model.historyIcon.flatMap{assets.image($0,densityAware:true)}
            if let image=historyIcon.image {historyIconAlphaBounds=NativeArtworkAlphaBounds.measure(image,maximumDimension:1024,alphaThreshold:0)}
            historyIcon.contentMode = .scaleAspectFit;historyIcon.isAccessibilityElement=false
            idle.addSubview(historyIcon)
            subtitle.numberOfLines=model.currentCombo == nil ? 1:0
            subtitle.adjustsFontSizeToFitWidth=model.currentCombo == nil;subtitle.minimumScaleFactor=0.7
            if let current=model.currentCombo ?? model.currentScore {
                let row=NativeScoreHistoryRow(index:0,point:.init(value:current,date:nil),dateText:"Current",combo:model.currentCombo != nil,assets:assets)
                idle.addSubview(row);rows.append(row);statTracks.append(row)
            }
            for (offset,point) in history.prefix(model.isGameplayHistory ? 2:3).enumerated() {
                let index=offset+(model.isGameplayHistory ? 1:0)
                let text=point.date.map{dates.string(from:Date(timeIntervalSince1970:$0))} ?? "--/--"
                let row=NativeScoreHistoryRow(index:index,point:point,dateText:text,combo:model.historyIcon == "assets/combo-icon.png",assets:assets)
                idle.addSubview(row);rows.append(row);statTracks.append(row)
            }
        }
        for (index,stat) in (model.history == nil ? model.stats:[]).enumerated() {
            if index>0 {let divider=UIView();divider.backgroundColor=UIColor(red:249/255,green:242/255,blue:233/255,alpha:1);idle.addSubview(divider);statTracks.append(divider)}
            let row=NativeScoreStatRow(stat:stat,assets:assets)
            idle.addSubview(row);rows.append(row);statTracks.append(row)
        }
        close.setBackgroundImage(paper.image,for:.normal);close.layer.cornerRadius=26;close.clipsToBounds=true
        close.setImage(assets.image("assets/close-icon.png",densityAware:true),for:.normal);close.imageView?.contentMode = .scaleAspectFit;close.artworkOpacity = 0.8;close.enableArtworkTapFeedback()
        close.imageEdgeInsets=UIEdgeInsets(top:14,left:14,bottom:14,right:14);close.accessibilityIdentifier="native.score-modal.close"
        close.addTarget(self,action:#selector(requestClose),for:.touchUpInside);idle.addSubview(close)
        drag=JimiNativeModalDrag(target:card,idle:idle,viewport:view,canDrag:{[weak self] in self?.ready == true && self?.closing == false},onDismiss:{[weak self] in self?.requestClose()})
        view.isUserInteractionEnabled=false
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews();backdrop.frame=view.bounds
        if model.history != nil {layoutHistory();return}
        let width=min(390,max(0,view.bounds.width-48)),subtitleHeight:CGFloat=model.stats.count == 1 && model.title == "Combo" ? 52 : 26
        let statsY:CGFloat=model.history == nil ? 28+38.4+12+subtitleHeight+24 : (model.subtitle.isEmpty ? 94:128)
        let dividerHeight=CGFloat(max(0,rows.count-1))*18
        let rowHeight=min(CGFloat(model.history == nil ? 176:58),max(0,(view.bounds.height-96-statsY-dividerHeight-40)/CGFloat(max(1,rows.count))))
        let height=statsY+CGFloat(rows.count)*rowHeight+dividerHeight+40
        card.bounds=CGRect(x:0,y:0,width:width,height:height);card.center=CGPoint(x:view.bounds.midX,y:view.bounds.midY+height*0.05)
        flip.bounds=card.bounds;flip.center=CGPoint(x:width/2,y:height);idle.bounds=card.bounds;idle.center=CGPoint(x:width/2,y:height*0.52)
        JimiNativeModalV10.paperLayout(paper,bounds:idle.bounds)
        heading.frame=CGRect(x:width*0.1,y:28,width:width*0.8,height:38.4);subtitle.frame=CGRect(x:width*0.1,y:heading.frame.maxY+12,width:width*0.8,height:subtitleHeight)
        var y=statsY
        for track in statTracks {let h:CGFloat=rows.contains(where:{$0 === track}) ? rowHeight : 2
            if h==2 {y += 8};track.frame=CGRect(x:width*0.1,y:y,width:width*0.8,height:h);y += h+(h==2 ? 8 : 0)}
        close.frame=CGRect(x:width-42,y:-10,width:52,height:52)
    }
    private func layoutHistory() {
        let width=min(390,max(0,view.bounds.width-80)),inset:CGFloat=32
        let subtitleHeight:CGFloat=model.currentCombo == nil ? 24:52
        let headerShift:CGFloat=26 // Icon top14→40;retain all header/content gaps.
        let top:CGFloat=max(176,138+subtitleHeight+14)+headerShift,gap:CGFloat=4,bottom:CGFloat=40
        let rowHeight=min(CGFloat(62),max(0,(view.bounds.height-100-top-bottom-CGFloat(max(0,rows.count-1))*gap)/CGFloat(max(1,rows.count))))
        let height:CGFloat=rows.isEmpty ? top+52:top+CGFloat(rows.count)*rowHeight+CGFloat(max(0,rows.count-1))*gap+bottom
        card.bounds=CGRect(x:0,y:0,width:width,height:height)
        card.center=CGPoint(x:view.bounds.midX,y:view.bounds.midY+height*0.05)
        flip.bounds=card.bounds;flip.center=CGPoint(x:width/2,y:height)
        idle.bounds=card.bounds;idle.center=CGPoint(x:width/2,y:height*0.52)
        // Hide only the narrow torn source fringe;retain the original paper grain scale.
        JimiNativeModalV10.paperLayout(paper,bounds:idle.bounds,bottomExtension:16)
        let imageSize=historyIcon.image?.size ?? CGSize(width:72,height:72)
        let imageScale=min(72/max(1,imageSize.width),72/max(1,imageSize.height))
        let paintedHeight=imageSize.height*imageScale
        let transparentTop=(72-paintedHeight)/2+historyIconAlphaBounds.minY*paintedHeight
        // Padding ends at the first nontransparent source pixel,not its UIImageView.
        historyIcon.frame=CGRect(x:(width-72)/2,y:40-transparentTop,width:72,height:72)
        heading.frame=CGRect(x:inset,y:92+headerShift,width:max(0,width-2*inset),height:38.4)
        subtitle.frame=CGRect(x:inset,y:138+headerShift,width:max(0,width-2*inset),height:subtitleHeight)
        for (index,row) in rows.enumerated() {
            row.frame=CGRect(x:inset,y:top+CGFloat(index)*(rowHeight+gap),width:max(0,width-2*inset),height:rowHeight)
        }
        close.frame=CGRect(x:width-42,y:-10,width:52,height:52)
    }
    override func viewDidAppear(_ animated:Bool) {
        super.viewDidAppear(animated);guard !disposed,!closing else{return};card.alpha=1
        if UIAccessibility.isReduceMotionEnabled {completeEnter();backdrop.alpha=1;return}
        CATransaction.begin();CATransaction.setCompletionBlock{[weak self] in self?.completeEnter()}
        JimiNativeModalV10.enter(card:card,flip:flip,key:"score.enter")
        animateStats(enter:true);CATransaction.commit();UIView.animate(withDuration:0.5){self.backdrop.alpha=1}
    }
    private func completeEnter() {
        guard !disposed,!closing else{return};ready=true;view.isUserInteractionEnabled=true
        JimiNativeModalV10.startIdle(on:idle,key:"score.idle")
    }
    private func animateStats(enter:Bool) {
        for (index,target) in statTracks.enumerated() {
            let duration=0.4,delay=Double(index)*0.05
            let ease=JimiV9Motion.Ease.cubicBezier(0.55,0.06,0.68,0.19)
            let samples=(0...108).map {i -> Double in let time=Double(i)*(duration+delay)/108;let t=min(1,max(0,(time-delay)/duration));return enter ? 1-ease.value(1-t) : 1-ease.value(t)}
            for (key,values) in [("transform.scale",samples),("opacity",samples)] {let a=CAKeyframeAnimation(keyPath:key);a.values=values;a.duration=duration+delay;a.calculationMode = .linear;target.layer.setValue(enter ? 1 : 0,forKeyPath:key);target.layer.add(a,forKey:"score.stats."+key)}
        }
    }
    @objc func requestClose() {
        guard ready,!disposed,!closing else{return};close.playArtworkTapFeedback();closing=true;view.isUserInteractionEnabled=false;drag?.cancel(preservePose:true);onCloseRequested?()
        // Retain the current float pose while the existing outer planes exit.
        CATransaction.begin();CATransaction.setDisableActions(true)
        idle.layer.transform=idle.layer.presentation()?.transform ?? idle.layer.transform
        idle.layer.removeAnimation(forKey:"score.idle");CATransaction.commit()
        if UIAccessibility.isReduceMotionEnabled {deliverCloseReturn();finishClose();return}
        CATransaction.begin();CATransaction.setCompletionBlock{[weak self] in self?.finishClose()};animateStats(enter:false)
        // Finite compositor milestone on the SAME paused parent clock as exit.
        // Empty layer has no pixels and does not compete for the card transform.
        if onCloseReturnReady != nil {
            let milestone=CABasicAnimation(keyPath:"opacity");milestone.fromValue=1;milestone.toValue=1
            milestone.duration=0.65*0.6;milestone.delegate=self
            milestone.setValue(true,forKey:"score.close-return")
            closeProgressLayer.add(milestone,forKey:"score.close-return")
        }
        JimiNativeModalV10.exit(card,flip:false,releaseY:card.layer.presentation()?.transform.m42 ?? 0,key:"score.exit")
        JimiNativeModalV10.exit(flip,flip:true,key:"score.exit")
        let fade=CAKeyframeAnimation(keyPath:"opacity");fade.values=[1,1,0];fade.keyTimes=[0,0.18,1];fade.duration=0.65;card.layer.opacity=0;card.layer.add(fade,forKey:"score.fade")
        CATransaction.commit();UIView.animate(withDuration:0.2){self.backdrop.alpha=0}
    }
    func animationDidStop(_ animation:CAAnimation,finished:Bool) {
        guard finished,animation.value(forKey:"score.close-return") as? Bool == true else{return}
        deliverCloseReturn()
    }
    private func deliverCloseReturn(){
        guard closing,!disposed,!closeReturnDelivered else{return}
        closeReturnDelivered=true;onCloseReturnReady?()
    }
    private func finishClose() {guard !disposed else{return};deliverCloseReturn();let callback=onClosed;dispose();dismiss(animated:false,completion:callback)}
    func setSuspended(_ value:Bool) {
        let layer=view.layer
        if value,layer.speed != 0 {drag?.cancel(preservePose:true);layer.timeOffset=layer.convertTime(CACurrentMediaTime(),from:nil);layer.speed=0;view.isUserInteractionEnabled=false}
        else if !value,layer.speed==0,!disposed {let t=layer.timeOffset;layer.speed=1;layer.timeOffset=0;layer.beginTime=0;layer.beginTime=layer.convertTime(CACurrentMediaTime(),from:nil)-t;view.isUserInteractionEnabled=ready && !closing}
    }
    func dispose() {guard !disposed else{return};disposed=true;onClosed=nil;onCloseRequested=nil;onCloseReturnReady=nil;closeProgressLayer.removeAllAnimations();closeProgressLayer.removeFromSuperlayer();drag?.dispose();drag=nil;for target in [card,flip,idle,close]+statTracks {target.layer.removeAllAnimations()};viewIfLoaded?.layer.removeAllAnimations()}
    override func viewDidDisappear(_ animated:Bool) {super.viewDidDisappear(animated);dispose()}
}
