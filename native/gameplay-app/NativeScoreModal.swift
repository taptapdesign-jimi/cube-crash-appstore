import UIKit
import StackToSixGameplay
import StackToSixNativeState

/// Read-only, mode-scoped projection of committed statistics. Opening a HUD
/// sheet never finishes an attempt or changes the live board.
struct NativeScoreModalModel {
    struct Stat {let value:String,label:String,icon:String}
    let title:String,subtitle:String,stats:[Stat]
    init(state:NativeBoardState,progression:NativeProgressionState,combo:Bool) {
        let arcade = state.mode == .arcade
        let board = progression.boardStats[state.board] ?? NativeBoardStats()
        let value = combo ? (arcade ? progression.arcadeStats.longestCombo : board.longestCombo)
            : (arcade ? progression.arcadeStats.highScore : board.highScore)
        title = combo ? "Combo" : "High Score"
        subtitle = combo ? "Stack and merge quickly\nto boost your score." : "Your best score so far."
        var rows = [Stat(value:value.formatted(),label:combo ? "Longest combo" : "High score",
            icon:combo ? "assets/combo-icon.png" : "assets/highscore-icon.png")]
        if arcade && !combo {rows.append(.init(value:String(format:"%02d",max(1,progression.arcadeStats.highestStageOpened)),
            label:"Rounds cleared",icon:"assets/clean-board.png"))}
        stats = rows
    }
}

/// The v10 centered gameplay modal recipe, with the source detail-stat tracks.
/// Its only decision is dismissal; pause and persistence belong to the owner.
@MainActor
final class NativeScoreModal:UIViewController {
    var onClosed:(()->Void)?
    private let model:NativeScoreModalModel,assets:JimiV9Artwork
    private let backdrop=JimiV9PlainButton(type:.custom),card=UIView(),flip=JimiNativeModalTransformView(),idle=UIView(),paper=UIImageView()
    private let heading=UILabel(),subtitle=UILabel(),close=JimiV9PlainButton(type:.custom)
    private var rows:[UIView]=[],statTracks:[UIView]=[],drag:JimiNativeModalDrag?
    private var ready=false,closing=false,disposed=false
    init(model:NativeScoreModalModel,root:URL) {self.model=model;assets=JimiV9Artwork(resourceRoot:root);super.init(nibName:nil,bundle:nil);modalPresentationStyle = .overFullScreen}
    required init?(coder:NSCoder) {fatalError("Use native score initializer")}
    override func viewDidLoad() {
        super.viewDidLoad();view.backgroundColor = .clear
        var camera=CATransform3DIdentity;camera.m34 = -1/920;view.layer.sublayerTransform=camera
        backdrop.backgroundColor=UIColor(red:220/255,green:183/255,blue:163/255,alpha:0.52);backdrop.alpha=0
        backdrop.addTarget(self,action:#selector(requestClose),for:.touchUpInside);view.addSubview(backdrop)
        view.addSubview(card);card.addSubview(flip);flip.addSubview(idle);idle.addSubview(paper)
        card.layer.anchorPoint=CGPoint(x:0.5,y:0.55);flip.layer.anchorPoint=CGPoint(x:0.5,y:1);idle.layer.anchorPoint=CGPoint(x:0.5,y:0.52)
        card.alpha=0;card.accessibilityIdentifier="native.score-modal";idle.layer.isDoubleSided=false
        paper.image=assets.image("assets/modals/paper.png");paper.layer.cornerRadius=40;paper.clipsToBounds=true
        idle.layer.shadowColor=UIColor(red:185/255,green:145/255,blue:119/255,alpha:1).cgColor
        idle.layer.shadowOpacity=0.8;idle.layer.shadowOffset=CGSize(width:0,height:13);idle.layer.shadowRadius=16.8
        heading.text=model.title;heading.font=assets.font(size:32,weight:"ExtraBold");heading.textAlignment = .center
        heading.textColor=UIColor(red:173/255,green:135/255,blue:117/255,alpha:1)
        let paragraph=NSMutableParagraphStyle();paragraph.alignment = .center;paragraph.minimumLineHeight=26;paragraph.maximumLineHeight=26
        subtitle.attributedText=NSAttributedString(string:model.subtitle,attributes:[.font:assets.font(size:20,weight:"Medium"),
            .foregroundColor:UIColor(red:203/255,green:168/255,blue:154/255,alpha:1),.paragraphStyle:paragraph]);subtitle.numberOfLines=0
        idle.addSubview(heading);idle.addSubview(subtitle)
        for (index,stat) in model.stats.enumerated() {
            if index>0 {let divider=UIView();divider.backgroundColor=UIColor(red:249/255,green:242/255,blue:233/255,alpha:1);idle.addSubview(divider);statTracks.append(divider)}
            let row=UIView(),icon=UIImageView(image:assets.image(stat.icon)),value=UILabel(),label=UILabel()
            icon.contentMode = .scaleAspectFit;icon.frame=CGRect(x:0,y:16,width:80,height:80)
            value.text=stat.value;value.font=assets.font(size:32,weight:"Bold");value.textColor=UIColor(red:232/255,green:116/255,blue:74/255,alpha:1)
            label.text=stat.label;label.font=assets.font(size:20,weight:"Medium");label.textColor=heading.textColor
            value.frame=CGRect(x:96,y:33,width:150,height:32);label.frame=CGRect(x:96,y:67,width:150,height:22)
            row.addSubview(icon);row.addSubview(value);row.addSubview(label);idle.addSubview(row);rows.append(row);statTracks.append(row)
        }
        close.setBackgroundImage(paper.image,for:.normal);close.layer.cornerRadius=26;close.clipsToBounds=true
        close.setImage(assets.image("assets/close-icon.png"),for:.normal);close.imageView?.contentMode = .scaleAspectFit
        close.imageEdgeInsets=UIEdgeInsets(top:12.5,left:12.5,bottom:12.5,right:12.5);close.accessibilityIdentifier="native.score-modal.close"
        close.addTarget(self,action:#selector(requestClose),for:.touchUpInside);idle.addSubview(close)
        drag=JimiNativeModalDrag(target:card,idle:idle,viewport:view,canDrag:{[weak self] in self?.ready == true && self?.closing == false},onDismiss:{[weak self] in self?.requestClose()})
        view.isUserInteractionEnabled=false
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews();backdrop.frame=view.bounds
        let width=min(390,max(0,view.bounds.width-48)),subtitleHeight:CGFloat=model.stats.count == 1 && model.title == "Combo" ? 52 : 26
        let statsY:CGFloat=28+38.4+8+subtitleHeight+24,height=statsY+CGFloat(rows.count)*112+CGFloat(max(0,rows.count-1))*18+40
        card.bounds=CGRect(x:0,y:0,width:width,height:height);card.center=CGPoint(x:view.bounds.midX,y:view.bounds.midY+height*0.05)
        flip.bounds=card.bounds;flip.center=CGPoint(x:width/2,y:height);idle.bounds=card.bounds;idle.center=CGPoint(x:width/2,y:height*0.52)
        JimiNativeModalV10.paperLayout(paper,bounds:idle.bounds)
        heading.frame=CGRect(x:width*0.1,y:28,width:width*0.8,height:38.4);subtitle.frame=CGRect(x:width*0.1,y:heading.frame.maxY+8,width:width*0.8,height:subtitleHeight)
        var y=statsY
        for track in statTracks {let h:CGFloat=rows.contains(where:{$0 === track}) ? 112 : 2
            if h==2 {y += 8};track.frame=CGRect(x:width*0.1,y:y,width:width*0.8,height:h);y += h+(h==2 ? 8 : 0)}
        close.frame=CGRect(x:width-42,y:-10,width:52,height:52)
    }
    private func pose(_ y:CGFloat,_ z:CGFloat,_ rx:CGFloat,_ ry:CGFloat,_ scale:CGFloat,_ rz:CGFloat=0)->CATransform3D {
        var t=CATransform3DMakeTranslation(0,y,z);t=CATransform3DRotate(t,rx * .pi/180,1,0,0);t=CATransform3DRotate(t,ry * .pi/180,0,1,0);t=CATransform3DRotate(t,rz * .pi/180,0,0,1);return CATransform3DScale(t,scale,scale,scale)
    }
    override func viewDidAppear(_ animated:Bool) {
        super.viewDidAppear(animated);guard !disposed,!closing else{return};card.alpha=1
        if UIAccessibility.isReduceMotionEnabled {completeEnter();backdrop.alpha=1;return}
        CATransaction.begin();CATransaction.setCompletionBlock{[weak self] in self?.completeEnter()}
        for (target,poses,times) in [(card,[pose(88,0,0,0,0.72,-2),pose(-10,0,0,0,1.07,0.8),pose(4,0,0,0,0.98,-0.35),CATransform3DIdentity],[0,0.55,0.76,1]),
            (flip,[pose(88,-180,17,-88,0.72),CATransform3DIdentity],[0,1])] {
            let a=CAKeyframeAnimation(keyPath:"transform");a.duration=0.65;a.values=poses.map{NSValue(caTransform3D:$0)};a.keyTimes=times.map{NSNumber(value:$0)}
            a.timingFunctions=Array(repeating:target === card ? CAMediaTimingFunction(controlPoints:0.22,1.18,0.36,1) : CAMediaTimingFunction(controlPoints:0.16,1,0.3,1),count:poses.count-1);target.layer.add(a,forKey:"score.enter")
        }
        animateStats(enter:true);CATransaction.commit();UIView.animate(withDuration:0.5){self.backdrop.alpha=1}
    }
    private func completeEnter() {
        guard !disposed,!closing else{return};ready=true;view.isUserInteractionEnabled=true
        guard !UIAccessibility.isReduceMotionEnabled else{return}
        let a=CAKeyframeAnimation(keyPath:"transform");a.duration=6.8;a.repeatCount = .infinity;a.keyTimes=[0,0.18,0.38,0.58,0.76,0.84,0.89,0.94,1]
        a.values=[pose(0,0,0,0,1),pose(-3,3,0,0,1.003),pose(0,0,0,0,1),pose(-3.75,4,0,0,1.004),pose(0,0,0,0,1),pose(-4,8,0,0,1.015),pose(1,0,0,0,0.995),pose(-1,3,0,0,1.006),pose(0,0,0,0,1)].map{NSValue(caTransform3D:$0)};idle.layer.add(a,forKey:"score.idle")
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
        guard ready,!disposed,!closing else{return};closing=true;view.isUserInteractionEnabled=false;drag?.cancel(preservePose:true)
        if UIAccessibility.isReduceMotionEnabled {finishClose();return}
        CATransaction.begin();CATransaction.setCompletionBlock{[weak self] in self?.finishClose()};animateStats(enter:false)
        JimiNativeModalV10.exit(card,flip:false,releaseY:card.layer.presentation()?.transform.m42 ?? 0,key:"score.exit")
        JimiNativeModalV10.exit(flip,flip:true,key:"score.exit")
        let fade=CAKeyframeAnimation(keyPath:"opacity");fade.values=[1,1,0];fade.keyTimes=[0,0.18,1];fade.duration=0.65;card.layer.opacity=0;card.layer.add(fade,forKey:"score.fade")
        CATransaction.commit();UIView.animate(withDuration:0.2){self.backdrop.alpha=0}
    }
    private func finishClose() {guard !disposed else{return};let callback=onClosed;dispose();dismiss(animated:false,completion:callback)}
    func setSuspended(_ value:Bool) {
        let layer=view.layer
        if value,layer.speed != 0 {drag?.cancel(preservePose:true);layer.timeOffset=layer.convertTime(CACurrentMediaTime(),from:nil);layer.speed=0;view.isUserInteractionEnabled=false}
        else if !value,layer.speed==0,!disposed {let t=layer.timeOffset;layer.speed=1;layer.timeOffset=0;layer.beginTime=0;layer.beginTime=layer.convertTime(CACurrentMediaTime(),from:nil)-t;view.isUserInteractionEnabled=ready && !closing}
    }
    func dispose() {guard !disposed else{return};disposed=true;onClosed=nil;drag?.dispose();drag=nil;for target in [card,flip,idle,close]+statTracks {target.layer.removeAllAnimations()};viewIfLoaded?.layer.removeAllAnimations()}
    override func viewDidDisappear(_ animated:Bool) {super.viewDidDisappear(animated);dispose()}
}
