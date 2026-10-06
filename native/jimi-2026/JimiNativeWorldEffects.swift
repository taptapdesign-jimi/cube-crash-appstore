import UIKit
import CoreImage

nonisolated private final class JimiInterimPreparationLease: @unchecked Sendable {
    private let lock = NSLock()
    private var retired = false
    var cancelled: Bool {lock.lock();defer {lock.unlock()};return retired}
    func cancel() {lock.lock();retired = true;lock.unlock()}
}

@MainActor
final class JimiNativeWorldPaintBarrier: NSObject {
    private var link: CADisplayLink?
    private var frames = 0
    private var completion: (() -> Void)?
    init(completion:@escaping () -> Void) {super.init();self.completion = completion;let link = CADisplayLink(target:self,selector:#selector(paint));self.link = link;link.add(to:.main,forMode:.common)}
    @objc private func paint() {frames += 1;guard frames == 2 else {return};let finished = completion;cancel();finished?()}
    func cancel() {link?.invalidate();link = nil;completion = nil}
}

/// Bounded, compositor-owned child effects. Stop removes every owned layer.
@MainActor
enum JimiNativeWorldEffects {
    @discardableResult
    static func smoke(at rect:CGRect,in owner:UIView,delay:Double = 0,repeatPeriod:Double? = nil,scale:CGFloat = 1,landing:Bool = false,below card:UIView? = nil) -> CALayer? {
        guard !UIAccessibility.isReduceMotionEnabled else {return nil}
        let size = landing ? max(rect.width,rect.height) : min(rect.width,rect.height)
        let count = landing ? max(4,Int((Double.random(in:24...32)*Double.random(in:1.55...1.75)*0.28).rounded())) : Int.random(in:24...32)
        let baseAlpha = landing ? min(1,CGFloat.random(in:0.68...0.82)*1.4) : 0.95
        CATransaction.begin()
        let container = CALayer(); container.name = repeatPeriod == nil ? "world.smoke.feedback" : "world.smoke"; container.frame = rect
        if let card,card.layer.superlayer === owner.layer {owner.layer.insertSublayer(container,below:card.layer)} else {owner.layer.insertSublayer(container,at:0)}
        if repeatPeriod == nil { CATransaction.setCompletionBlock { [weak container] in container?.removeFromSuperlayer() } }
        for index in 0..<count {
            let side = index%4
            let inset = size*0.02
            let radiusScale:CGFloat = landing ? 0.54 : 1
            let minRadius = max(6,(size*0.051*radiusScale).rounded()),maxRadius = max(18,(size*0.24*radiusScale).rounded())
            let radius = landing ? CGFloat.random(in:minRadius...maxRadius) : min(CGFloat.random(in:minRadius...maxRadius),size*0.18)
            let ellipse = CAShapeLayer(); ellipse.fillColor = UIColor.white.withAlphaComponent(landing ? baseAlpha : CGFloat.random(in:0.7...1)).cgColor
            ellipse.path = UIBezierPath(ovalIn:CGRect(x:-radius,y:-radius,width:radius*2,height:radius*2*CGFloat.random(in:0.6...1.4))).cgPath
            let alongX = CGFloat.random(in:inset...max(inset,rect.width-inset)),alongY = CGFloat.random(in:inset...max(inset,rect.height-inset))
            let origin:CGPoint = side == 0 ? CGPoint(x:alongX,y:inset) : side == 1 ? CGPoint(x:rect.width*0.8-inset,y:alongY) : side == 2 ? CGPoint(x:alongX,y:rect.height*0.8-inset) : CGPoint(x:inset,y:alongY)
            ellipse.position = origin; ellipse.opacity = 0; container.addSublayer(ellipse)
            let direction = [-Double.pi/2,0,Double.pi/2,Double.pi][side]+Double.random(in:-0.45...0.45)
            let distance = Double(size)*Double.random(in:0.15...0.34)*(landing ? 0.58 : 1)
            let end = CGPoint(x:origin.x+cos(direction)*distance,y:origin.y+sin(direction)*distance)
            let tIn = Double.random(in:0.018...0.04),run = Double.random(in:0.16...0.28),hold = Double.random(in:0.02...0.05),out = Double.random(in:0.08...0.14)
            let offset = delay+Double(index/max(1,Int(ceil(Double(count)/4))))*0.04+(landing ? Double.random(in:0...0.018) : 0),total = repeatPeriod ?? offset+tIn+run+hold+out
            let alpha = CAKeyframeAnimation(keyPath:"opacity"); alpha.values = [0,0,baseAlpha,baseAlpha,baseAlpha,0,0]; alpha.keyTimes = [0,offset/total,(offset+tIn)/total,(offset+tIn+run)/total,(offset+tIn+run+hold)/total,(offset+tIn+run+hold+out)/total,1].map(NSNumber.init(value:)); alpha.duration = total
            let position = CAKeyframeAnimation(keyPath:"position"); position.values = [NSValue(cgPoint:origin),NSValue(cgPoint:origin),NSValue(cgPoint:end),NSValue(cgPoint:end)]; position.keyTimes = [0,NSNumber(value:(offset+tIn)/total),NSNumber(value:(offset+tIn+run)/total),1]; position.duration = total
            let group = CAAnimationGroup(); group.animations = [alpha,position]; group.duration = total; group.repeatCount = repeatPeriod == nil ? 1 : .infinity; group.fillMode = .both; group.isRemovedOnCompletion = false
            ellipse.add(group,forKey:"world.smoke")
        }
        if landing {
            let pad = size*(0.22+0.05*1.65)*0.52,halo = CALayer()
            halo.name = "world.smoke.halo";halo.frame = container.bounds.insetBy(dx:-pad,dy:-pad);halo.cornerRadius = 16*scale
            halo.backgroundColor = UIColor.white.withAlphaComponent(0.10).cgColor;halo.opacity = 0;container.insertSublayer(halo,at:0)
            let pulse = CAKeyframeAnimation(keyPath:"opacity");pulse.values = [0,0,0.22,0.22,0]
            pulse.keyTimes = [0,NSNumber(value:delay/(delay+0.46)),NSNumber(value:(delay+0.08)/(delay+0.46)),NSNumber(value:(delay+0.18)/(delay+0.46)),1]
            pulse.duration = delay+0.46;halo.add(pulse,forKey:"world.smoke.halo")
        }
        CATransaction.commit()
        return container
    }
    static func returnLanding(card:UIView,in unit:UIView,scale:CGFloat,completion:@escaping () -> Void) {
        guard !UIAccessibility.isReduceMotionEnabled else {completion();return}
        let squash = Bool.random(),sign:Double = Bool.random() ? 1 : -1,tilt = 1.35*sign*(squash ? 0.72 : 1)*Double.pi/180
        let poses:[JimiV9Motion.Pose] = [.init(),.init(scaleX:1.077,scaleY:0.923,y:1.5),.init(scaleX:squash ? 1.22 : 0.912,scaleY:squash ? 0.901 : 1.231,y:-11),.init(scaleX:squash ? 0.934 : 1.165,scaleY:squash ? 1.154 : 0.868,y:1),.init(scaleX:0.967,scaleY:1.055,y:-2.5),.init()]
        let times:[Double] = [0,0.10,0.30,0.43,0.57,0.79],angles:[Double] = [0,0,tilt,-tilt*0.22,1.35*sign*0.12*Double.pi/180,0]
        let eases:[JimiV9Motion.Ease] = [.powerIn(2),.backOut(2.5),.powerIn(2),.powerOut(2),.backOut(1.7)]
        let animation = CAKeyframeAnimation(keyPath:"transform"),base = card.layer.transform
        animation.values = (0...190).map { index -> NSValue in
            let t = Double(index)*0.79/190,segment = min(4,times.lastIndex(where:{$0 <= t}) ?? 0)
            let p = eases[segment].value(min(1,(t-times[segment])/(times[segment+1]-times[segment])))
            let pose = poses[segment].interpolated(to:poses[segment+1],progress:p),angle = angles[segment]+(angles[segment+1]-angles[segment])*p
            var value = CATransform3DConcat(base,CATransform3DMakeTranslation(0,pose.y*Double(scale),0));value = CATransform3DRotate(value,angle,0,0,1);value = CATransform3DScale(value,pose.scaleX,pose.scaleY,1)
            return NSValue(caTransform3D:value)
        }
        animation.duration = 0.79
        let ownedSmoke = smoke(at:card.frame,in:unit,delay:0.43,scale:scale,landing:true,below:card)
        CATransaction.begin();CATransaction.setCompletionBlock { [weak ownedSmoke] in
            ownedSmoke?.sublayers?.forEach {$0.removeAllAnimations()};ownedSmoke?.removeAllAnimations();ownedSmoke?.removeFromSuperlayer()
            completion()
        }
        card.layer.add(animation,forKey:"world.card.landing")
        CATransaction.commit()
    }
    static func stop(_ view:UIView) {
        view.layer.removeAnimation(forKey:"world.interim")
        view.layer.sublayers?.filter {$0.name == "world.smoke"}.forEach {$0.removeAllAnimations();$0.removeFromSuperlayer()}
    }
}

/// Finite return reminder is a child of the live Unit. Native scroll translates
/// all its layers without a follow timer, viewport read or detached overlay.
@MainActor
final class JimiNativeWorldReminder: UIView {
    private let rotor = CATransformLayer()
    private let front = CALayer(), back = CALayer()
    private var generation = 0
    init(card:UIImage,backImage:UIImage,frame:CGRect) {
        super.init(frame:frame); isUserInteractionEnabled = false
        layer.addSublayer(rotor); rotor.frame = bounds
        front.frame = bounds; back.frame = bounds; front.contents = card.cgImage; back.contents = backImage.cgImage
        front.contentsGravity = .resizeAspect; back.contentsGravity = .resizeAspect
        front.isDoubleSided = false; back.isDoubleSided = false; back.transform = CATransform3DMakeRotation(.pi,0,1,0)
        rotor.addSublayer(front); rotor.addSublayer(back)
        var perspective = CATransform3DIdentity; perspective.m34 = -1/900; layer.sublayerTransform = perspective
    }
    required init?(coder:NSCoder) {fatalError("init(coder:) has not been implemented")}
    private func impact(_ elapsed:Double,launch:Bool) -> JimiV9Motion.Pose {
        let peak = JimiV9Motion.Pose(scaleX:0.96,scaleY:1.105,y:-11)
        let frames:[(Double,JimiV9Motion.Pose,JimiV9Motion.Ease)]
        if launch {
            frames = [(0,.init(),.linear),(0.28,.init(scaleX:1.035,scaleY:0.965,y:1.5),.linear),(0.68,.init(scaleX:0.96,scaleY:1.105,y:-7.92),.linear),(1,.init(),.linear)]
        } else {
            frames = [(0,.init(),.linear),(0.10/0.79,.init(scaleX:1.077,scaleY:0.923,y:1.5),.powerIn(2)),(0.30/0.79,.init(scaleX:1+(peak.scaleX-1)*2.2,scaleY:1+(peak.scaleY-1)*2.2,y:-11),.backOut(2.5)),(0.43/0.79,.init(scaleX:1.165,scaleY:0.868,y:1),.powerIn(2)),(0.57/0.79,.init(scaleX:0.967,scaleY:1.055,y:-2.5),.powerOut(2)),(1,.init(),.backOut(1.7))]
        }
        for index in 1..<frames.count where elapsed <= frames[index].0 {
            let p = max(0,(elapsed-frames[index-1].0)/(frames[index].0-frames[index-1].0))
            let eased = launch ? p*p*(3-2*p) : frames[index].2.value(p)
            return frames[index-1].1.interpolated(to:frames[index].1,progress:eased)
        }
        return .init()
    }
    private func squeeze(_ progress:Double) -> (Double,Double) {
        let frames:[(Double,Double,Double)] = [(0,1,1),(0.08,1.035,0.965),(0.22,0.96,1.105),(0.42,1,1),(0.58,1,1),(0.78,0.96,1.105),(0.92,1.075,0.94),(1,1,1)]
        for index in 1..<frames.count where progress <= frames[index].0 {
            let p = (progress-frames[index-1].0)/(frames[index].0-frames[index-1].0),smooth = p*p*(3-2*p)
            return (frames[index-1].1+(frames[index].1-frames[index-1].1)*smooth,frames[index-1].2+(frames[index].2-frames[index-1].2)*smooth)
        }
        return (1,1)
    }
    func play(apex:CGRect,rotation:CGFloat,completion:@escaping () -> Void) {
        generation += 1; let token = generation
        let launch = 0.18,travel = 0.52,landing = 0.79,total = launch+travel+landing
        let samples = Int(ceil(total*240))
        let transform = CAKeyframeAnimation(keyPath:"transform")
        transform.values = (0...samples).map { step -> NSValue in
            let t = Double(step)*total/Double(samples)
            let cycle = min(1,max(0,(t-launch)/travel))
            let leg = cycle <= 0.5 ? cycle*2 : (1-cycle)*2
            let p = leg*leg*(3-2*leg)
            let dx = apex.midX-frame.midX,dy = apex.midY-frame.midY,distance = hypot(dx,dy)
            let arc = distance < 1 ? 0 : min(34,max(14,distance*0.075))*sin(.pi*p),direction:CGFloat = dx >= 0 ? 1 : -1
            let x = dx*p+(distance < 1 ? 0 : -dy/distance*arc*direction),y = dy*p+(distance < 1 ? 0 : dx/distance*arc*direction)
            let sx = 1+(apex.width/bounds.width-1)*p,sy = 1+(apex.height/bounds.height-1)*p
            var pose = CATransform3DMakeTranslation(x,y,0); pose = CATransform3DRotate(pose,rotation*(1-p),0,0,1); pose = CATransform3DScale(pose,sx,sy,1)
            if t < launch || t > launch+travel {
                let impact = impact(t < launch ? t/launch : (t-launch-travel)/landing,launch:t < launch)
                pose = CATransform3DTranslate(pose,0,impact.y,0);pose = CATransform3DScale(pose,impact.scaleX,impact.scaleY,1)
            } else {let squeeze = squeeze(cycle);pose = CATransform3DScale(pose,squeeze.0,squeeze.1,1)}
            return NSValue(caTransform3D:pose)
        }
        transform.duration = total; transform.fillMode = .both; transform.isRemovedOnCompletion = false
        let flip = CAKeyframeAnimation(keyPath:"transform.rotation.y")
        flip.values = (0...samples).map { step -> Double in let p = min(1,max(0,(Double(step)*total/Double(samples)-launch)/travel)); return -2*Double.pi*p*p*(3-2*p) }
        flip.duration = total; flip.fillMode = .both; flip.isRemovedOnCompletion = false
        CATransaction.begin(); CATransaction.setCompletionBlock { [weak self] in guard let self,self.generation == token else {return}; completion() }
        layer.add(transform,forKey:"world.reminder"); rotor.add(flip,forKey:"world.reminder.flip"); CATransaction.commit()
    }
    func cleanup() {generation += 1; layer.removeAllAnimations(); rotor.removeAllAnimations(); removeFromSuperview()}
}

/// Per-card finite cycles belong to the World visibility owner. Core Animation
/// completion samples a fresh authored variant; no timer/ticker survives pause.
@MainActor
final class JimiNativeInterimEffect {
    private weak var card:UIView?
    private let scale:CGFloat
    private let baselineBounds: CGRect
    private let baselinePosition: CGPoint
    private let baselineAnchor: CGPoint
    private let baselineTransform: CATransform3D
    private var generation = 0
    private var running = false
    private var glowImage: CGImage?
    private var burnImages: [CGImage] = []
    private var preparingBurn = false
    private var preparationLease: JimiInterimPreparationLease?
    private static let burnQueue = DispatchQueue(label:"jimi.world.interim.burn",qos:.userInitiated)
    var preparedBurnFrameCount: Int {burnImages.count}
    var preparedBurnBytes: Int {burnImages.reduce(0) {$0+$1.bytesPerRow*$1.height}+(glowImage.map {$0.bytesPerRow*$0.height} ?? 0)}
    private func prepareBurn() {
        guard !preparingBurn,burnImages.isEmpty,let card,let image = (card as? UIImageView)?.image?.cgImage else {return}
        let lease = JimiInterimPreparationLease();preparationLease = lease
        preparingBurn = true;let token = generation,size = card.bounds.size,density = min(2,UIScreen.main.scale),radius = 12*scale
        Self.burnQueue.async { [weak self] in
            guard !lease.cancelled else {return}
            let frames = Self.renderBurn(image:image,size:size,density:density,radius:radius,lease:lease)
            guard !lease.cancelled else {return}
            let glow = frames.first.flatMap { image -> CGImage? in
                let input = CIImage(cgImage:image)
                let bright = input.applyingFilter("CIColorMatrix",parameters:[
                    "inputRVector":CIVector(x:1.312,y:0,z:0,w:0),
                    "inputGVector":CIVector(x:0,y:1.312,z:0,w:0),
                    "inputBVector":CIVector(x:0,y:0,z:1.312,w:0)])
                let peak = bright.applyingFilter("CIColorControls",parameters:[kCIInputSaturationKey:1.156])
                    .applyingFilter("CISepiaTone",parameters:[kCIInputIntensityKey:0.065])
                return CIContext(options:[.cacheIntermediates:false]).createCGImage(peak,from:input.extent)
            }
            DispatchQueue.main.async { [weak self] in
                guard !lease.cancelled,let self,self.generation == token,self.running else {return}
                self.preparingBurn = false;self.burnImages = frames;self.glowImage = glow
                self.card?.layer.sublayers?.first(where:{$0.name == "world.interim.glow"})?.contents = glow
                if let burn = self.card?.layer.sublayers?.first(where:{$0.name == "world.interim.burn.clip"})?.sublayers?.first {
                    self.installBurnContents(burn)
                }
            }
        }
    }
    nonisolated private static func renderBurn(image:CGImage,size:CGSize,density:CGFloat,radius:CGFloat,lease:JimiInterimPreparationLease) -> [CGImage] {
        let width = Int(ceil(size.width*density)),height = Int(ceil(size.height*density))
        guard width > 0,height > 0,width <= 512,height <= 768 else {return []}
        let space = CGColorSpaceCreateDeviceRGB()
        let colors = [CGColor(red:1,green:1,blue:238/255,alpha:0.98),CGColor(red:1,green:235/255,blue:142/255,alpha:0.86),CGColor(red:1,green:184/255,blue:76/255,alpha:0.56),CGColor(red:225/255,green:104/255,blue:55/255,alpha:0.20),CGColor(red:225/255,green:104/255,blue:55/255,alpha:0)]
        guard let gradient = CGGradient(colorsSpace:space,colors:colors as CFArray,locations:[0,0.18,0.43,0.68,0.88]) else {return []}
        let times:[Double] = [0,0.18,0.52,0.82,1],alphas:[Double] = [0,0.32,0.611,0.26,0]
        return (0...30).compactMap { index in
            guard !lease.cancelled else {return nil}
            guard let context = CGContext(data:nil,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:space,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else {return nil}
            context.scaleBy(x:density,y:density);context.draw(image,in:CGRect(origin:.zero,size:size))
            context.translateBy(x:0,y:size.height);context.scaleBy(x:1,y:-1)
            context.addPath(CGPath(roundedRect:CGRect(origin:.zero,size:size),cornerWidth:radius,cornerHeight:radius,transform:nil));context.clip()
            let t = Double(index)/30,segment = min(3,times.lastIndex(where:{$0 <= t}) ?? 0)
            let local = (t-times[segment])/(times[segment+1]-times[segment]),eased = local*local*(3-2*local)
            let alpha = alphas[segment]+(alphas[segment+1]-alphas[segment])*eased,p = t*t*(3-2*t)
            let burnWidth = 0.72*size.width,burnHeight = 1.16*size.height
            context.setBlendMode(.screen);context.setAlpha(alpha)
            context.translateBy(x:-0.62*size.width+burnWidth/2+2.25*burnWidth*p,y:-0.08*size.height+burnHeight/2+burnHeight*(-0.5+p))
            context.rotate(by:.pi/4);let scale = 0.94+0.10*p;context.scaleBy(x:scale,y:scale)
            context.translateBy(x:-burnWidth/2,y:-burnHeight/2)
            context.translateBy(x:burnWidth/2,y:burnHeight*0.48);context.scaleBy(x:burnWidth/2,y:burnHeight*0.52)
            context.drawRadialGradient(gradient,startCenter:.zero,startRadius:0,endCenter:.zero,endRadius:1,options:[.drawsBeforeStartLocation])
            return context.makeImage()
        }
    }
    private func installBurnContents(_ burn:CALayer) {
        guard !burnImages.isEmpty else {return}
        let animation = CAKeyframeAnimation(keyPath:"contents");animation.values = burnImages
        animation.calculationMode = .discrete;animation.duration = 1.1/1.3
        animation.beginTime = burn.value(forKey:"pulseBegin") as? Double ?? CACurrentMediaTime()+1.30
        burn.add(animation,forKey:"world.interim.burn")
    }
    init(card:UIView,scale:CGFloat) {self.card = card;self.scale = scale;baselineBounds = card.bounds;baselinePosition = card.layer.position;baselineAnchor = card.layer.anchorPoint;baselineTransform = card.layer.transform
    }
    func start() {guard !running,!UIAccessibility.isReduceMotionEnabled else {return};running = true;prepareBurn();cycle()}
    private func cycle() {
        guard running,let card,let parent = card.superview else {return}
        let token = generation
        let squash = Bool.random(),direction:Double = Bool.random() ? 1 : -1
        let peak = JimiV9Motion.Pose(scaleX:squash ? 1.10 : 0.96,scaleY:squash ? 0.955 : 1.105,y:-11)
        let land = JimiV9Motion.Pose(scaleX:squash ? 0.97 : 1.075,scaleY:squash ? 1.07 : 0.94)
        let frames:[(Double,JimiV9Motion.Pose,JimiV9Motion.Ease)] = [
            (0,.init(),.linear),(0.10,.init(scaleX:1.035,scaleY:0.965),.powerIn(2)),
            (0.30,peak,.backOut(2.5)),(0.43,land,.powerIn(2)),
            (0.57,.init(scaleX:0.985,scaleY:1.025,y:-2.5),.powerOut(2)),(0.79,.init(),.backOut(1.7)),(2.49,.init(),.linear)]
        let track = JimiV9Motion.Track(tweens:(1..<frames.count).map { index in
            .init(begin:frames[index-1].0,duration:frames[index].0-frames[index-1].0,from:frames[index-1].1,to:frames[index].1,ease:frames[index].2)
        })
        let oldAnchor = card.layer.anchorPoint,newAnchor = CGPoint(x:0.5,y:1)
        if oldAnchor != newAnchor {
            let oldPoint = CGPoint(x:oldAnchor.x*card.bounds.width,y:oldAnchor.y*card.bounds.height).applying(card.transform)
            let newPoint = CGPoint(x:newAnchor.x*card.bounds.width,y:newAnchor.y*card.bounds.height).applying(card.transform)
            CATransaction.begin();CATransaction.setDisableActions(true)
            card.layer.position = CGPoint(x:card.layer.position.x+newPoint.x-oldPoint.x,y:card.layer.position.y+newPoint.y-oldPoint.y);card.layer.anchorPoint = newAnchor
            CATransaction.commit()
        }
        let base = card.layer.transform,sampled = JimiV9Motion.sampledTrack(track)
        let motion = CAKeyframeAnimation(keyPath:"transform")
        motion.values = sampled.poses.enumerated().map { index,pose -> NSValue in
            let time = Double(index)*sampled.duration/Double(sampled.poses.count-1)
            let tilt = time < 0.79 ? sin(time/0.79 * .pi)*1.35*(squash ? 0.72 : 1)*direction * .pi/180 : 0
            var pulseScale = 1.0
            if time >= 1.30 && time < 1.44 {let p = (time-1.30)/0.14-1;pulseScale += 0.055*(1+3*p*p*p+2*p*p)}
            else if time >= 1.44 && time < 1.62 {pulseScale += 0.055*(1-sin((time-1.44)/0.18 * .pi/2))}
            var transform = CATransform3DConcat(base,CATransform3DMakeTranslation(0,pose.y*Double(scale),0));transform = CATransform3DRotate(transform,tilt,0,0,1);transform = CATransform3DScale(transform,pose.scaleX*pulseScale,pose.scaleY*pulseScale,1)
            return NSValue(caTransform3D:transform)
        }
        motion.duration = sampled.duration
        // Canonical World intentionally has no masked shimmer band. Its pulse is
        // a warm radial burn on the wrapper plus brightness/saturation on the face.
        let glow = CALayer();glow.name = "world.interim.glow";glow.frame = card.bounds
        glow.contents = glowImage;glow.contentsGravity = .resize;glow.opacity = 0;card.layer.addSublayer(glow)
        let pulseDuration = 1.1/1.3,pulseBegin = CACurrentMediaTime()+1.30
        let faceAlpha = CAKeyframeAnimation(keyPath:"opacity")
        faceAlpha.values = [0,1,0];faceAlpha.keyTimes = [0,0.56,1];faceAlpha.duration = pulseDuration
        faceAlpha.timingFunctions = [CAMediaTimingFunction(name:.easeOut),CAMediaTimingFunction(name:.easeOut)]
        faceAlpha.beginTime = pulseBegin;glow.add(faceAlpha,forKey:"world.interim.glow")
        // CALayer.compositingFilter is unsupported on iOS. Screen blending is
        // baked once off-main into 31 bounded display-resolution face textures.
        let burnClip = CALayer();burnClip.name = "world.interim.burn.clip";burnClip.frame = card.bounds
        burnClip.cornerRadius = 12*scale;burnClip.masksToBounds = true;card.layer.insertSublayer(burnClip,below:glow)
        let burn = CALayer();burn.name = "world.interim.burn";burn.frame = card.bounds
        burn.setValue(pulseBegin,forKey:"pulseBegin");burnClip.addSublayer(burn);installBurnContents(burn)
        CATransaction.begin();CATransaction.setCompletionBlock { [weak self,weak glow,weak burnClip] in
            glow?.removeFromSuperlayer();burnClip?.removeFromSuperlayer()
            guard let self,self.running,self.generation == token else {return};self.cycle()
        }
        card.layer.add(motion,forKey:"world.interim")
        JimiNativeWorldEffects.smoke(at:card.frame,in:parent,delay:0.14,scale:scale)
        CATransaction.commit()
    }
    func stop() {
        generation += 1;running = false;preparationLease?.cancel();preparationLease = nil;preparingBurn = false;burnImages.removeAll();glowImage = nil
        guard let card else {return}
        card.layer.removeAnimation(forKey:"world.interim")
        card.layer.sublayers?.filter {$0.name == "world.interim.glow" || $0.name == "world.interim.burn.clip"}.forEach { layer in
            layer.sublayers?.forEach {$0.removeAllAnimations()};layer.removeAllAnimations();layer.removeFromSuperlayer()
        }
        CATransaction.begin();CATransaction.setDisableActions(true)
        card.bounds = baselineBounds;card.layer.transform = baselineTransform;card.layer.anchorPoint = baselineAnchor;card.layer.position = baselinePosition
        CATransaction.commit()
    }
}
