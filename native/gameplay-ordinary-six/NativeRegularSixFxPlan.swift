import Foundation

enum NativeRegularSixFxMath {
    static func unit(_ x:Double)->Double{min(1,max(0,x))}
    static func out(_ x:Double,_ power:Int)->Double{1-pow(1-unit(x),Double(power))}
    static func inside(_ x:Double,_ power:Int)->Double{pow(unit(x),Double(power))}
    static func backOut(_ x:Double,_ strength:Double)->Double {let t=unit(x)-1;return 1+(strength+1)*t*t*t+strength*t*t}
    static func sineOut(_ x:Double)->Double{sin(unit(x)*Double.pi/2)}
}
struct NativeRegularSixHeroMotion {
    let peak,initialScale:Double
    init(initialScale:Double=1,random:()->Double){self.initialScale=initialScale;peak=1.15+random()*0.018}
    func sample(seconds:Double)->Double {sample(seconds:seconds,startingScale:initialScale)}
    func sample(seconds:Double,startingScale:Double)->Double {
        if seconds<=0{return startingScale};if seconds<0.105{return startingScale+(peak-startingScale)*NativeRegularSixFxMath.backOut(seconds/0.105,2.5)}
        return peak+(1-peak)*NativeRegularSixFxMath.backOut((seconds-0.105)/0.17,1.9)
    }
}
struct NativeRegularSixShardPlan {
    struct Shard {
        let points:[Double],rotation,alpha,dx,dy,travelDuration,fadeDelay:Double
        func sample(seconds:Double)->(x:Double,y:Double,alpha:Double) {
            let p=NativeRegularSixFxMath.out(seconds/travelDuration,3)
            return(dx*p,dy*p,alpha*(1-NativeRegularSixFxMath.inside((seconds-fadeDelay)/0.25,3)))
        }
    }
    let shards:[Shard]
    let duration=1.0,color=0xD4A584
    init(patternIndex:Int,reduced:Bool,random:()->Double) {
        let patterns=NativeRegularShardTemplates.patterns,pattern=patterns[max(0,patternIndex)%patterns.count]
        let stride=reduced ? 2:1,visualScale=reduced ? 1.12:1.18,distanceScale=reduced ? 1.12:1.2
        var result:[Shard]=[]
        for (index,definition) in pattern.enumerated() where index%stride==0 {
            let width=(8+random()*10)*definition.size*2.4*visualScale,height=width*(0.8+random()*1.4)
            let count=4+Int(floor(random()*4));var points:[Double]=[]
            for vertex in 0..<count {let angle=Double(vertex)/Double(count)*Double.pi*2+(random()-0.5)*0.8,radius=(0.3+random()*0.7)*min(width,height)/2;points += [cos(angle)*radius,sin(angle)*radius]}
            let rotation=random()*Double.pi,angle=definition.angle*Double.pi/180,distance=definition.distance*96*2.5*distanceScale
            let bx=pow(abs(cos(angle)),0.75)*(cos(angle)<0 ? -1:1),by=pow(abs(sin(angle)),0.75)*(sin(angle)<0 ? -1:1),maximum=max(abs(bx),abs(by))
            result.append(.init(points:points,rotation:rotation,alpha:definition.alpha,dx:bx/maximum*distance,dy:by/maximum*distance,travelDuration:0.35*definition.speed,fadeDelay:0.15+0.1*random()))
        }
        shards=result
    }
}
struct NativeRegularSixSmokePlan {
    struct Puff {
        let radiusX,radiusY,rotation,scale,sx,sy,dx,dy,stagger,fadeIn,travel,hold,fadeOut,alpha:Double
        var duration:Double{stagger+fadeIn+travel+hold+fadeOut}
        func sample(seconds:Double)->(x:Double,y:Double,alpha:Double) {
            let p=NativeRegularSixFxMath.sineOut((seconds-stagger-fadeIn)/travel)
            let opacity:Double
            if seconds<stagger+fadeIn {opacity=alpha*NativeRegularSixFxMath.out((seconds-stagger)/fadeIn,3)}
            else if seconds<stagger+fadeIn+travel+hold {opacity=alpha}
            else{opacity=alpha*(1-NativeRegularSixFxMath.inside((seconds-stagger-fadeIn-travel-hold)/fadeOut,2))}
            return(sx+(dx-sx)*p,sy+(dy-sy)*p,opacity)
        }
    }
    let puffs:[Puff],haloRadius:Double
    let duration=1.0
    init(tileSize size:Double,reduced:Bool,hotFactor:Double,random:()->Double) {
        let sizeScale=reduced ? 1.25:1.36,distanceScale=reduced ? 1.08:1.2,countScale=reduced ? 0.72:0.9
        let count=max(6,Int(((44+random()*14)*1.3*countScale*hotFactor).rounded(.toNearestOrAwayFromZero)))
        let base=max(6,(size*0.051*sizeScale).rounded(.toNearestOrAwayFromZero)),maximum=max(18,(size*0.24*sizeScale).rounded(.toNearestOrAwayFromZero))
        let bursts=max(3,Int((5*hotFactor).rounded(.toNearestOrAwayFromZero))),perBurst=Int(ceil(Double(count)/Double(bursts)));var result:[Puff]=[]
        for burst in 0..<bursts {for _ in 0..<perBurst {
            var radius=base+random()*(maximum-base)
            if random()<0.2 {radius *= 1.3};if random()<0.1 {radius *= 1.1+random()*0.3}
            radius=min(radius,min(maximum*1.5,size*0.18));let ellipse=random()<0.62,aspect=ellipse ? 0.58+random()*(1.42-0.58):1,rotation=ellipse ? random()*Double.pi*2:0
            let startAngle=random()*Double.pi*2,startRadius=pow(random(),1.35)*size*0.62,travelAngle=startAngle+(random()-0.5)*1.35,travelDistance=size*(0.06+random()*0.4)*distanceScale,lateral=(random()-0.5)*size*0.16*distanceScale
            let sx=cos(startAngle)*startRadius,sy=sin(startAngle)*startRadius,tangent=travelAngle+Double.pi*0.5
            let dx=sx+cos(travelAngle)*travelDistance+cos(tangent)*lateral+(random()-0.5)*size*0.06*distanceScale
            let dy=sy+sin(travelAngle)*travelDistance+sin(tangent)*lateral+(random()-0.5)*size*0.06*distanceScale
            let fadeIn=(0.018+random()*0.022)*0.9,travel=(0.16+random()*0.12)*0.9,hold=(0.02+random()*0.03)*0.9,fadeOut=(0.08+random()*0.06)*0.9,scale=(0.65+random()*0.25)*max(0.7,sizeScale),stagger=Double(burst)*0.035+random()*0.018
            let radial=hypot(sx/max(1,size*0.5),sy/max(1,size*0.5)),center=1-min(1,radial/1.25),alpha=max(0.3,min(1,0.34+center*0.64+(random()-0.5)*0.16))
            result.append(.init(radiusX:radius,radiusY:radius*aspect,rotation:rotation,scale:scale,sx:sx,sy:sy,dx:dx,dy:dy,stagger:stagger,fadeIn:fadeIn,travel:travel,hold:hold,fadeOut:fadeOut,alpha:alpha))
        }}
        puffs=result;haloRadius=size*(0.22+0.05*1.3)
    }
    func haloAlpha(seconds:Double)->Double {
        if seconds<0.18{return 0.10*0.22*NativeRegularSixFxMath.out(seconds/0.08,3)}
        return 0.10*0.22*(1-NativeRegularSixFxMath.inside((seconds-0.18)/0.28,3))
    }
}
struct NativeRegularSixShakePlan {
    struct Point {let x,y:Double;static let zero=Point(x:0,y:0)}
    let positions:[Point],duration=0.44
    let initialCanvas,initialIndicator,initialBottomDecor:Point
    init(multiplier:Int,initialCanvas:Point = .zero,initialIndicator:Point = .zero,initialBottomDecor:Point = .zero,random:()->Double) {
        self.initialCanvas=initialCanvas;self.initialIndicator=initialIndicator;self.initialBottomDecor=initialBottomDecor
        let strength=(min(24,10+Double(max(1,multiplier))*3)*0.45).rounded(.toNearestOrAwayFromZero)
        positions=(0..<18).map{index in let p=1-Double(index)/18,amplitude=strength*p*p;return .init(x:(random()*2-1)*amplitude,y:(random()*2-1)*amplitude)}
    }
    func sample(seconds:Double)->Point {sample(seconds:seconds,points:positions,initial:initialCanvas)}
    func indicator(seconds:Double)->Point {sample(seconds:seconds,points:positions.map{Point(x:$0.x*0.8,y:$0.y*0.8)},initial:initialIndicator)}
    func bottomDecor(seconds:Double)->Point {sample(seconds:seconds,points:positions.map{Point(x:$0.x*0.8,y:max(0,$0.y*0.8))},initial:initialBottomDecor)}
    private func sample(seconds:Double,points:[Point],initial:Point)->Point {
        let dt=0.32/18
        if seconds>=0.32 {let from=points.last!,p=NativeRegularSixFxMath.out((seconds-0.32)/0.12,3);return .init(x:from.x*(1-p),y:from.y*(1-p))}
        let index=max(0,min(17,Int(floor(max(0,seconds)/dt)))),from=index==0 ? initial:points[index-1],to=points[index],p=NativeRegularSixFxMath.out((seconds-Double(index)*dt)/dt,3)
        return .init(x:from.x+(to.x-from.x)*p,y:from.y+(to.y-from.y)*p)
    }
}
/// GSAP initializes an overlapping tween on its first rendered frame. Retaining
/// that captured scale preserves the source under both 60Hz and sparse clocks.
final class NativeRegularSixMultiplierMotion {
    struct Pose {let scale,alpha,rotation:Double}
    private var capturedBackScale:Double?
    private func elasticOut(_ t:Double,period:Double)->Double {
        let p=NativeRegularSixFxMath.unit(t)
        if p==0{return 0};if p==1{return 1}
        return pow(2,-10*p)*sin((p-period/4)*Double.pi*2/period)+1
    }
    func sample(seconds:Double)->Pose {
        let t=max(0,seconds)
        let initial=0.12+(1.26-0.12)*elasticOut(t/0.18,period:0.55)
        var scale=initial
        if t>=0.12 {
            if capturedBackScale==nil {capturedBackScale=initial}
            scale=capturedBackScale!+(1-capturedBackScale!)*NativeRegularSixFxMath.backOut((t-0.12)/0.10,3)
        }
        if t>=0.42 {scale=elasticOut(1-(t-0.42)/0.22,period:0.6)}
        let alpha=t<0.42 ? NativeRegularSixFxMath.out(t/0.06,3):1-NativeRegularSixFxMath.inside((t-0.42)/0.16,2)
        let r=(t-0.12)/0.08
        let rotation:Double
        if r<=0 || r>=2 {rotation=0}
        else {let p=r<=1 ? r:2-r;rotation=0.05*(1-cos(Double.pi*p))/2}
        return .init(scale:scale,alpha:alpha,rotation:rotation)
    }
}
