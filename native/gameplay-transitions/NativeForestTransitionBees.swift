import UIKit

/// Source NN bees use captured arc-length routes, warped knot speeds and live
/// mountain occlusion; the themed transition owns their single external clock.
struct NativeForestTransitionBeeMotion {
    struct Sample {let point:CGPoint,distance:Double}
    struct Plan {
        let role:String,mode:String,initialDirection:Int,scaleMultiplier:Double,vertical:Double,verticalCycles:Double,horizontal:Double,horizontalCycles:Double,phase:Double,scaleStart:Double,scaleEnd:Double,lifetimeScale:Double,times:[Double],waves:[Double],points:[CGPoint],samples:[Sample],knotDistances:[Double],baseScale:Double,introScale:Double
        var end:Double {times.last ?? 0}
    }
    struct Pose {let point:CGPoint,rotation:Double,scaleX:Double,scaleY:Double,asset:Int,behindMountain:Bool,hidden:Bool}
    static let beeWidth=58.0*1.7
    static func clamp(_ p:Double,_ lo:Double=0,_ hi:Double=1)->Double {min(hi,max(lo,p))}
    static func smooth(_ p:Double)->Double {let x=clamp(p);return x*x*(3-2*x)}
    private static func catmull(_ points:[CGPoint],_ progress:Double)->CGPoint {
        let segments=points.count-1,scaled=clamp(progress,0,0.999999)*Double(segments),index=min(segments-1,Int(floor(scaled))),t=scaled-Double(index),t2=t*t,t3=t2*t
        let p1=points[index],p2=points[index+1],p0=index>0 ? points[index-1]:CGPoint(x:p1.x*2-p2.x,y:p1.y*2-p2.y),p3=index+2<points.count ? points[index+2]:CGPoint(x:p2.x*2-p1.x,y:p2.y*2-p1.y)
        func axis(_ a:Double,_ b:Double,_ c:Double,_ d:Double)->Double {0.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t2+(-a+3*b-3*c+d)*t3)}
        return CGPoint(x:axis(p0.x,p1.x,p2.x,p3.x),y:axis(p0.y,p1.y,p2.y,p3.y))
    }
    static func arc(_ points:[CGPoint])->[Sample] {
        var previous=catmull(points,0),distance=0.0,result=[Sample(point:previous,distance:0)]
        let count=max(384,(points.count-1)*64)
        for index in 1...count {let p=catmull(points,Double(index)/Double(count));distance+=hypot(p.x-previous.x,p.y-previous.y);result.append(Sample(point:p,distance:distance));previous=p}
        return result
    }
    static func sample(_ samples:[Sample],distance:Double)->CGPoint {
        let bounded=clamp(distance,0,samples.last!.distance)
        var lo=0,hi=samples.count-1
        while lo+1<hi {let middle=(lo+hi)/2;if samples[middle].distance<bounded {lo=middle}else {hi=middle}}
        let from=samples[lo],to=samples[hi],mix=(bounded-from.distance)/max(0.0001,to.distance-from.distance)
        return CGPoint(x:from.point.x+(to.point.x-from.point.x)*mix,y:from.point.y+(to.point.y-from.point.y)*mix)
    }
    static func wobble(_ point:CGPoint,distance:Double,total:Double,plan:Plan)->CGPoint {
        guard (plan.vertical>0 || plan.horizontal>0),total>0 else {return point}
        let p=clamp(distance/total),envelope=pow(sin(.pi*p),1.35),va=(p*plan.verticalCycles+plan.phase)*2 * .pi,ha=(p*plan.horizontalCycles+plan.phase*0.73)*2 * .pi
        return CGPoint(x:point.x+cos(ha)*plan.horizontal*envelope,y:point.y+sin(va)*plan.vertical*envelope)
    }
    static func make(viewport:CGSize,digitCenters:[CGPoint],initialDigitHeights:[CGFloat],random:()->Double)->[Plan] {
        guard !digitCenters.isEmpty else {return []}
        let centers=[digitCenters[0],digitCenters.count>1 ? digitCenters[1]:digitCenters[0]],center=CGPoint(x:(centers[0].x+centers[1].x)*0.5,y:(centers[0].y+centers[1].y)*0.5),width=Double(viewport.width),height=Double(viewport.height)
        let rx=max(76,abs(centers[1].x-centers[0].x)*0.5+24),ry=max(34,(initialDigitHeights.max() ?? 0)*0.3),sx=min(width*0.38,rx*1.72),sy=min(height*0.27,max(62,ry*1.68)*1.48)
        func roll()->Double {let p=random();return p.isFinite ? clamp(p,0,1-Double.ulpOfOne):0.5}
        func between(_ lo:Double,_ hi:Double)->Double {lo+roll()*(hi-lo)}
        let spreadX=0.92+roll()*0.2,spreadY=0.90+roll()*0.24,leftEntry=height*between(0.045,0.095),rightEntry=height*between(0.84,0.94),leftExit=center.y+sy*between(0.94,1.12),rightExit=center.y+sy*between(1.24,1.42)
        func digit(_ i:Int,_ dx:Double,_ dy:Double)->CGPoint {CGPoint(x:centers[i].x+dx*sx,y:centers[i].y+dy*sy)}
        func story(_ dx:Double,_ dy:Double,_ jitter:Double=0.055)->CGPoint {let x=center.x+(dx+(roll()*2-1)*jitter)*sx*spreadX,y=center.y+(dy+(roll()*2-1)*jitter*1.18)*sy*spreadY;return CGPoint(x:x,y:y)}
        func times(_ values:[Double])->[Double] {values.enumerated().map {i,t in i==0 || i==values.count-1 ? t:max(values[i-1]+0.12,min(values[i+1]-0.12,t+between(-0.045,0.045)))}}
        func waves(_ values:[Double])->[Double] {values.map {max(0.06,min(0.20,$0+between(-0.025,0.025)))}}
        struct Draft {let role:String,mode:String,direction:Int,scale:Double,v:Double,vc:Double,h:Double,hc:Double,phase:Double,start:Double,end:Double,lifetime:Double,times:[Double],waves:[Double],points:[CGPoint]}
        var drafts=[Draft]()
        func append(_ role:String,_ mode:String,_ direction:Int,_ scale:(Double,Double),_ v:(Double,Double),_ vc:(Double,Double),_ h:(Double,Double),_ hc:(Double,Double),_ start:Double,_ end:Double,_ lifetime:Double,_ rawTimes:[Double],_ rawWaves:[Double],_ points:()->[CGPoint]) {
            let scale=between(scale.0,scale.1),v=between(v.0,v.1),vc=between(vc.0,vc.1),h=between(h.0,h.1),hc=between(hc.0,hc.1),phase=roll(),knots=times(rawTimes),speeds=waves(rawWaves),points=points()
            drafts.append(Draft(role:role,mode:mode,direction:direction,scale:scale,v:v,vc:vc,h:h,hc:hc,phase:phase,start:start,end:end,lifetime:lifetime,times:knots,waves:speeds,points:points))
        }
        append("left","retarget",-1,(0.90,1),(6,13),(1.25,2.05),(4,9),(0.85,1.45),0.40,0.50,0.60,[0,0.45,0.78,1.15,1.50,1.82,2.15,2.48,2.98,3.50],[0.16,0.08,0.12,0.10,0.14,0.09,0.15,0.11,0.18]) {
            [.init(x:width+beeWidth+34,y:leftEntry),story(-1.30,-0.52),digit(0,-0.05,-0.02),story(-0.08,-1.02),story(1.02,-0.38),digit(1,0.04,0.04),story(0.86,0.66),story(0.02,1.02),story(-0.92,0.58),.init(x:-beeWidth-36,y:leftExit)]
        }
        append("right","none",-1,(0.84,0.96),(8,16),(1.55,2.35),(5,11),(1.05,1.65),0.80,0.88,0.70,[0,0.48,0.82,1.20,1.55,1.88,2.22,2.56,3.03,3.55],[0.14,0.10,0.08,0.15,0.10,0.13,0.09,0.16,0.18]) {
            [.init(x:width+34,y:rightEntry),story(1.24,0.42),digit(1,0.04,0.02),story(0.14,1),story(-1.18,0.34),digit(0,-0.04,-0.04),story(-0.82,-0.68),story(0.04,-1.04),story(0.94,-0.48),.init(x:width+beeWidth+36,y:rightExit)]
        }
        append("high-scout","none",1,(0.82,0.96),(28,38),(1.85,2.45),(11,17),(1.20,1.70),0.54,0.69,0.74,[0,0.44,0.82,1.18,1.56,1.94,2.34,2.72,3.10,3.50],[0.08,0.14,0.09,0.13,0.07,0.15,0.09,0.12,0.10]) {
            [.init(x:-beeWidth-between(12,24),y:height*between(0.10,0.18)),digit(0,-0.30,-0.62),digit(0,0.08,0.10),story(0.16,1.18,0.035),digit(1,-0.10,0.02),story(0.72,-1.24,0.035),digit(0,0.12,-0.12),story(-0.82,0.88,0.035),story(-1.08,-0.72,0.035),.init(x:-beeWidth-between(48,68),y:center.y-sy*between(1.20,1.42))]
        }
        append("low-dancer","occlude",1,(0.50,0.60),(38,48),(2.35,3.05),(15,21),(1.55,2.05),0.64,0.84,0.66,[0,0.36,0.74,1.10,1.50,1.88,2.28,2.66,3.08,3.52],[0.19,0.07,0.15,0.10,0.18,0.08,0.16,0.09,0.14]) {
            [.init(x:-beeWidth-between(48,64),y:height*between(0.86,0.94)),story(-1.44,1.54,0.035),story(0.74,1.36,0.035),story(1.36,-0.78,0.035),digit(1,-0.12,0.08),story(-0.26,-1.58,0.035),digit(0,0.14,-0.10),story(-1.40,0.76,0.035),story(0.54,1.62,0.035),.init(x:width+beeWidth+between(52,70),y:center.y+sy*between(1.52,1.70))]
        }
        let intro=min(3,Int(floor(roll()*4)))
        return drafts.enumerated().map {index,p in
            let samples=arc(p.points),base=0.78*0.85*p.scale,knots=p.points.indices.map {samples[Int((Double($0)/Double(p.points.count-1)*Double(samples.count-1)).rounded())].distance}
            return Plan(role:p.role,mode:p.mode,initialDirection:p.direction,scaleMultiplier:p.scale,vertical:p.v,verticalCycles:p.vc,horizontal:p.h,horizontalCycles:p.hc,phase:p.phase,scaleStart:p.start,scaleEnd:p.end,lifetimeScale:p.lifetime,times:p.times,waves:p.waves,points:p.points,samples:samples,knotDistances:knots,baseScale:base,introScale:(1+160/(beeWidth*base))*(index==intro ? 1:0.70))
        }
    }
    struct Runtime {
        let plan:Plan
        private var bank=0.0,previousClock=0.0,horizontalDirection:Int,currentAsset:Int,pendingAsset:Int?,pendingSeconds=0.0,behind=false
        private var mountainSamples:[Sample]?,mountainStarted=0.0,peak:CGRect?
        init(_ plan:Plan) {self.plan=plan;horizontalDirection=plan.initialDirection;currentAsset=plan.initialDirection<0 ? 3:1}
        static func asset(vx:Double,vy:Double,fallback:Int)->Int {
            let magnitude=hypot(vx,vy)
            guard magnitude.isFinite,magnitude>=0.01 else {return fallback}
            if abs(vx)<magnitude*0.12 {return vy<0 ? 5:7}
            let steep=abs(vx)*0.42
            if vx>0 {if vy < -steep {return 2};if vy>steep {return 6};return 1}
            if vy < -steep {return abs(vy)>abs(vx)*1.35 ? 5:4};if vy>steep {return 7};return 3
        }
        mutating func sample(seconds:Double,mountainBounds:CGRect?)->Pose {
            let t=max(0,seconds),total=plan.samples.last!.distance
            let segment=(0..<plan.times.count-1).first {t<plan.times[$0+1]} ?? plan.times.count-2
            let p=clamp((t-plan.times[segment])/(plan.times[segment+1]-plan.times[segment])),wave=plan.waves[segment],warped=p+wave/(2 * .pi)*sin(2 * .pi*p),travel=plan.knotDistances[segment]+(plan.knotDistances[segment+1]-plan.knotDistances[segment])*warped
            var point=wobble(NativeForestTransitionBeeMotion.sample(plan.samples,distance:travel),distance:travel,total:total,plan:plan),activeSamples=plan.samples,activeDistance=travel
            if plan.mode != "none",segment>=plan.times.count-3 {
                if peak == nil,let mountain=mountainBounds,mountain.width>0,mountain.height>0 {
                    let top=mountain.minY+mountain.height*(48.0/328),bottom=mountain.minY+mountain.height*((48+27.6)/328)
                    let summit=CGPoint(x:mountain.minX+mountain.width*0.515-beeWidth*0.5,y:(top+bottom)*0.5-beeWidth*0.5)
                    if plan.mode == "retarget" {mountainSamples=arc([point,summit,plan.points.last!]);mountainStarted=t}
                    peak=CGRect(x:mountain.minX+mountain.width*(168.0/390),y:top,width:mountain.width*((232.0-168)/390),height:bottom-top)
                }
                if let mountainSamples {
                    let exit=clamp((t-mountainStarted)/(plan.end-mountainStarted)),warped=exit+0.08/(2 * .pi)*sin(2 * .pi*exit)
                    activeSamples=mountainSamples;activeDistance=mountainSamples.last!.distance*warped;point=NativeForestTransitionBeeMotion.sample(activeSamples,distance:activeDistance)
                }
            }
            let activeTotal=activeSamples.last!.distance
            let before=wobble(NativeForestTransitionBeeMotion.sample(activeSamples,distance:activeDistance-8),distance:activeDistance-8,total:activeTotal,plan:plan),after=wobble(NativeForestTransitionBeeMotion.sample(activeSamples,distance:activeDistance+8),distance:activeDistance+8,total:activeTotal,plan:plan),vx=after.x-before.x,vy=after.y-before.y,delta=clamp(t-previousClock,0,1.0/30)
            let speed=1+wave*cos(2 * .pi*p)
            if plan.mode != "none",let peak {
                behind=point.x+beeWidth>=peak.minX && point.x<=peak.maxX && point.y+beeWidth>=peak.minY && point.y<=peak.maxY
            }
            let targetBank=clamp(atan2(vy,max(0.01,abs(vx)))*180 / .pi*0.16,-11,11)
            bank+=(targetBank-bank)*(1-exp(-10*delta))
            let stretch=clamp((speed-1)*0.055,-0.018,0.045),breath=sin(travel/93+Double(Self.index(plan.role))*2.17)*0.010,remaining=activeTotal-activeDistance,exitScale=smooth(clamp(remaining/70)),lifetimeProgress=clamp(t/plan.end),procedural=1-0.30*smooth(clamp((220-remaining)/(220-90))),lifetime=1+(plan.lifetimeScale-1)*smooth(clamp((lifetimeProgress-plan.scaleStart)/(plan.scaleEnd-plan.scaleStart))),intro=plan.introScale+(1-plan.introScale)*smooth(clamp(t))
            let next=abs(vx)>0.12 ? (vx>0 ? 1:-1):horizontalDirection
            let candidate=Self.asset(vx:vx,vy:vy,fallback:currentAsset)
            if next != horizontalDirection {
                horizontalDirection=next
                currentAsset=Self.asset(vx:vx,vy:vy,fallback:vx<0 ? 3:1);pendingAsset=nil;pendingSeconds=0
            } else if candidate==currentAsset {pendingAsset=nil;pendingSeconds=0}
            else if candidate != pendingAsset {pendingAsset=candidate;pendingSeconds=0}
            else {pendingSeconds+=delta;if pendingSeconds>=0.05 {currentAsset=candidate;pendingAsset=nil;pendingSeconds=0}}
            previousClock=t
            let base=plan.baseScale*intro*lifetime*procedural*exitScale
            return Pose(point:point,rotation:bank,scaleX:base*(1+stretch+breath),scaleY:base*(1-stretch*0.65-breath*0.5),asset:currentAsset,behindMountain:behind,hidden:travel>=total || t>=3.55+1.0/60)
        }
        private static func index(_ role:String)->Int {role=="left" ? 0:role=="right" ? 1:role=="high-scout" ? 2:3}
    }
}

@MainActor
final class NativeForestTransitionBees: UIView {
    let needsNativeParityReady:Bool
    let duration:Double
    private let behindLayer=UIView(),rearLayer=UIView(),frontLayer=UIView()
    private var flights:[NativeForestTransitionBeeMotion.Runtime]
    private var sprites:[UIImageView]=[],assets:[Int:UIImage],disposed=false
    init(viewport:CGSize,digitCenters:[CGPoint],initialDigitHeights:[CGFloat]=[0,0],images:[String:UIImage],random:()->Double={Double.random(in:0..<1)}) {
        let plans=NativeForestTransitionBeeMotion.make(viewport:viewport,digitCenters:digitCenters,initialDigitHeights:initialDigitHeights,random:random)
        flights=plans.map(NativeForestTransitionBeeMotion.Runtime.init)
        assets=Dictionary(uniqueKeysWithValues:(1...7).compactMap {index in images["bee\(index)"].map {(index,$0)}})
        needsNativeParityReady=plans.count==4 && assets.count==7
        duration=(plans.map(\.end).max() ?? 0)+1.0/60
        super.init(frame:CGRect(origin:.zero,size:viewport));isUserInteractionEnabled=false;isOpaque=false;backgroundColor = .clear
        for (layer,z) in [(behindLayer,3),(rearLayer,9),(frontLayer,11)] {layer.frame=bounds;layer.isUserInteractionEnabled=false;layer.isOpaque=false;layer.backgroundColor = .clear;layer.clipsToBounds=false;layer.layer.zPosition=CGFloat(z)}
        for plan in plans {
            let sprite=UIImageView(image:assets[plan.initialDirection<0 ? 3:1]);sprite.isUserInteractionEnabled=false;sprite.contentMode = .scaleAspectFit
            let width=NativeForestTransitionBeeMotion.beeWidth,height=width*Double(sprite.image?.size.height ?? 1)/max(1,Double(sprite.image?.size.width ?? 1))
            sprite.bounds=CGRect(x:0,y:0,width:width,height:height);sprite.layer.position=CGPoint(x:plan.samples[0].point.x+width/2,y:plan.samples[0].point.y+height/2)
            sprite.transform=CGAffineTransform(scaleX:plan.baseScale*plan.introScale,y:plan.baseScale*plan.introScale)
            (plan.role=="left" ? frontLayer:rearLayer).addSubview(sprite);sprites.append(sprite)
        }
    }
    required init?(coder:NSCoder) {fatalError("init(coder:) has not been implemented")}
    func mountLayers(in parent:UIView) {guard !disposed,needsNativeParityReady else {return};for layer in [behindLayer,rearLayer,frontLayer] {parent.addSubview(layer)}}
    func paint(seconds:Double,mountainBounds:CGRect?) {
        guard !disposed,needsNativeParityReady else {return}
        for index in flights.indices {
            let pose=flights[index].sample(seconds:seconds,mountainBounds:mountainBounds),sprite=sprites[index]
            let home=flights[index].plan.role=="left" ? frontLayer:rearLayer,target=pose.behindMountain ? behindLayer:home
            if sprite.superview !== target {target.addSubview(sprite)}
            sprite.image=assets[pose.asset]
            let width=NativeForestTransitionBeeMotion.beeWidth,height=width*Double(sprite.image?.size.height ?? 1)/max(1,Double(sprite.image?.size.width ?? 1))
            sprite.bounds=CGRect(x:0,y:0,width:width,height:height);sprite.layer.position=CGPoint(x:pose.point.x+width/2,y:pose.point.y+height/2)
            sprite.transform=CGAffineTransform(rotationAngle:pose.rotation * .pi/180).scaledBy(x:pose.scaleX,y:pose.scaleY);sprite.isHidden=pose.hidden
        }
    }
    func dispose() {guard !disposed else {return};disposed=true;for layer in [behindLayer,rearLayer,frontLayer] {layer.removeFromSuperview();layer.subviews.forEach {$0.removeFromSuperview()}};sprites.removeAll();assets.removeAll();flights.removeAll();removeFromSuperview()}
}
