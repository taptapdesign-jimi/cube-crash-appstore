import UIKit
import StackToSixGameplay

/// First-play sheet/pointer presentation. The pure tutorial owner selects cells
/// and admits drops; this overlay never mutates dice or completion preferences.
@MainActor
final class NativeTutorialOverlay:UIView {
    var onGotIt:(()->Void)?
    private let assets:JimiV9Artwork
    private let sheet=UIView(),paper=UIImageView(),pointer=UIView(),pointerImage=UIImageView()
    private let heading=UILabel(),subtitle=UILabel(),button=JimiV9PlainButton(type:.custom)
    private var step=1
    private var generation=0
    private var disposed=false
    private var suspended=false
    private var pointerStart:CGPoint?,pointerEnd:CGPoint?
    private var pointerKey:String?
    private var freePlayMoves:[(CGPoint,CGPoint)]=[]
    init(resourceRoot:URL) {
        assets=JimiV9Artwork(resourceRoot:resourceRoot)
        super.init(frame:.zero);backgroundColor=UIColor(red:1,green:247/255,blue:239/255,alpha:0.08)
        pointerImage.image=assets.image("assets/hand-pointer.png");pointerImage.contentMode = .scaleAspectFit
        pointerImage.layer.shadowColor=UIColor(red:161/255,green:96/255,blue:69/255,alpha:1).cgColor
        pointerImage.layer.shadowOpacity=0.22;pointerImage.layer.shadowOffset=CGSize(width:0,height:14);pointerImage.layer.shadowRadius=18
        pointer.layer.anchorPoint=CGPoint(x:0.72,y:0.22);pointer.addSubview(pointerImage);addSubview(pointer)
        paper.image=assets.image("assets/paper-bg.png");paper.contentMode = .scaleAspectFill;paper.clipsToBounds=true
        sheet.backgroundColor=UIColor(red:1,green:253/255,blue:249/255,alpha:0.96)
        sheet.layer.cornerRadius=36;sheet.layer.maskedCorners=[.layerMinXMinYCorner,.layerMaxXMinYCorner]
        sheet.layer.shadowColor=UIColor(red:173/255,green:118/255,blue:92/255,alpha:1).cgColor
        sheet.layer.shadowOpacity=0.14;sheet.layer.shadowRadius=45;sheet.layer.shadowOffset=CGSize(width:0,height:-18)
        sheet.addSubview(paper);sheet.addSubview(heading);sheet.addSubview(subtitle);sheet.addSubview(button);addSubview(sheet)
        heading.textAlignment = .center;heading.numberOfLines=0
        subtitle.numberOfLines=0;subtitle.textAlignment = .center;subtitle.textColor=UIColor(red:180/255,green:133/255,blue:114/255,alpha:1)
        button.setTitle("Got it!",for:.normal);button.titleLabel?.font=assets.font(size:28,weight:"Bold")
        button.setTitleColor(UIColor(red:1,green:251/255,blue:242/255,alpha:1),for:.normal)
        button.backgroundColor=UIColor(red:233/255,green:122/255,blue:85/255,alpha:1);button.layer.cornerRadius=40
        button.layer.shadowColor=UIColor(red:194/255,green:73/255,blue:33/255,alpha:1).cgColor
        button.layer.shadowOffset=CGSize(width:0,height:8);button.layer.shadowOpacity=1;button.layer.shadowRadius=0
        button.accessibilityIdentifier="native.tutorial.got-it";button.addTarget(self,action:#selector(gotIt),for:.touchUpInside)
        pointer.isHidden=true;button.isHidden=true;setCopy()
    }
    required init?(coder:NSCoder) {fatalError("Use native tutorial initializer")}
    override func hitTest(_ point:CGPoint,with event:UIEvent?)->UIView? {
        guard !disposed,!suspended,!isHidden,alpha>0.01,sheet.frame.contains(point) else{return nil}
        return sheet.hitTest(convert(point,to:sheet),with:event)
    }
    override func layoutSubviews() {
        super.layoutSubviews()
        let small=bounds.width <= 428
        let subtitleFont=assets.font(size:small ? 18 : 20,weight:"Medium")
        let subtitleHeight:CGFloat=step == 1 || step == 2 ? max(28,subtitleFont.lineHeight) : max(56,subtitleFont.lineHeight*2+2)
        let top:CGFloat=58,headingHeight:CGFloat=small ? 38.4 : 48
        let height=max(178,top+headingHeight+8+subtitleHeight+(step == 3 ? 98 : 0)+62+safeAreaInsets.bottom)
        sheet.bounds=CGRect(x:0,y:0,width:bounds.width,height:height)
        sheet.center=CGPoint(x:bounds.midX,y:bounds.maxY-height/2)
        paper.frame=sheet.bounds;paper.layer.cornerRadius=36;paper.layer.maskedCorners=sheet.layer.maskedCorners
        heading.frame=CGRect(x:28,y:top,width:max(0,bounds.width-56),height:headingHeight)
        subtitle.frame=CGRect(x:(bounds.width-min(280,bounds.width-56))/2,y:heading.frame.maxY+8,width:min(280,bounds.width-56),height:subtitleHeight)
        let width=min(bounds.width-56,bounds.width <= 428 || UIDevice.current.userInterfaceIdiom == .pad ? 249 : 310)
        button.frame=CGRect(x:(bounds.width-width)/2,y:subtitle.frame.maxY+34,width:width,height:64)
        let pointerWidth=min(bounds.width*0.34,190)
        let ratio=(pointerImage.image?.size.height ?? 180)/max(1,pointerImage.image?.size.width ?? 180)
        pointer.bounds=CGRect(x:0,y:0,width:pointerWidth,height:pointerWidth*ratio);pointerImage.frame=pointer.bounds
        setCopy();updatePointer(force:false)
    }
    private func setCopy() {
        let copies=[("Drag to stack","Drag a dice onto another dice.","Drag"),("Merge dice","Drag to stack this dice to make 6.","Merge"),
            ("Clear the stage","Stack and merge dice until\nthe stage is clear.","Clear"),("Special dice","They can merge with any regular\ndice to get the value 6","Special")]
        let copy=copies[max(0,min(3,step-1))]
        let font=assets.font(size:bounds.width > 0 && bounds.width <= 428 ? 32 : 40,weight:"ExtraBold")
        let text=NSMutableAttributedString(string:copy.0,attributes:[.font:font,.foregroundColor:UIColor(red:173/255,green:135/255,blue:117/255,alpha:1)])
        let range=(copy.0 as NSString).range(of:copy.2)
        if range.location != NSNotFound {text.addAttribute(.foregroundColor,value:UIColor(red:233/255,green:122/255,blue:85/255,alpha:1),range:range)}
        heading.attributedText=text;subtitle.font=assets.font(size:bounds.width <= 428 ? 18 : 20,weight:"Medium");subtitle.text=copy.1;subtitle.lineBreakMode = .byWordWrapping
        button.isHidden=step != 3
    }
    func show(step:Int,from:CGPoint?,to:CGPoint?,initial:Bool=false,moves:[(CGPoint,CGPoint)]=[]) {
        guard !disposed,(1...4).contains(step) else{return}
        generation += 1;let owner=generation;isHidden=false;pointerStart=from;pointerEnd=to;freePlayMoves=moves
        pointerKey=nil;pointer.layer.removeAllAnimations();sheet.layer.removeAllAnimations()
        if initial {
            self.step=step;setNeedsLayout();layoutIfNeeded()
            translateSheet(from:sheet.bounds.height,to:0,begin:0.8,duration:0.42,ease:.backOut(1.25),completion:{[weak self] in guard self?.generation == owner else{return};self?.showPointer()})
        } else {
            hidePointer()
            translateSheet(from:sheet.layer.presentation()?.transform.m42 ?? 0,to:sheet.bounds.height,begin:0,duration:0.28,ease:.powerIn(2)) { [weak self] in
                guard let self,self.generation==owner,!self.disposed else{return}
                self.step=step;self.setNeedsLayout();self.layoutIfNeeded()
                self.translateSheet(from:self.sheet.bounds.height,to:0,begin:0,duration:0.42,ease:.backOut(1.25)) {[weak self] in guard self?.generation==owner else{return};self?.showPointer()}
            }
        }
    }
    func updateTargets(from:CGPoint?,to:CGPoint?) {pointerStart=from;pointerEnd=to;updatePointer(force:false)}
    private func showPointer() {guard !disposed,!suspended,pointerStart != nil,pointerEnd != nil else{return};pointer.isHidden=false;pointerImage.alpha=1;updatePointer(force:true)}
    func hidePointer() {pointer.isHidden=true;pointerImage.layer.removeAllAnimations()}
    func restorePointer() {showPointer()}
    private func updatePointer(force:Bool) {
        guard let from=pointerStart,let to=pointerEnd,pointer.bounds.width>0 else{return}
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
        guard !disposed else{return};generation += 1;let owner=generation;hidePointer()
        translateSheet(from:sheet.layer.presentation()?.transform.m42 ?? 0,to:sheet.bounds.height,begin:0,duration:0.28,ease:.powerIn(2)) { [weak self] in
            guard let self,self.generation==owner else{return};self.isHidden=true;completion()
        }
    }
    @objc private func gotIt() {guard !disposed,!suspended,step==3 else{return};onGotIt?()}
    func setSuspended(_ value:Bool) {
        suspended=value
        if value,layer.speed != 0 {layer.timeOffset=layer.convertTime(CACurrentMediaTime(),from:nil);layer.speed=0}
        else if !value,layer.speed==0 {let offset=layer.timeOffset;layer.speed=1;layer.timeOffset=0;layer.beginTime=0;layer.beginTime=layer.convertTime(CACurrentMediaTime(),from:nil)-offset}
    }
    func dispose() {disposed=true;generation += 1;sheet.layer.removeAllAnimations();pointer.layer.removeAllAnimations();onGotIt=nil;removeFromSuperview()}
}
