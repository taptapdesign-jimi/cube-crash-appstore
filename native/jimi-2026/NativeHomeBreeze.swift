import UIKit
import ImageIO

/// Home's shared compositor lifetime owns all four bounded ambient families.
/// A slide change drops painted copies with finite gravity while cached new
/// slots start immediately. No timer or completion can respawn retired work.
@MainActor
final class NativeHomeBreeze {
    static let animationKey="native-home-breeze"
    static let fallKey="native-home-breeze-hit-fall"
    private final class FallReceipt:NSObject,CAAnimationDelegate {
        weak var owner:NativeHomeBreeze?
        weak var layer:CALayer?
        init(owner:NativeHomeBreeze,layer:CALayer){self.owner=owner;self.layer=layer}
        func animationDidStop(_ animation:CAAnimation,finished:Bool) {
            if let layer {owner?.removeFall(layer)}
        }
    }
    private final class FlightReceipt:NSObject,CAAnimationDelegate {
        weak var owner:NativeHomeBreeze?
        weak var layer:CALayer?
        init(owner:NativeHomeBreeze,layer:CALayer){self.owner=owner;self.layer=layer}
        func animationDidStop(_ animation:CAAnimation,finished:Bool) {
            if finished,let layer {owner?.flightFinished(layer,receipt:self)}
        }
    }
    private var flightReceipts:[ObjectIdentifier:FlightReceipt]=[:]
    private struct Falling {let layer:CALayer,receipt:FallReceipt}
    private var falling:[ObjectIdentifier:Falling]=[:]
    private var fallOrder:[ObjectIdentifier]=[]
    var fallingLayers:[CALayer] {fallOrder.compactMap{falling[$0]?.layer}}
    private var allOwnedLayers:[CALayer] {particles+fallingLayers}
    enum Family:Int,CaseIterable {case shard,leaf,balloon,die}
    struct Key:Hashable {let family:Family,index:Int}
    private final class Particle {
        let key:Key,layer:CALayer
        var flight:Flight
        init(key:Key,layer:CALayer,flight:Flight){self.key=key;self.layer=layer;self.flight=flight}
    }
    static let slotsPerFamily=3
    static let flowerSlotIndex=2
    static func slots(_ family:Family)->Int {family == .leaf ? flowerSlotIndex+1:family == .shard ? slotsPerFamily:2}
    let rearPlane=UIView(),middlePlane=UIView(),frontPlane=UIView(),balloonStagePlane=UIView()
    private var slideStrips:[ObjectIdentifier:UIView]=[:]
    private var slideWindows:[ObjectIdentifier:[UIView]]=[:]
    var slideLayers:[CALayer] {[rearPlane,middlePlane,frontPlane,balloonStagePlane].compactMap{slideStrips[ObjectIdentifier($0)]?.layer}}
    private var slideX:CGFloat=0
    private var pool:[Key:Particle]=[:]
    private var extraBirthCycles:[Family:Int]=[:]
    private var images:[String:CGImage]=[:]
    var particles:[CALayer] {pool.values.map{$0.layer}}
    var plans:[Flight] {pool.values.map{$0.flight}}
    var retainedImageCount:Int {images.count}
    var emittingFamilies:Set<Family> {Set(pool.values.filter{$0.layer.animation(forKey:Self.animationKey) != nil}.map{$0.key.family})}
    private var canvas=CGSize.zero
    private var running=false,paused=false,prepared=false
    private var origin=CGPoint.zero
    private var leafOriginY:CGFloat?
    private var balloonMaximum:CGFloat=80
    private(set) var selectedSlide=0
    static func families(slide:Int)->Set<Family> {
        slide==0 ? [.leaf]:slide==1 ? [.balloon]:[.die]
    }

    struct Flight {
        let family:Family,source:String,fromLeft:Bool,rear:Bool,foreground:Bool,stageBorn:Bool,diceAboveClouds:Bool,value:Int
        let side:CGFloat,birth:Double,duration:Double,phase:Double,spin:Double
        let origin:CGPoint,controls:[CGPoint]
        let leafMotion:NativeBeeLeafMotion?
        static let leafFallSpeed=0.80
        static let leafPlaybackSpeed=0.70
        static let times:[Double]=[0,0.055,0.15,0.33,0.54,0.75,1]
        init(family:Family,index:Int,size:CGSize,seed:Double,origin:CGPoint?=nil,balloonMaximum:CGFloat=80) {
            func unit(_ salt:Double)->Double {
                var bits=seed.bitPattern ^ (UInt64(index+1) &* 0x9E3779B97F4A7C15) ^ (UInt64(family.rawValue+1) &* 0xBF58476D1CE4E5B9) ^ (UInt64(salt+1) &* 0x94D049BB133111EB)
                bits=(bits ^ (bits >> 30)) &* 0xBF58476D1CE4E5B9
                bits=(bits ^ (bits >> 27)) &* 0x94D049BB133111EB
                return Double((bits ^ (bits >> 31)) >> 11)/9007199254740992
            }
            self.family=family;fromLeft=(family == .leaf || family == .die) ? unit(0)>0.50:(index+(family == .balloon ? 1:0))%2==0
            stageBorn=family == .balloon && unit(48)<0.40
            diceAboveClouds=family == .die && unit(47)<0.10
            foreground=(family == .leaf && index==NativeHomeBreeze.flowerSlotIndex && unit(55)<0.40) || (family == .balloon && !stageBorn && unit(15)>0.50)
            rear=family == .leaf ? !foreground && unit(15)<0.5:family != .balloon && index%3==0 && !foreground;value=family == .die ? 1+Int(unit(49)*6):index%6+1
            switch family {
            case .shard:source="assets/shop/drill/shard\(1+Int(unit(23)*9)).png"
            case .leaf:
                // A separate flower slot shares the leaf sampler and lifetime,
                // keeping both original leaf streams intact.
                source=index==NativeHomeBreeze.flowerSlotIndex ? "assets/shop/bush/flowr\(1+Int(unit(53)*3)).png":"assets/shop/bee/leaf\(1+Int(unit(19)*6)).png"
            case .balloon:source="assets/shop/baloon/\(["yellow","orange","green","pink","green"][(Int(seed)+index)%5]).png"
            case .die:source="assets/tile.png"
            }
            if family == .balloon {side=min(180,balloonMaximum)*CGFloat(stageBorn || foreground ? 1:0.40+unit(8)*0.55)}
            else if family == .leaf {side=CGFloat(20+unit(20)*40)*(NativeTabletLayout.applies(size) ? 1:0.5)*(index==NativeHomeBreeze.flowerSlotIndex ? CGFloat(1+unit(54)*0.50):1)}
            else if family == .die {side=CGFloat(20+unit(50)*(NativeTabletLayout.applies(size) ? 40:10))}
            else {side=CGFloat([20.0,40,60][index%3])*(family == .shard ? 0.65:1)}
            birth=family == .leaf ? (index==0 ? 0:Double(index)*0.40+unit(16)*0.22):Double(index)/Double(max(1,NativeHomeBreeze.slots(family)-1))*0.36
            duration=family == .shard ? 2.2+unit(1)*1.1:family == .die ? 2.6+unit(1)*1.2:family == .leaf ? (2.4+unit(1)*1.2)/1.60:family == .balloon ? 6+unit(1)*3:5.2+unit(1)*2.6
            // Keep every fresh leaf oblique, away from flat cardinal orientations.
            phase=family == .leaf ? (floor(unit(2)*4)*90+18+unit(24)*54) * .pi/180:unit(2)*2 * .pi
            if family == .die {spin=(fromLeft ? 1:-1)*(180+unit(4)*280) * .pi/180}
            else {spin=(fromLeft ? 1:-1)*(family == .leaf ? 1.0+unit(4)*2.5:family == .shard ? 2.4+unit(4)*3:0.12)}
            let centre=origin ?? CGPoint(x:size.width/2,y:size.height*0.70)
            if family == .balloon && !stageBorn {self.origin=CGPoint(x:side/2+CGFloat(unit(5))*max(0,size.width-side),y:size.height+side+20)}
            else if family == .leaf {
                // Every flight independently chooses its entry; no paired index groups.
                self.origin=unit(42)<0.33 ? CGPoint(x:centre.x+CGFloat(unit(5)-0.5)*size.width*0.16,y:centre.y):
                    CGPoint(x:side/2+CGFloat(unit(5))*max(0,size.width-side),y:-side-12)
            }
            else {self.origin=CGPoint(x:centre.x+CGFloat(unit(5)-0.5)*16,y:centre.y+CGFloat(unit(6)-0.5)*12)}
            let width=Double(size.width),height=Double(size.height),direction:Double=fromLeft ? -1:1
            let spread=width*(family == .leaf ? 0.38+unit(9)*0.17:0.24+unit(9)*0.13),rise=height*(family == .leaf ? 0.23+unit(10)*0.33:0.30+unit(10)*0.24)
            let ox=Double(self.origin.x),oy=Double(self.origin.y)
            let xs:[Double]=(family == .die || family == .shard) ? [0,direction*width*0.20,direction*width*0.38,direction*width*0.48,direction*width*0.56,direction*width*0.66,direction*width*0.78]:[0,direction*spread*0.48,direction*spread,
                direction*spread*(0.35+unit(11)*0.35),-direction*spread*(0.45+unit(12)*0.35),
                direction*spread*1.15,direction*width*0.80]
            let ys: [Double]
            if family == .balloon {
                let travel=oy+Double(side)
                ys=[0,-travel*0.15,-travel*0.32,-travel*0.45,-travel*0.62,-travel*0.78,-travel]
            } else if family == .leaf {
                ys=[0,-rise*0.20,-rise*0.45,-rise*0.65,-rise*0.55,-rise*0.78,-rise*0.95]
            } else if family == .die || family == .shard {
                let drop=height+Double(side)-oy
                ys=[0,drop*0.04,drop*0.14,drop*0.30,drop*0.50,drop*0.74,drop]
            } else {
                ys=[0,-rise*0.34,-rise*0.70,-rise*(0.76+unit(13)*0.12),-rise*0.94,-rise*0.48,height+Double(side)-oy]
            }
            var points=zip(xs,ys).map{CGPoint(x:ox+$0.0,y:oy+$0.1)}
            if family == .shard {points[6].x=ox+direction*width*(0.42+unit(14)*0.40)}
            if family == .die {points[6].x=ox+direction*width*(0.30+unit(14)*0.55)}
            controls=points
            if family == .leaf {
                let rise=oy>=0 ? duration*(0.22+unit(37)*0.30):0
                let life=rise+(duration-rise)/Self.leafFallSpeed
                let angle=unit(36)*2 * .pi,scatter=width*(0.476+unit(43)*0.714)
                let vx=cos(angle)*scatter/life,vy=sin(angle)*scatter/life-90-unit(44)*36
                let flutter=unit(39)*2 * .pi
                leafMotion=NativeBeeLeafMotion(birth:0,lifetime:life,
                    birthX:ox-sin(flutter)*18,birthY:oy-cos(flutter)*14,
                    velocityX:vx,velocityY:vy,
                    gravity:NativeBeeLeafMotion.gravity(viewportHeight:height,birthY:oy,velocityY:vy,lifetime:life),
                    flutter:flutter,spin:(unit(45)<0.5 ? -1:1)*(260+unit(46)*240),scale:1,peakOpacity:0.82)
            } else {leafMotion=nil}
        }
        /// Entry starts an already-flying pose while retaining the full authored
        /// timeline. Ordinary births and paused resumes keep their exact clocks.
        func visibleEntryProgress(in viewport:CGSize)->Double? {
            guard family == .leaf || family == .balloon else{return nil}
            let top=family == .leaf ? viewport.height*0.10:side*0.25
            let bottom=family == .leaf ? viewport.height*0.40:viewport.height-side*0.25
            for step in 4...65 {
                let t=Double(step)/100,p=point(t)
                if opacity(t)>=0.25,p.x>=side*0.25,p.x<=viewport.width-side*0.25,p.y>=top,p.y<=bottom {return t}
            }
            return nil
        }
        var playbackDuration:Double {leafMotion.map{$0.lifetime/Self.leafPlaybackSpeed} ?? duration}
        // Keep the exact authored trajectory and flutter, stretching only the
        // presentation clock for Home leaves and flowers.
        func sampleElapsed(at progress:Double)->Double {max(0,min(1,progress))*(leafMotion?.lifetime ?? duration)}
        func elapsed(at progress:Double)->Double {max(0,min(1,progress))*playbackDuration}
        func progress(after elapsed:Double)->Double {max(0,min(1,elapsed/playbackDuration))}
        /// Reuse Wee Bee's authored scatter,gravity and flutter sampler.
        func point(_ progress:Double)->CGPoint {
            let t=max(0,min(1,progress))
            if let motion=leafMotion {
                let pose=motion.sample(seconds:sampleElapsed(at:t))
                return CGPoint(x:pose.x,y:pose.y)
            }
            if family == .die {
                // Explosive dice retain their upward impulse and horizontal momentum.
                let seconds=t*duration
                let up = -(380+Double(origin.y)*0.45+sin(phase)*110)
                let gravity=2*(Double(controls[6].y-origin.y)-up*duration)/(duration*duration)
                let travel=t
                return CGPoint(x:origin.x+(controls[6].x-origin.x)*travel,y:Double(origin.y)+up*seconds+0.5*gravity*seconds*seconds)
            }
            if family == .shard {
                let last=controls[6]
                return CGPoint(x:origin.x+(last.x-origin.x)*(0.80*t+0.20*t*t),y:origin.y+(last.y-origin.y)*t*t)
            }
            var index=0
            while index<5 && t>Self.times[index+1] {index+=1}
            let interval=Self.times[index+1]-Self.times[index],u=(t-Self.times[index])/interval
            func tangent(_ i:Int)->CGPoint {
                if i==0 {return .zero}
                let lo=i-1,hi=min(6,i+1),dt=Self.times[hi]-Self.times[lo]
                return CGPoint(x:(controls[hi].x-controls[lo].x)/dt,y:(controls[hi].y-controls[lo].y)/dt)
            }
            let a=controls[index],b=controls[index+1],m=tangent(index),n=tangent(index+1)
            let h0=2*u*u*u-3*u*u+1,h1=u*u*u-2*u*u+u,h2 = -2*u*u*u+3*u*u,h3=u*u*u-u*u
            return CGPoint(x:a.x*h0+m.x*interval*h1+b.x*h2+n.x*interval*h3,
                y:a.y*h0+m.y*interval*h1+b.y*h2+n.y*interval*h3)
        }
        func opacity(_ t:Double)->Float {
            if let motion=leafMotion {return Float(motion.sample(seconds:sampleElapsed(at:t)).opacity)}
            let times:[Double]=family == .shard && foreground ? [0,0.16,0.24,0.86,1]:[0,0.025,0.40,0.86,1]
            let values:[Double]=family == .shard && foreground ? [0,0,0.78,0.65,0]:[0,0.82,0.82,0.65,0]
            var i=0
            while i<3 && t>times[i+1] {i+=1}
            let u=max(0,min(1,(t-times[i])/(times[i+1]-times[i])))
            return Float(values[i]+(values[i+1]-values[i])*u)
        }
        func transform(_ progress:Double)->CATransform3D {
            let t=max(0,min(1,progress))
            if let motion=leafMotion {
                let pose=motion.sample(seconds:sampleElapsed(at:t)),initial=motion.sample(seconds:0)
                let rotation=CATransform3DMakeRotation(phase+(pose.rotation-initial.rotation)*Double.pi/180,0,0,1)
                var flutter=CATransform3DIdentity;flutter.m21=CGFloat(tan(pose.skewX * Double.pi/180))
                return CATransform3DConcat(rotation,CATransform3DConcat(flutter,
                    CATransform3DMakeScale(pose.imageScaleX,pose.imageScaleY,1)))
            }
            if family == .die {return CATransform3DRotate(CATransform3DIdentity,spin*t,0,0,1)}
            let low=family == .shard ? 0.82:family == .balloon ? 0.94:max(20/Double(side),0.78)
            let scale=low+(1-low)*(0.5+0.5*sin(t*6 * .pi+phase))
            let flutterAngle=family == .leaf ? 0.58:family == .shard ? 0.18:family == .balloon ? 0.12:0.24
            let angle=spin*t+sin(t*(family == .shard ? 6:8) * .pi+phase)*flutterAngle
            let paintedScale=family == .balloon && (foreground || stageBorn) ? 1:scale
            return CATransform3DScale(CATransform3DMakeRotation(angle,0,0,1),paintedScale,paintedScale,1)
        }
    }

    init() {
        for (plane,name) in [(rearPlane,"rear"),(middlePlane,"middle"),(frontPlane,"front"),(balloonStagePlane,"balloon-stage")] {
            plane.isUserInteractionEnabled=false;plane.isAccessibilityElement=false
            plane.accessibilityIdentifier="native.home.breeze.\(name)"
            let strip=UIView();strip.isUserInteractionEnabled=false
            plane.addSubview(strip);slideStrips[ObjectIdentifier(plane)]=strip
            slideWindows[ObjectIdentifier(plane)]=(0..<3).map {index in
                let window=UIView();window.isUserInteractionEnabled=false
                // Arcade balloons retain their full painted silhouette while
                // crossing a neighbouring slide; the viewport owns screen clipping.
                window.clipsToBounds=index != 1
                window.layer.name="native-home-ambient-slide-\(index)"
                strip.addSubview(window);return window
            }
        }
        frontPlane.clipsToBounds=true
    }
    func layout(size:CGSize) {
        guard canvas != size else{return}
        stop();canvas=size
        rearPlane.frame=CGRect(origin:.zero,size:size);middlePlane.frame=rearPlane.frame;frontPlane.frame=rearPlane.frame;balloonStagePlane.frame=rearPlane.frame
        origin=CGPoint(x:size.width/2,y:size.height*0.70)
        slideX=size.width*(1.5-CGFloat(selectedSlide));layoutSlideWindows()
    }
    private func layoutSlideWindows() {
        CATransaction.begin();CATransaction.setDisableActions(true);defer{CATransaction.commit()}
        for plane in [rearPlane,middlePlane,frontPlane,balloonStagePlane] {
            guard let strip=slideStrips[ObjectIdentifier(plane)],let windows=slideWindows[ObjectIdentifier(plane)] else{continue}
            strip.bounds=CGRect(x:0,y:0,width:canvas.width*3,height:plane.bounds.height)
            strip.center=CGPoint(x:slideX,y:plane.bounds.midY)
            for (index,window) in windows.enumerated() {
                window.frame=CGRect(x:CGFloat(index)*canvas.width,y:0,width:canvas.width,height:plane.bounds.height)
            }
        }
    }
    func setSlideX(_ position:CGFloat) {
        slideX=position
        CATransaction.begin();CATransaction.setDisableActions(true);defer{CATransaction.commit()}
        for layer in slideLayers {layer.position.x=position}
    }
    func configure(origin:CGPoint,balloonMaximum:CGFloat,leafOriginY:CGFloat?=nil) {
        self.leafOriginY=leafOriginY
        self.origin=origin;self.balloonMaximum=max(40,min(180,balloonMaximum))
        let size=canvas
        for plane in [frontPlane] where plane.bounds.size != size {
            plane.bounds=CGRect(origin:.zero,size:size)
            plane.layer.position=CGPoint(x:size.width*plane.layer.anchorPoint.x,y:size.height*plane.layer.anchorPoint.y)
        }
        layoutSlideWindows()
    }
    /// A swipe changes birth admission immediately; all Home-eligible thumbnails
    /// were prepared once before visible Home entry. No swipe-time I/O.
    func selectSlide(_ slide:Int) {
        guard (0..<3).contains(slide) else{return}
        guard slide != selectedSlide else{return}
        for particle in pool.values {drain(particle)}
        selectedSlide=slide
    }
    struct Drop {
        let start:CGPoint,velocity:CGPoint,gravity:Double,duration:Double
        init(start:CGPoint,velocityX:Double,viewportHeight:Double,side:Double,variation:Double) {
            self.start=start
            let vy=90+variation*110,g=max(1800,viewportHeight*2.8)*(0.85+variation*0.40)
            let distance=max(20,viewportHeight+side*2-Double(start.y))
            velocity=CGPoint(x:velocityX,y:vy);gravity=g
            duration=min(1.30,max(0.20,(sqrt(vy*vy+2*g*distance)-vy)/g))
        }
        func point(seconds:Double)->CGPoint {
            let t=max(0,min(duration,seconds))
            return CGPoint(x:Double(start.x)+Double(velocity.x)*t,y:Double(start.y)+Double(velocity.y)*t+0.5*gravity*t*t)
        }
    }
    /// Snapshot a born particle into a finite fall. The cached original slot is
    /// immediately reusable, even when the user reverses a swipe mid-fall.
    private func drain(_ particle:Particle) {
        CATransaction.begin();CATransaction.setDisableActions(true)
        defer{CATransaction.commit()}
        let layer=particle.layer,plan=particle.flight
        guard let group=layer.animation(forKey:Self.animationKey) as? CAAnimationGroup else{return}
        let age=layer.convertTime(CACurrentMediaTime(),from:nil)-group.beginTime
        defer{retireFlightReceipt(layer);layer.removeAnimation(forKey:Self.animationKey)}
        guard age>=0 else{return}
        let progress=plan.family == .leaf ? plan.progress(after:age):(plan.family == .balloon || plan.family == .die) ? min(1,age/plan.duration):age.truncatingRemainder(dividingBy:plan.duration)/plan.duration
        let painted=layer.presentation()
        let alpha=painted?.opacity ?? plan.opacity(progress)
        guard alpha>0.01 else{return}
        let ghost=CALayer();ghost.contents=layer.contents;ghost.contentsGravity=layer.contentsGravity
        ghost.bounds=layer.bounds;ghost.position=painted?.position ?? plan.point(progress)
        ghost.transform=painted?.transform ?? plan.transform(progress);ghost.opacity=0
        if plan.family == .die {addPips(to:ghost,value:plan.value)}
        layer.superlayer?.addSublayer(ghost)
        while fallOrder.count>=12,let first=fallOrder.first,let old=falling[first]?.layer {removeFall(old)}
        let receipt=FallReceipt(owner:self,layer:ghost),id=ObjectIdentifier(ghost)
        falling[id]=Falling(layer:ghost,receipt:receipt);fallOrder.append(id)
        let lo=max(0,progress-0.001),hi=min(1,progress+0.001)
        let vx=(plan.point(hi).x-plan.point(lo).x)/max(0.001,plan.elapsed(at:hi)-plan.elapsed(at:lo))
        let position=CAKeyframeAnimation(keyPath:"position"),transform=CAKeyframeAnimation(keyPath:"transform")
        let duration:Double
        if plan.family == .balloon {
            // Finish the exact current flight at its existing clock rate.
            duration=max(0.01,plan.duration-age)
            let start=plan.point(progress),base=ghost.position
            position.values=(0...120).map {step -> NSValue in
                let next=plan.point(progress+(1-progress)*Double(step)/120)
                return NSValue(cgPoint:CGPoint(x:base.x+next.x-start.x,y:base.y+next.y-start.y))
            }
            let baseTransform=ghost.transform,inverse=CATransform3DInvert(plan.transform(progress))
            transform.values=(0...120).map {step in NSValue(caTransform3D:CATransform3DConcat(baseTransform,
                CATransform3DConcat(inverse,plan.transform(progress+(1-progress)*Double(step)/120))))}
        } else {
            let drop=Drop(start:ghost.position,velocityX:max(-300,min(300,Double(vx)*0.35))+Double.random(in:-140...140),
                viewportHeight:Double(canvas.height),side:Double(max(ghost.bounds.width,ghost.bounds.height)),variation:Double.random(in:0...1))
            duration=drop.duration
            position.values=(0...48).map{NSValue(cgPoint:drop.point(seconds:duration*Double($0)/48))}
            let base=ghost.transform
            let spin=plan.family == .die ? (plan.spin>=0 ? 1.0:-1.0)*min(3,max(0,460 * .pi/180-abs(plan.spin*progress))):Double.random(in:-5...5)
            transform.values=(0...48).map{NSValue(caTransform3D:CATransform3DRotate(base,spin*Double($0)/48,0,0,1))}
        }
        let opacity=CAKeyframeAnimation(keyPath:"opacity")
        if plan.family == .balloon {
            opacity.values=(0...120).map{plan.opacity(progress+(1-progress)*Double($0)/120)}
        } else {opacity.values=[alpha,alpha,0];opacity.keyTimes=[0,0.75,1]}
        for animation in [position,transform,opacity] {animation.duration=duration}
        let fall=CAAnimationGroup();fall.animations=[position,transform,opacity];fall.duration=duration;fall.delegate=receipt
        ghost.add(fall,forKey:Self.fallKey)
        if paused {ghost.timeOffset=ghost.convertTime(CACurrentMediaTime(),from:nil);ghost.speed=0}
    }
    private func removeFall(_ layer:CALayer) {
        let id=ObjectIdentifier(layer)
        guard let old=falling.removeValue(forKey:id),old.layer === layer else{return}
        old.receipt.owner=nil;old.receipt.layer=nil;fallOrder.removeAll{$0==id}
        layer.removeAllAnimations();layer.contents=nil;layer.sublayers?.forEach{$0.removeFromSuperlayer()};layer.removeFromSuperlayer()
    }
    func start(resourceRoot:URL,slide:Int=0,reducedMotion:Bool=UIAccessibility.isReduceMotionEnabled) {
        guard !reducedMotion,rearPlane.window != nil,!rearPlane.isHidden,canvas.width>0,canvas.height>0 else{stop();return}
        if !prepared {
            for index in 1...6 {_ = image("assets/shop/bee/leaf\(index).png",root:resourceRoot)}
            for index in 1...3 {_ = image("assets/shop/bush/flowr\(index).png",root:resourceRoot)}
            for color in ["yellow","orange","green","pink"] {_ = image("assets/shop/baloon/\(color).png",root:resourceRoot)}
            // The bounded three-slide Home lease is prepared before visible enter,
            // allowing immediate cached activation on every subsequent swipe.
            for family in Family.allCases where family != .shard {
                for index in 0..<Self.slots(family) {
                    let flight=Flight(family:family,index:index,size:canvas,seed:0,origin:family == .leaf ? CGPoint(x:origin.x,y:leafOriginY ?? origin.y):origin,balloonMaximum:balloonMaximum)
                    guard let image=image(flight.source,root:resourceRoot) else{continue}
                    let layer=CALayer();layer.contents=image;layer.contentsGravity = .resizeAspect;layer.opacity=0
                    configure(layer,flight:flight)

                    place(layer,flight:flight)
                    let key=Key(family:family,index:index)
                    pool[key]=Particle(key:key,layer:layer,flight:flight)
                }
            }
            prepared=true
        }
        if paused {
            for layer in allOwnedLayers {
                let offset=layer.timeOffset;layer.speed=1;layer.timeOffset=0;layer.beginTime=0
                layer.beginTime=layer.convertTime(CACurrentMediaTime(),from:nil)-offset
            }
            paused=false
        }
        activatePrepared(slide:slide)
    }
    private func balloonSeed(index:Int,excluding:Set<String>)->Double {
        let palette=["yellow","orange","green","pink","green"]
        let choices=palette.indices.filter {!excluding.contains("assets/shop/baloon/\(palette[$0]).png")}
        let choice=choices.randomElement() ?? Int.random(in:0..<palette.count)
        return Double((choice-index%palette.count+palette.count)%palette.count)+Double.random(in:0.001...0.999)
    }
    func activatePrepared(slide:Int) {
        guard prepared,!paused,(0..<3).contains(slide),rearPlane.window != nil,!rearPlane.isHidden else{return}
        CATransaction.begin();CATransaction.setDisableActions(true)
        defer{CATransaction.commit()}
        selectSlide(slide)
        for family in Family.allCases where Self.families(slide:slide).contains(family) {
            let continuous=family == .leaf || family == .balloon
            let indices=continuous ? 0..<Self.slots(family):0..<1
            for index in indices {
                guard let particle=pool[Key(family:family,index:index)],particle.layer.animation(forKey:Self.animationKey) == nil else{continue}
                let occupied=Set(pool.values.filter {$0.key.family == .balloon && $0.layer.animation(forKey:Self.animationKey) != nil}.map {$0.flight.source})
                var initialProgress=0.0
                // Retry only the entry candidate if radial scatter misses the
                // visible canvas. Bounded, cached preparation; no frame work.
                for attempt in 0..<8 {
                    let seed=family == .balloon ? balloonSeed(index:index,excluding:occupied):Double.random(in:0...10_000)
                    particle.flight=Flight(family:family,index:index,size:canvas,seed:seed,
                        origin:family == .leaf ? CGPoint(x:origin.x,y:leafOriginY ?? origin.y):origin,balloonMaximum:balloonMaximum)
                    guard continuous,index==0 else{break}
                    if family == .leaf,particle.flight.origin.y>=0,attempt<7 {continue}
                    if let visible=particle.flight.visibleEntryProgress(in:canvas) {initialProgress=visible;break}
                }
                configure(particle.layer,flight:particle.flight);place(particle.layer,flight:particle.flight)
                let stagger=index==0 ? 0:family == .leaf ? Double(index-1)*0.55+Double.random(in:0.45...0.75):Double.random(in:1.2...1.8)
                install(particle,birthDelay:continuous ? stagger:nil,initialProgress:initialProgress)
                if !continuous {admitExtraFlight(family:family,after:particle.flight.playbackDuration)}
            }
        }
        running=true
    }
    /// One finite extra flight per five primary births gives 20percent more
    /// without changing flight speed,size or the primary renewal cadence.
    private func admitExtraFlight(family:Family,after primaryDuration:Double) {
        let cycle=extraBirthCycles[family,default:0]
        extraBirthCycles[family]=(cycle+1)%5
        guard cycle==0,let extra=pool[Key(family:family,index:1)],extra.layer.animation(forKey:Self.animationKey) == nil else{return}
        let occupied=Set(pool.values.filter {$0.key.family == .balloon && $0.layer.animation(forKey:Self.animationKey) != nil}.map {$0.flight.source})
        let seed=family == .balloon ? balloonSeed(index:1,excluding:occupied):Double.random(in:0...10_000)
        extra.flight=Flight(family:family,index:1,size:canvas,seed:seed,
            origin:family == .leaf ? CGPoint(x:origin.x,y:leafOriginY ?? origin.y):origin,balloonMaximum:balloonMaximum)
        configure(extra.layer,flight:extra.flight);place(extra.layer,flight:extra.flight)
        install(extra,birthDelay:primaryDuration*0.35+extra.flight.birth)
    }
    private func place(_ layer:CALayer,flight:Flight) {
        // Leaves stay behind the hero; 40percent of independent flower flights pass in front.
        let plane=flight.family == .leaf ? (flight.foreground ? frontPlane:flight.rear ? rearPlane:middlePlane):(flight.stageBorn || flight.diceAboveClouds) ? balloonStagePlane:flight.foreground ? frontPlane:flight.rear ? rearPlane:middlePlane
        let slide=flight.family == .leaf ? 0:flight.family == .die ? 2:1
        guard let window=slideWindows[ObjectIdentifier(plane)]?[slide] else{return}
        if layer.superlayer !== window.layer {window.layer.addSublayer(layer)}
    }
    private func configure(_ layer:CALayer,flight:Flight) {
        let image=images[flight.source]
        layer.contents=image
        let ratio=CGFloat(image?.height ?? 1)/CGFloat(max(1,image?.width ?? 1))
        // Enlarge only Home Journey leaves/flowers; keep the authored flight
        // side, origins, paths and clocks unchanged.
        let side=flight.side*(flight.family == .leaf ? 1.50:1)
        layer.bounds=flight.family == .balloon ? CGRect(x:0,y:0,width:side/max(1,ratio),height:side*min(1,ratio)):CGRect(x:0,y:0,width:side,height:side)
        if flight.family == .die,(layer.sublayers?.first?.name != "ambient-pips-\(flight.value)" || layer.sublayers?.first?.bounds.size != layer.bounds.size) {
            layer.sublayers?.forEach{$0.removeFromSuperlayer()};addPips(to:layer,value:flight.value)
        }
    }
    private func image(_ path:String,root:URL)->CGImage? {
        if let image=images[path] {return image}
        let base=root.appendingPathComponent(path)
        let doubled=base.deletingPathExtension().path+"@2x.png"
        let sourceURL=FileManager.default.fileExists(atPath:doubled) ? URL(fileURLWithPath:doubled):base
        guard let source=CGImageSourceCreateWithURL(sourceURL as CFURL,nil),
              let image=CGImageSourceCreateThumbnailAtIndex(source,0,[
                kCGImageSourceCreateThumbnailFromImageAlways:true,
                kCGImageSourceThumbnailMaxPixelSize:path.contains("/baloon/") ? min(480,balloonMaximum*(rearPlane.window?.screen.scale ?? 2)):min(180,60*(rearPlane.window?.screen.scale ?? 2)),
                kCGImageSourceCreateThumbnailWithTransform:true,
                kCGImageSourceShouldCacheImmediately:true] as CFDictionary) else{return nil}
        let prepared=path=="assets/tile.png" ? Self.settingsDieImage(image):image
        images[path]=prepared;return prepared
    }
    /// Match the cream/apricot die faces in settings-slider, preserving the
    /// original tile's shading, texture and alpha. Prepared once in Home's cache.
    private static func settingsDieImage(_ image:CGImage)->CGImage {
        guard let context=CGContext(data:nil,width:image.width,height:image.height,
            bitsPerComponent:8,bytesPerRow:0,space:CGColorSpaceCreateDeviceRGB(),
            bitmapInfo:CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue) else{return image}
        context.draw(image,in:CGRect(x:0,y:0,width:image.width,height:image.height))
        guard let data=context.data else{return image}
        let pixels=data.assumingMemoryBound(to:UInt8.self)
        for y in 0..<image.height {
            for x in 0..<image.width {
                let i=y*context.bytesPerRow+x*4,alpha=Double(pixels[i+3])/255
                guard alpha>0 else{continue}
                let light=(0.2126*Double(pixels[i])+0.7152*Double(pixels[i+1])+0.0722*Double(pixels[i+2]))/alpha
                // Reference face approximately RGB(255,213,158), warm shadows.
                for (channel,offset) in [37.0,-5.0,-60.0].enumerated() {
                    pixels[i+channel]=UInt8((max(0,min(255,light+offset))*alpha).rounded())
                }
            }
        }
        return context.makeImage() ?? image
    }
    private func addPips(to layer:CALayer,value:Int) {
        // Preserved TNT/Bloob decorative die recipe:tile.png plus64pt pip map,
        // 15pt grid,7.5pt rounded pips; warm terracotta matches Settings art.
        let map=[1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]]
        let path=CGMutablePath(),scale=layer.bounds.width/64
        for index in map[value] ?? [] {
            let rect=CGRect(x:(32+CGFloat(index%3-1)*15-3.75)*scale,y:(32+CGFloat(index/3-1)*15-3.75)*scale,width:7.5*scale,height:7.5*scale)
            path.addRoundedRect(in:rect,cornerWidth:2.2*scale,cornerHeight:2.2*scale)
        }
        let pips=CAShapeLayer();pips.name="ambient-pips-\(value)";pips.frame=layer.bounds;pips.path=path
        pips.fillColor=UIColor(red:217.0/255,green:124.0/255,blue:61.0/255,alpha:1).cgColor
        layer.addSublayer(pips)
    }
    private func install(_ particle:Particle,delayBirth:Bool=true,birthDelay:Double?=nil,initialProgress:Double=0) {
        let plan=particle.flight,layer=particle.layer
        let start=0.0,end=1.0
        let duration=plan.playbackDuration*(end-start)
        func progress(_ index:Int)->Double {start+(end-start)*Double(index)/120}
        layer.position=plan.point(start)
        let position=CAKeyframeAnimation(keyPath:"position")
        position.values=(0...120).map{NSValue(cgPoint:plan.point(progress($0)))}
        position.calculationMode = .linear
        let transform=CAKeyframeAnimation(keyPath:"transform")
        transform.values=(0...120).map{NSValue(caTransform3D:plan.transform(progress($0)))}
        let opacity=CAKeyframeAnimation(keyPath:"opacity")
        opacity.values=(0...120).map{plan.opacity(progress($0))}
        for animation in [position,transform,opacity] {
            animation.duration=duration
            if plan.family == .leaf {animation.keyTimes=(0...120).map{NSNumber(value:plan.elapsed(at:progress($0))/duration)}}
        }
        let flight=CAAnimationGroup();flight.animations=[position,transform,opacity]
        flight.duration=duration
        if plan.family == .leaf || plan.family == .balloon || plan.family == .die {
            retireFlightReceipt(layer)
            let receipt=FlightReceipt(owner:self,layer:layer)
            flightReceipts[ObjectIdentifier(layer)]=receipt;flight.delegate=receipt
        } else {flight.repeatCount = .infinity}
        flight.beginTime=layer.convertTime(CACurrentMediaTime(),from:nil)+(birthDelay ?? (delayBirth ? plan.birth:0))-plan.elapsed(at:initialProgress)
        layer.add(flight,forKey:Self.animationKey)
    }
    private func retireFlightReceipt(_ layer:CALayer) {
        if let old=flightReceipts.removeValue(forKey:ObjectIdentifier(layer)) {old.owner=nil;old.layer=nil}
    }
    private func flightFinished(_ layer:CALayer,receipt:FlightReceipt) {
        let id=ObjectIdentifier(layer)
        guard flightReceipts[id] === receipt else{return}
        retireFlightReceipt(layer);layer.removeAnimation(forKey:Self.animationKey)
        guard running,!paused,rearPlane.window != nil,
              !rearPlane.isHidden,UIApplication.shared.applicationState == .active,
              let particle=pool.values.first(where:{$0.layer === layer}),
              (particle.key.index==0 || particle.key.family == .leaf || particle.key.family == .balloon),
              Self.families(slide:selectedSlide).contains(particle.key.family) else{return}
        CATransaction.begin();CATransaction.setDisableActions(true);defer{CATransaction.commit()}
        let family=particle.key.family
        let seed:Double
        if family == .balloon {
            let occupied=Set(pool.values.filter {$0.key.family == .balloon && ($0.layer.animation(forKey:Self.animationKey) != nil || $0 === particle)}.map {$0.flight.source})
            seed=balloonSeed(index:particle.key.index,excluding:occupied)
        } else {seed=Double.random(in:0...10_000)}
        particle.flight=Flight(family:family,index:particle.key.index,size:canvas,seed:seed,
            origin:family == .leaf ? CGPoint(x:origin.x,y:leafOriginY ?? origin.y):origin,balloonMaximum:balloonMaximum)
        configure(layer,flight:particle.flight);place(layer,flight:particle.flight);install(particle,delayBirth:false)
        if family != .leaf && family != .balloon {admitExtraFlight(family:family,after:particle.flight.playbackDuration)}
    }
    func pause() {
        guard running,!paused else{return}
        for layer in allOwnedLayers {layer.timeOffset=layer.convertTime(CACurrentMediaTime(),from:nil);layer.speed=0}
        paused=true
    }
    func stop() {
        for layer in slideLayers {layer.removeAnimation(forKey:"native-slide-selection")}
        for receipt in flightReceipts.values {receipt.owner=nil;receipt.layer=nil};flightReceipts.removeAll()
        for layer in fallingLayers {removeFall(layer)}
        for layer in particles {
            layer.removeAllAnimations();layer.contents=nil
            layer.sublayers?.forEach{$0.removeAllAnimations();$0.removeFromSuperlayer()}
            layer.removeFromSuperlayer()
        }
        pool.removeAll();extraBirthCycles.removeAll();images.removeAll();running=false;paused=false;prepared=false
    }
}
