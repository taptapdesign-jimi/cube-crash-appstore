import UIKit

/// Authored finite modal-only effects. No display link, recurring timer, bitmap
/// snapshot or alternate rotor. Flight, pointer and flip keep their own layers.
@MainActor
final class JimiNativeWorldCardEffects {
    private weak var front: UIImageView?
    private weak var impact: UIView?
    private weak var overlay: UIView?
    private let foil = CALayer(), gold = CAGradientLayer(), rainbow = CAGradientLayer()
    private let commonSurface = CALayer(), common = CAGradientLayer(), hand = UIImageView(), copy = UIView()
    private var letters: [UILabel] = []
    private let assets: JimiV9Artwork
    private let rarity: String
    private let newRibbon: Bool
    private var active = true, ended = false, nextDrag = true
    private var frontFacing = false
    private var permitted = false
    private var coachScheduledAt: Double?
    private var originalGold: [CGColor] = [], originalRainbow: [CGColor] = []

    init(front: UIImageView, impact: UIView, overlay: UIView, assets: JimiV9Artwork,
         resources: JimiNativeWorldResources, boardID: Int, rarity: String, newRibbon: Bool) {
        self.front = front; self.impact = impact; self.overlay = overlay
        self.assets = assets; self.rarity = rarity; self.newRibbon = newRibbon
        foil.opacity = 0; foil.masksToBounds = true; foil.isDoubleSided = false
        foil.transform = CATransform3DMakeTranslation(0, 0, 1.2)
        gold.colors = [color(255,197,69,0),color(255,204,112,0.16),color(255,249,218,0.44),color(255,255,248,0.38),color(255,213,128,0.22),color(255,190,86,0.14),color(255,197,69,0)]
        originalGold = gold.colors as? [CGColor] ?? []
        gold.locations = [0.16,0.32,0.43,0.50,0.60,0.67,0.82]
        gold.startPoint = CGPoint(x:0,y:0.38); gold.endPoint = CGPoint(x:1,y:0.62)
        rainbow.colors = [color(128,224,255,0),color(128,224,255,0.32),color(169,139,255,0.32),color(255,137,211,0.36),color(255,232,116,0.23),color(124,255,190,0.34),color(128,224,255,0)]
        originalRainbow = rainbow.colors as? [CGColor] ?? []
        rainbow.locations = [0.08,0.24,0.37,0.49,0.61,0.73,0.91]
        rainbow.startPoint = CGPoint(x:0,y:0.62); rainbow.endPoint = CGPoint(x:1,y:0.38)
        foil.addSublayer(rainbow); foil.addSublayer(gold); front.layer.addSublayer(foil)
        common.colors = [UIColor.clear.cgColor,UIColor.white.withAlphaComponent(0.28).cgColor,UIColor.clear.cgColor]
        common.locations = [0.28,0.47,0.64];common.startPoint = CGPoint(x:0,y:0.15);common.endPoint = CGPoint(x:1,y:0.85)
        common.opacity = 0;commonSurface.masksToBounds = true;commonSurface.transform = CATransform3DMakeTranslation(0,0,1.1);commonSurface.addSublayer(common);front.layer.addSublayer(commonSurface)
        resources.prepare(["assets/hand-pointer.png"],owner:boardID) { [weak self,weak resources] accepted in
            guard accepted,let self,!self.ended else{return}
            self.hand.image = resources?.image("assets/hand-pointer.png",owner:boardID)
            self.layout()
        }
        hand.contentMode = .scaleAspectFit; hand.isUserInteractionEnabled = false; hand.layer.opacity = 0
        hand.layer.shadowColor = color(132,82,63,1);hand.layer.shadowOpacity = 0.24;hand.layer.shadowOffset = CGSize(width:0,height:12);hand.layer.shadowRadius = 16
        copy.isUserInteractionEnabled = false; overlay.addSubview(hand);overlay.addSubview(copy)
    }
    private func color(_ r:CGFloat,_ g:CGFloat,_ b:CGFloat,_ a:CGFloat) -> CGColor { UIColor(red:r/255,green:g/255,blue:b/255,alpha:a).cgColor }
    func layout() {
        guard let front,let overlay else {return}
        CATransaction.begin();CATransaction.setDisableActions(true)
        foil.frame = front.bounds;commonSurface.frame = front.bounds;common.frame = CGRect(x:0,y:0,width:front.bounds.width*2.5,height:front.bounds.height)
        gold.frame = CGRect(x:-front.bounds.width*0.9,y:0,width:front.bounds.width*2.8,height:front.bounds.height)
        rainbow.frame = CGRect(x:-front.bounds.width*0.6,y:-front.bounds.height*0.225,width:front.bounds.width*2.2,height:front.bounds.height*1.45)
        for layer in [foil,commonSurface] {let mask = CALayer();mask.frame = front.bounds;mask.contents = front.image?.cgImage;mask.contentsGravity = .resizeAspect;layer.mask = mask}
        let width = min(overlay.bounds.width*0.36,168), aspect = (hand.image?.size.height ?? 1)/max(1,hand.image?.size.width ?? 1)
        hand.bounds = CGRect(x:0,y:0,width:width,height:width*aspect);hand.center = CGPoint(x:overlay.bounds.midX,y:overlay.bounds.height*0.56)
        copy.frame = CGRect(x:0,y:overlay.bounds.height-overlay.safeAreaInsets.bottom-72,width:overlay.bounds.width,height:38)
        CATransaction.commit()
    }
    private func animate(_ layer:CALayer,key:String,values:[Any],times:[Double],duration:Double,delay:Double = 0,path:String) {
        let animation = CAKeyframeAnimation(keyPath:path);animation.values = values;animation.keyTimes = times.map(NSNumber.init(value:));animation.duration = duration
        animation.beginTime = layer.convertTime(CACurrentMediaTime(),from:nil)+delay
        animation.timingFunctions = Array(repeating:CAMediaTimingFunction(controlPoints:0.22,1,0.36,1),count:max(0,times.count-1))
        animation.isRemovedOnCompletion = true;layer.add(animation,forKey:key)
    }
    func present(frontFacing:Bool) {
        cancel(handoff:false);self.frontFacing = frontFacing;permitted = true
        guard active,!ended,!UIAccessibility.isReduceMotionEnabled else {return}
        if frontFacing {
            if rarity == "legendary" {holo()}
            else if !newRibbon {commonSweep()}
        }
        coach(drag:nextDrag)
    }
    private func commonSweep() {
        guard let front else {return}
        animate(common,key:"modal.common.x",values:[2.4,2.4,2.05,-1.05,-1.4,-1.4].map{-CGFloat($0)*front.bounds.width*1.5},times:[0,0.4,0.46,0.78,0.84,1],duration:3,path:"transform.translation.x")
        animate(common,key:"modal.common.alpha",values:[0,0,0.55,0.55,0,0],times:[0,0.4,0.46,0.78,0.84,1],duration:3,path:"opacity")
    }
    private func smooth(_ t:Double)->Double {let p=min(1,max(0,t));return p*p*(3-2*p)}
    private func reflection(_ degrees:Double)->(Double,Double,Double) {
        let normalized = degrees.truncatingRemainder(dividingBy:360);let angle = normalized < -180 ? normalized+360 : normalized > 180 ? normalized-360 : normalized
        guard abs(angle)<88 else{return (0,50,50)}
        return ((0.104+0.39*smooth(abs(angle)/18))*smooth((88-abs(angle))/20),50+angle/72*60,50-angle/72*48)
    }
    private func strengthen(_ color: CGColor) -> CGColor {
        var r:CGFloat = 0,g:CGFloat = 0,b:CGFloat = 0,a:CGFloat = 0
        UIColor(cgColor:color).getRed(&r,green:&g,blue:&b,alpha:&a)
        let luminance = 0.213*r+0.715*g+0.072*b
        func channel(_ value:CGFloat)->CGFloat {min(1,max(0,(luminance+1.72*(value-luminance)-0.5)*1.06+0.5))}
        return UIColor(red:channel(r),green:channel(g),blue:channel(b),alpha:a).cgColor
    }
    private func holo() {
        guard let front else {return}
        gold.colors = originalGold.map(strengthen);rainbow.colors = originalRainbow.map(strengthen)
        let angles = [0.0,-21.6,0,21.6,0],times = [0.0,0.25,0.5,0.75,1]
        let states = angles.map{reflection($0)}
        let alphas = zip(angles,states).map{angle,state in max(0.13,state.0*0.68)*(angle<0 ? 1.12 : 1)}
        animate(foil,key:"modal.holo.alpha",values:alphas,times:times,duration:6.8,path:"opacity")
        animate(gold,key:"modal.holo.gold",values:states.map{-(($0.1-50)/100)*front.bounds.width*1.8},times:times,duration:6.8,path:"transform.translation.x")
        animate(rainbow,key:"modal.holo.rainbow",values:states.map{-(($0.2-50)/100)*front.bounds.width*1.2},times:times,duration:6.8,path:"transform.translation.x")
        // The canonical 6.8s automatic foil pass keeps the physical rotor neutral.
    }
    func dragReflection(angle:Double) {
        guard active,!ended,rarity == "legendary",frontFacing,!UIAccessibility.isReduceMotionEnabled,let front else {return}
        foil.removeAllAnimations();gold.removeAllAnimations();rainbow.removeAllAnimations();gold.colors = originalGold;rainbow.colors = originalRainbow
        let state = reflection(angle)
        CATransaction.begin();CATransaction.setDisableActions(true);foil.opacity = Float(state.0)
        gold.setValue(-((state.1-50)/100)*front.bounds.width*1.8,forKeyPath:"transform.translation.x")
        rainbow.setValue(-((state.2-50)/100)*front.bounds.width*1.2,forKeyPath:"transform.translation.x");CATransaction.commit()
    }
    private func coach(drag:Bool) {
        guard let impact else {return}
        coachScheduledAt = overlay?.layer.convertTime(CACurrentMediaTime(),from:nil)
        let times = drag ? [0.0,0.28,0.68,1] : [0,0.34,0.43,0.57,0.7,0.82,1]
        let values:[NSValue] = drag ? [0.0,-34,38,0].map{NSValue(caTransform3D:CATransform3DMakeTranslation($0,0,0))}
            : [1.0,1,0.965,1.06,0.988,1,1].map{NSValue(caTransform3D:CATransform3DMakeScale($0,$0,1))}
        animate(impact.layer,key:"modal.coach.impact",values:values,times:times,duration:2.1,delay:5,path:"transform")
        let handStops:[(Double,Double,Double,Double,Double,Double)] = drag
            ? [(0,0,0.18,-10,0.78,0),(0.16,-34,0,-10,0.96,1),(0.68,38,0,-5,0.96,1),(1,0,0.18,-7,0.84,0)]
            : [(0,0,0.22,-8,0.78,0),(0.2,0,0,-8,0.96,1),(0.42,0,0.12,-6,0.84,1),(0.58,0,-0.02,-8,1,1),(1,0,0.16,-7,0.84,0)]
        let transforms = handStops.map { stop -> NSValue in var pose = CATransform3DMakeTranslation(stop.1,stop.2*hand.bounds.height,80);pose = CATransform3DRotate(pose,stop.3 * .pi/180,0,0,1);return NSValue(caTransform3D:CATransform3DScale(pose,stop.4,stop.4,1)) }
        animate(hand.layer,key:"modal.coach.hand",values:transforms,times:handStops.map{$0.0},duration:2.1,delay:5,path:"transform")
        animate(hand.layer,key:"modal.coach.hand.alpha",values:handStops.map{$0.5},times:handStops.map{$0.0},duration:2.1,delay:5,path:"opacity")
        letters.forEach{$0.removeFromSuperview()};letters.removeAll()
        let text = drag ? "DRAG TO FLIP" : "TAP TO FLIP"
        var x:CGFloat = 0
        for (index,character) in text.enumerated() {
            let label = UILabel();label.text = String(character);label.font = assets.font(size:32*(index%3 == 0 ? 0.92 : index%3 == 1 ? 1.06 : 1),weight:"ExtraBold")
            label.textColor = .white;label.layer.shadowColor = color(159,105,82,1);label.layer.shadowOpacity = 0.34;label.layer.shadowOffset = CGSize(width:0,height:3);label.layer.shadowRadius = 0
            label.sizeToFit();let width:CGFloat = character == " " ? 32*0.34 : max(1,label.bounds.width-1.2)
            label.frame = CGRect(x:x,y:0,width:width,height:38);x += width;label.layer.opacity = 0;copy.addSubview(label);letters.append(label)
            let poses:[(Double,Double,Double)] = [(10,0,-7),(-3,1.13,3),(0,1,0),(0,1,0),(-2,1.08,-2),(7,0,6)]
            let transforms = poses.map{pose -> NSValue in var t = CATransform3DMakeTranslation(0,pose.0,0);t = CATransform3DRotate(t,pose.2 * .pi/180,0,0,1);return NSValue(caTransform3D:CATransform3DScale(t,max(0.001,pose.1),max(0.001,pose.1),1))}
            animate(label.layer,key:"modal.coach.copy",values:transforms,times:[0,0.16,0.24,0.72,0.8,1],duration:1.7,delay:5+Double(index)*0.012,path:"transform")
            animate(label.layer,key:"modal.coach.copy.alpha",values:[0,1,1,1,1,0],times:[0,0.16,0.24,0.72,0.8,1],duration:1.7,delay:5+Double(index)*0.012,path:"opacity")
        }
        for letter in letters {letter.frame.origin.x += (copy.bounds.width-x)/2}
    }
    func cancel(handoff:Bool = true) {
        permitted = false
        if let scheduled = coachScheduledAt,let overlay,
           overlay.layer.convertTime(CACurrentMediaTime(),from:nil)-scheduled >= 5 {nextDrag.toggle()}
        coachScheduledAt = nil
        if let impact {let pose = impact.layer.presentation()?.transform ?? impact.layer.transform;let coached = impact.layer.animation(forKey:"modal.coach.impact") != nil;impact.layer.removeAnimation(forKey:"modal.coach.impact")
            if handoff,coached,active,!UIAccessibility.isReduceMotionEnabled {animate(impact.layer,key:"modal.coach.handoff",values:[NSValue(caTransform3D:pose),NSValue(caTransform3D:CATransform3DIdentity)],times:[0,1],duration:0.16,path:"transform")}
            else {impact.layer.removeAllAnimations()}}
        for layer in [foil,gold,rainbow,common,hand.layer] {layer.removeAllAnimations()}
        letters.forEach{$0.layer.removeAllAnimations()}
        CATransaction.begin();CATransaction.setDisableActions(true);foil.opacity = 0;common.opacity = 0;gold.colors = originalGold;rainbow.colors = originalRainbow;gold.transform = CATransform3DIdentity;rainbow.transform = CATransform3DIdentity;CATransaction.commit()
    }
    func setActive(_ value:Bool) {
        guard active != value,!ended else{return};let wasPermitted = permitted;active = value
        if !value {cancel(handoff:false);permitted = wasPermitted}
        else if wasPermitted {present(frontFacing:frontFacing)}
    }
    func cleanup(){guard !ended else{return};ended = true;cancel(handoff:false);foil.removeFromSuperlayer();commonSurface.removeFromSuperlayer();hand.removeFromSuperview();copy.removeFromSuperview()}
}
