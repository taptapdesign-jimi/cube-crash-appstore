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
    static func make(viewport:CGSize,digitCenters:[CGPoint],initialDigitHeights:[CGFloat],randomizeRoutes:Bool=false,random:()->Double)->[Plan] {
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
            var points=p.points
            if randomizeRoutes {
                // Capture a different loop for each bee once per transition.
                // Keep offscreen entry and the authored final approach/exit.
                // Derive the private route stream from the captured bee seed;
                // surrounding scene randomness keeps its original draw boundary.
                var routeState=UInt32(p.phase*Double(UInt32.max)) ^ UInt32(index+1)
                func routeRoll()->Double {routeState=1664525 &* routeState &+ 1013904223;return Double(routeState)/4294967296}
                func routeBetween(_ lo:Double,_ hi:Double)->Double {lo+routeRoll()*(hi-lo)}
                let rotation=routeBetween(-0.70,0.70),mirror=routeRoll()<0.5 ? -1.0:1.0
                let spread=routeBetween(0.78,1.18),offsetX=routeBetween(-width*0.10,width*0.10),offsetY=routeBetween(-height*0.07,height*0.07)
                let reverse=routeRoll()<0.5,interior=Array(points[1..<points.count-2])
                for knot in 1..<points.count-2 {
                    let source=interior[reverse ? interior.count-knot:knot-1]
                    let dx=(source.x-center.x)*mirror*spread,dy=(source.y-center.y)*spread
                    let x=center.x+dx*cos(rotation)-dy*sin(rotation)+offsetX+routeBetween(-width*0.06,width*0.06)
                    let y=center.y+dx*sin(rotation)+dy*cos(rotation)+offsetY+routeBetween(-height*0.035,height*0.035)
                    points[knot]=CGPoint(x:clamp(x,-beeWidth*0.25,width-beeWidth*0.25),y:clamp(y,height*0.035,height*0.74))
                }
            }
            let samples=arc(points),base=0.78*0.85*p.scale,knots=points.indices.map {samples[Int((Double($0)/Double(points.count-1)*Double(samples.count-1)).rounded())].distance}
            return Plan(role:p.role,mode:p.mode,initialDirection:p.direction,scaleMultiplier:p.scale,vertical:p.v,verticalCycles:p.vc,horizontal:p.h,horizontalCycles:p.hc,phase:p.phase,scaleStart:p.start,scaleEnd:p.end,lifetimeScale:p.lifetime,times:p.times,waves:p.waves,points:points,samples:samples,knotDistances:knots,baseScale:base,introScale:(1+160/(beeWidth*base))*(index==intro ? 1:0.70))
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
        mutating func sample(seconds:Double,mountainBounds:CGRect?,hideAt:Double=3.55+1.0/60)->Pose {
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
            return Pose(point:point,rotation:bank,scaleX:base*(1+stretch+breath),scaleY:base*(1-stretch*0.65-breath*0.5),asset:currentAsset,behindMountain:behind,hidden:travel>=total || t>=hideAt)
        }
        private static func index(_ role:String)->Int {role=="left" ? 0:role=="right" ? 1:role=="high-scout" ? 2:3}
    }
}

@MainActor
final class NativeForestTransitionBees: UIView {
    let needsNativeParityReady:Bool
    let duration:Double
    let numberBeeCount:Int
    private let behindLayer=UIView(),rearLayer=UIView(),frontLayer=UIView()
    private(set) var flights:[NativeResultForestBees.Plan]
    private var sprites:[UIImageView]=[],assets:[Int:UIImage],disposed=false
    private var facing:[Int]=[]
    init(viewport:CGSize,digitCenters:[CGPoint],initialDigitHeights:[CGFloat]=[0,0],images:[String:UIImage],random:()->Double={Double.random(in:0..<1)}) {
        // Preserve the transition's151 external RNG draws so scenery does not change.
        let source=NativeForestTransitionBeeMotion.make(viewport:viewport,digitCenters:digitCenters,initialDigitHeights:initialDigitHeights,random:random)
        let flightDuration=(source.map(\.end).max() ?? 0)+1.0/60
        duration=flightDuration
        var seed=UInt32(truncatingIfNeeded:UInt64(abs(source.first?.phase ?? 0)*1_000_000)+UInt64(abs(source.dropFirst().first?.points.first?.y ?? 0)*1000))
        func roll()->Double {seed=1664525 &* seed &+ 1013904223;return Double(seed)/4294967296}
        let numberCount=roll()<0.5 ? 2:3
        numberBeeCount=numberCount
        let scattered=[0]+Array((numberCount+1)..<6)
        let top=viewport.height*0.09,bottom=viewport.height*0.91
        let spacing=(bottom-top)/6
        let numberCenter=CGPoint(x:digitCenters.isEmpty ? viewport.width/2:digitCenters.map(\.x).reduce(0,+)/Double(digitCenters.count),
                                 y:digitCenters.isEmpty ? viewport.height*0.285:digitCenters.map(\.y).reduce(0,+)/Double(digitCenters.count))
        let beeSeeds=(0..<6).map {_ in UInt32(roll()*Double(UInt32.max))}
        flights=(0..<6).map { index in
            var beeSeed=beeSeeds[index]
            func roll()->Double {beeSeed=1664525 &* beeSeed &+ 1013904223;return Double(beeSeed)/4294967296}
            let aroundNumber=(1...numberCount).contains(index)
            let scatteredIndex=scattered.firstIndex(of:index) ?? 0
            let row=scatteredIndex==0 ? top:viewport.height*(0.62+0.29*Double(scatteredIndex-1)/Double(max(1,scattered.count-2)))
            // Separate nearby stations, never angular/orbit waypoints.
            let stationX=(roll()-0.5)*230
            let stationY=[-90.0,30.0,150.0][max(0,min(2,index-1))]
            @MainActor func destination()->CGPoint {
                if aroundNumber {
                    return CGPoint(x:min(viewport.width-45,max(45,numberCenter.x+stationX+(roll()-0.5)*36)),
                                   y:min(bottom,max(top,numberCenter.y+stationY+(roll()-0.5)*24)))
                }
                return CGPoint(x:viewport.width*(0.12+roll()*0.76),
                    y:min(bottom,max(top,row+(roll()-0.5)*spacing*0.70)))
            }
            let anchor=destination(),original=source.isEmpty ? nil:source[index%source.count]
            // All bees use the Clean Board travel and hover recipe.
            // Independent spaced regions replace circular NN destinations.
            // All flights retain the transition deadline.
            let speed=(original.map {$0.samples.last!.distance/$0.end} ?? 600)*(0.85+roll()*0.30)
            let arrival=roll()*0.38,entryDuration=0.68+roll()*0.18
            // Pick only an edge near this bee's own flight region. A lower
            // bee must never dive in from the opposite end of the screen.
            let origins=[CGPoint(x:-100,y:anchor.y),CGPoint(x:viewport.width+100,y:anchor.y),
                CGPoint(x:anchor.x,y:-100),CGPoint(x:anchor.x,y:viewport.height+100)]
            let distances=origins.map {hypot($0.x-anchor.x,$0.y-anchor.y)}
            let nearest=distances.min() ?? 0
            let nearby=origins.indices.filter {distances[$0]<=nearest+40}
            var from=origins[nearby[min(nearby.count-1,Int(roll()*Double(nearby.count)))]]
            var moves:[NativeResultForestBees.Move]=[]
            @MainActor func move(to:CGPoint,start:Double,duration:Double,enters:Bool=false,exits:Bool=false)->NativeResultForestBees.Move {
                let dx=to.x-from.x,dy=to.y-from.y
                let bend=(roll()<0.5 ? -1.0:1.0)*(35+roll()*55)
                return .init(start:start,duration:duration,from:from,to:to,
                    control1:CGPoint(x:from.x+dx*0.25+(roll()-0.5)*45,y:from.y+dy*0.25+bend),
                    control2:CGPoint(x:from.x+dx*0.75+(roll()-0.5)*45,y:from.y+dy*0.75-bend*0.65),exits:exits,enters:enters)
            }
            moves.append(move(to:anchor,start:arrival,duration:entryDuration,enters:true));from=anchor
            var time=arrival+entryDuration+(0.38+roll()*0.20)
            let exitStart=flightDuration-1.05-roll()*0.15
            for _ in 0..<5 {
                let candidate=aroundNumber ? CGPoint(x:min(viewport.width-45,max(45,anchor.x+(roll()-0.5)*200)),y:anchor.y+(roll()-0.5)*90):destination()
                let reach=aroundNumber ? 150.0:90.0
                let target=CGPoint(x:candidate.x,y:min(anchor.y+reach,max(anchor.y-reach,candidate.y)))
                let travel=max(0.28,hypot(target.x-from.x,target.y-from.y)/speed)
                guard time+travel<exitStart else {break}
                moves.append(move(to:target,start:time,duration:travel));from=target
                time += travel+(0.38+roll()*0.38)
            }
            let outside=CGPoint(x:from.x<viewport.width/2 ? -120:viewport.width+120,y:from.y+(roll()-0.5)*70)
            moves.append(move(to:outside,start:exitStart,duration:flightDuration-0.01-exitStart,exits:true))
            return NativeResultForestBees.Plan(anchor:anchor,moves:moves,phase:roll()*2 * .pi,
                scale:(original?.baseScale ?? 0.55)*(0.90+roll()*0.30),travelSpeed:speed,
                startsBehind:roll()<0.5,distantScale:0.55+roll()*0.40,lifetime:flightDuration,hoverRate:0.85+roll()*0.30,hoverStrength:2,hoverHorizontalPhase:roll()*2 * .pi)
        }
        facing=flights.map {$0.startsBehind ? 3:1}
        assets=Dictionary(uniqueKeysWithValues:(1...7).compactMap {index in images["bee\(index)"].map {(index,$0)}})
        needsNativeParityReady=source.count==4 && flights.count==6 && assets.count==7
        super.init(frame:CGRect(origin:.zero,size:viewport));isUserInteractionEnabled=false;isOpaque=false;backgroundColor = .clear
        for (layer,z) in [(behindLayer,3),(rearLayer,9),(frontLayer,11)] {layer.frame=bounds;layer.isUserInteractionEnabled=false;layer.isOpaque=false;layer.backgroundColor = .clear;layer.clipsToBounds=false;layer.layer.zPosition=CGFloat(z)}
        for index in flights.indices {
            let sprite=UIImageView();sprite.isUserInteractionEnabled=false;sprite.contentMode = .scaleAspectFit
            sprite.accessibilityIdentifier="native.transition.forest.bee.\(index)"
            frontLayer.addSubview(sprite);sprites.append(sprite)
        }
        paint(seconds:0,mountainBounds:nil)
    }
    required init?(coder:NSCoder) {fatalError("init(coder:) has not been implemented")}
    func mountLayers(in parent:UIView) {guard !disposed,needsNativeParityReady else {return};for layer in [behindLayer,rearLayer,frontLayer] {parent.addSubview(layer)}}
    func paint(seconds:Double,mountainBounds:CGRect?) {
        guard !disposed,needsNativeParityReady else {return}
        for index in flights.indices {
            let plan=flights[index],pose=plan.sample(seconds),sprite=sprites[index]
            let before=plan.sample(max(0,seconds-0.025)).point,after=plan.sample(seconds+0.025).point
            let dx=after.x-before.x,dy=after.y-before.y
            let aroundNumber=(1...numberBeeCount).contains(index)
            if pose.moving {
                facing[index]=NativeForestTransitionBeeMotion.Runtime.asset(vx:dx,vy:dy,fallback:facing[index])
            } else if abs(dx)>0.35 {facing[index]=dx>0 ? 1:3}
            sprite.image=assets[facing[index]]
            let width=NativeForestTransitionBeeMotion.beeWidth,height=width*Double(sprite.image?.size.height ?? 1)/max(1,Double(sprite.image?.size.width ?? 1))
            sprite.bounds=CGRect(x:0,y:0,width:width,height:height);sprite.center=pose.point
            let scale=plan.renderedScale(seconds)
            let bank = !pose.moving ? sin(seconds*3.2+plan.phase)*0.035:max(-0.16,min(0.16,atan2(dy,max(0.01,abs(dx)))*0.16))
            sprite.transform=CGAffineTransform(rotationAngle:bank).scaledBy(x:scale,y:scale)
            // Change depth during curved relocations, never by a free-running blink.
            let crossings=plan.moves.filter {!$0.enters && seconds >= $0.start+$0.duration*0.5}.count
            let depth=(index+crossings)%3
            let intersectsMountain=mountainBounds?.intersects(CGRect(x:pose.point.x-width*scale/2,y:pose.point.y-height*scale/2,width:width*scale,height:height*scale)) ?? false
            let target=aroundNumber ? ((index+crossings)%2==0 ? frontLayer:rearLayer):depth==2 && intersectsMountain ? behindLayer:rearLayer
            if sprite.superview !== target {target.addSubview(sprite)}
            sprite.alpha=1;sprite.isHidden=seconds<plan.moves[0].start || seconds>=duration
        }
    }

    func dispose() {guard !disposed else {return};disposed=true;for layer in [behindLayer,rearLayer,frontLayer] {layer.removeFromSuperview();layer.subviews.forEach {$0.removeFromSuperview()}};sprites.removeAll();assets.removeAll();flights.removeAll();facing.removeAll();removeFromSuperview()}
}


/// Four finite hover flights reuse transition artwork, facing and travel pace.
/// The result clock owns pause/resume; this object owns only views and route state.
@MainActor
final class NativeResultForestBees {
    static let departureTime=NativeResultPresentationPlan.cleanPrimaryCTAStart-0.02
    struct Move {
        let start,duration:Double
        let from,to,control1,control2:CGPoint
        let exits:Bool
        var enters:Bool=false
        var distance:Double {hypot(to.x-from.x,to.y-from.y)}
    }
    struct Plan {
        let anchor:CGPoint,moves:[Move],phase,scale,travelSpeed:Double
        let startsBehind:Bool
        let distantScale:Double
        var lifetime=NativeResultForestBees.departureTime
        var hoverRate=1.0
        var hoverStrength=1.0
        var hoverHorizontalPhase=0.0
        func renderedScale(_ seconds:Double)->Double {
            let progress=min(1,max(0,(seconds-moves[0].start)/(lifetime-moves[0].start)))
            let eased=progress*progress*(3-2*progress)
            return scale*(1.45+(distantScale-1.45)*eased)*(startsBehind ? 0.8:1)
        }
        func sample(_ seconds:Double)->(point:CGPoint,behind:Bool,moving:Bool) {
            var center=moves[0].from,behind=startsBehind,moving=false,envelope=seconds<moves[0].start ? 0.0:1.0
            for move in moves {
                if seconds<move.start {break}
                let p=min(1,max(0,(seconds-move.start)/move.duration))
                let eased=p*p*(3-2*p)
                let q=1-eased
                center=CGPoint(x:q*q*q*move.from.x+3*q*q*eased*move.control1.x+3*q*eased*eased*move.control2.x+eased*eased*eased*move.to.x,
                    y:q*q*q*move.from.y+3*q*q*eased*move.control1.y+3*q*eased*eased*move.control2.y+eased*eased*eased*move.to.y)
                if !move.enters && !startsBehind && move.distance>200 && p>=0.5 {behind.toggle()}
                if move.enters {envelope=p}
                if move.exits {envelope=1-p}
                if p<1 {moving=true;break}
            }
            let hoverSeconds=seconds*hoverRate
            center.x += (sin(hoverSeconds*2.9+phase+hoverHorizontalPhase)*28+sin(hoverSeconds*5.3+phase*0.7+hoverHorizontalPhase)*12)*envelope*hoverStrength
            center.y += (sin(hoverSeconds*3.7+phase)*55+sin(hoverSeconds*6.1+phase*1.3)*25)*envelope*hoverStrength
            return (center,behind,moving)
        }
    }
    /// Four independent continuous hover paths with curved relocations and exits.
    /// All randomness and shifts are captured once under the result clock.
    static func plans(viewport:CGSize,random:()->Double)->[Plan] {
        typealias Motion=NativeForestTransitionBeeMotion
        let source=Motion.make(viewport:viewport,
            digitCenters:[CGPoint(x:viewport.width*0.28,y:viewport.height*0.36),CGPoint(x:viewport.width*0.62,y:viewport.height*0.46)],
            initialDigitHeights:[120,120],random:random)
        // Broad, irregular regions rather than aligned central stations.
        let top=max(80,viewport.height*0.12),bottom=viewport.height-100
        let rows=[0.0,1.0/3,2.0/3,1.0].map {top+(bottom-top)*$0}
        func roll()->Double {let value=random();return value.isFinite ? min(1,max(0,value)):0.5}
        return (0..<4).map {index in
            let original=source[index%source.count]
            let left=index%2==0
            let anchor=CGPoint(x:viewport.width*(left ? 0.17+roll()*0.16:0.67+roll()*0.16),y:rows[index]+(roll()-0.5)*32)
            let speed=original.samples.last!.distance/original.end
            let arrival=0.08+Double(index)*0.36+roll()*0.12
            let arrivalDuration=0.68+roll()*0.18
            let origins=[CGPoint(x:-180,y:anchor.y-35),CGPoint(x:viewport.width+180,y:anchor.y+30),
                CGPoint(x:anchor.x,y:viewport.height+180),CGPoint(x:anchor.x,y:-180)]
            var time=arrival+arrivalDuration+0.38+roll()*0.20
            var from=origins[index%4],moves:[Move]=[]
            @MainActor func move(to:CGPoint,start:Double,duration:Double,exits:Bool=false)->Move {
                let dx=to.x-from.x,dy=to.y-from.y,bend=(roll()<0.5 ? -1.0:1.0)*(35+roll()*55)
                return Move(start:start,duration:duration,from:from,to:to,
                    control1:CGPoint(x:from.x+dx*0.25+(roll()-0.5)*45,y:from.y+dy*0.25+bend),
                    control2:CGPoint(x:from.x+dx*0.75+(roll()-0.5)*45,y:from.y+dy*0.75-bend*0.65),exits:exits)
            }
            var entrance=move(to:anchor,start:arrival,duration:arrivalDuration)
            entrance.enters=true;moves.append(entrance);from=anchor
            for _ in 0..<5 {
                let towardRight=from.x<viewport.width/2
                let x=towardRight ? viewport.width*(0.62+roll()*0.22):viewport.width*(0.16+roll()*0.22)
                let to=CGPoint(x:x,y:rows[index]+(roll()-0.5)*56)
                let duration=max(0.28,hypot(to.x-from.x,to.y-from.y)/speed)
                if time+duration>5.2 {break}
                moves.append(move(to:to,start:time,duration:duration))
                time += duration+0.38+roll()*0.38;from=to
            }
            let exitX=index==1 ? -160.0:viewport.width+160
            let outside=CGPoint(x:exitX,y:rows[index]+(roll()-0.5)*140)
            let exitStart=min(5.45+Double(index)*0.10,time)
            moves.append(move(to:outside,start:exitStart,duration:departureTime-0.02-exitStart,exits:true))
            let sizes=[1.00,1.05,1.16,1.08]
            let distant=[0.95,0.62,0.86,0.55]
            return Plan(anchor:anchor,moves:moves,phase:roll()*2 * .pi,scale:original.baseScale*sizes[index],travelSpeed:speed,startsBehind:index==1 || index==3,distantScale:distant[index])
        }
    }
    private var flights:[Plan]
    private var facing:[Int]=[]
    private var sprites:[UIImageView]=[]
    private var images:[Int:UIImage]=[:]
    private var disposed=false
    init(viewport:CGSize,artwork:JimiV9Artwork,random:()->Double={Double.random(in:0..<1)}) {
        flights=Self.plans(viewport:viewport,random:random)
        facing=flights.map {$0.startsBehind ? 3:1}
        for index in 1...7 {images[index]=artwork.image("assets/shop/honey/bee\(index).png",densityAware:true)}
        guard images.count==7 else {flights=[];images=[:];return}
        for index in flights.indices {
            let sprite=UIImageView();sprite.isUserInteractionEnabled=false;sprite.contentMode = .scaleAspectFit
            sprite.accessibilityIdentifier="native.result.forest.bee.\(index)"
            sprites.append(sprite)
        }
    }
    func mount(in parent:UIView) {guard !disposed else{return};for sprite in sprites {parent.addSubview(sprite)};paint(seconds:0)}
    func paint(seconds:Double) {
        guard !disposed else{return}
        if seconds>=Self.departureTime {dispose();return}
        for index in flights.indices {
            let clock=max(0,seconds)
            let flight=flights[index],pose=flight.sample(clock),sprite=sprites[index]
            let before=flight.sample(max(0,clock-0.025)).point,after=flight.sample(clock+0.025).point
            let dx=after.x-before.x,dy=after.y-before.y
            if pose.moving {
                facing[index]=NativeForestTransitionBeeMotion.Runtime.asset(vx:dx,vy:dy,fallback:facing[index])
            } else if abs(dx)>0.35 {
                // Slow hover direction changes do not flicker between wing poses.
                facing[index]=dx>0 ? 1:3
            }
            sprite.image=images[facing[index]]
            let width=NativeForestTransitionBeeMotion.beeWidth
            let height=width*Double(sprite.image?.size.height ?? 1)/max(1,Double(sprite.image?.size.width ?? 1))
            sprite.bounds=CGRect(x:0,y:0,width:width,height:height)
            sprite.center=pose.point
            let bank=pose.moving ? max(-0.16,min(0.16,atan2(dy,max(0.01,abs(dx)))*0.16)):sin(clock*3.2+flight.phase)*0.035
            let scale=flight.renderedScale(clock)
            sprite.transform=CGAffineTransform(rotationAngle:bank).scaledBy(x:scale,y:scale)
            // Only a long relocation crosses the content plane; hovering stays put.
            sprite.layer.zPosition=pose.behind ? 0.5:2
            sprite.alpha=1
            sprite.isHidden=clock<flight.moves[0].start
        }
    }
    func dispose() {
        guard !disposed else{return};disposed=true
        for sprite in sprites {sprite.image=nil;sprite.removeFromSuperview()}
        sprites=[];flights=[];facing=[];images=[:]
    }
}
