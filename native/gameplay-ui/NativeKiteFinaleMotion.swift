import Foundation

/// One bounded, captured wind field per carrier; no per-frame randomness.
struct NativeKiteWindPlan {
    let horizontal:Double,vertical:Double,phaseX:Double,phaseY:Double,rateX:Double,rateY:Double
    init(random:()->Double) {
        func draw()->Double {let x=random();return x.isFinite ? min(1,max(0,x)):0.5}
        horizontal=90+210*draw();vertical=70+130*draw()
        phaseX=draw()*2 * .pi;phaseY=draw()*2 * .pi
        rateX=0.85+0.45*draw();rateY=0.95+0.5*draw()
    }
    func offset(seconds:Double)->NativeBeeFinaleMotion.Point {
        let t=max(0,seconds),p=min(1,t/0.65),fade=p*p*(3-2*p)
        return .init(x:(sin(t*rateX+phaseX)-sin(phaseX))*horizontal*0.5*fade,
                     y:(sin(t*rateY+phaseY)-sin(phaseY))*vertical*0.5*fade)
    }
}

/// Captured once per kite; sampling never draws random values or starts work.
struct NativeKiteDeparturePlan {
    enum Role:Int {case lower,hero,upper}
    enum Style:Int {case swoop,sCurve,hook}
    let style:Style
    let role:Role,start:Double,duration:Double,floatDuration:Double,rise:Double
    let phase:Double,drift:Double,tempo:Double,bankAmount:Double,padding:Double
    var finish:Double {start+floatDuration+duration}
    init(role:Role,style:Style?=nil,startOverride:Double?=nil,random:()->Double) {
        func draw()->Double {let x=random();return x.isFinite ? min(1,max(0,x)):0.5}
        self.role=role
        let capturedStart:Double
        switch role {
        case .lower:capturedStart=2.12+0.12*draw();duration=1.24+0.16*draw();floatDuration=0.24+0.11*draw();rise=100+25*draw()
        case .hero:capturedStart=2.65+0.10*draw();duration=1.05+0.13*draw();floatDuration=0.17+0.08*draw();rise=120+25*draw()
        case .upper:capturedStart=3.15+0.12*draw();duration=0.88+0.12*draw();floatDuration=0.10+0.07*draw();rise=95+25*draw()
        }
        start=startOverride ?? capturedStart
        phase=draw()*2 * .pi
        self.style=style ?? Style(rawValue:min(2,Int(phase/(2 * .pi)*3)))!
        drift=18+24*draw()
        tempo=0.88+0.28*draw()+Double(role.rawValue)*0.13
        bankAmount=5+5*draw();padding=40*draw()
    }
    private func smooth(_ x:Double)->Double {let p=min(1,max(0,x));return p*p*(3-2*p)}
    func point(origin:NativeBeeFinaleMotion.Point,targetX:Double,elapsed:Double,velocity:NativeBeeFinaleMotion.Point = .init(x:0,y:0))->NativeBeeFinaleMotion.Point {
        let total=floatDuration+duration,p=min(1,max(0,elapsed/total))
        let ease=smooth(pow(p,tempo)),envelope=pow(sin(.pi*p),2)
        // Match the incoming wind velocity; there is no float hold or second launch.
        let tangent=p*(1-p)*(1-p)*total
        let bend:Double,lift:Double
        switch style {
        case .swoop:bend=drift*sin(2 * .pi*p+phase)*envelope;lift=18*sin(.pi*p)*envelope
        case .sCurve:bend=drift*sin(3 * .pi*p+phase)*envelope;lift = -14*sin(2 * .pi*p)*envelope
        case .hook:bend = -drift*envelope+drift*0.4*sin(3 * .pi*p+phase)*envelope;lift = -22*sin(.pi*p)*envelope
        }
        return .init(x:origin.x+(targetX-origin.x)*ease+velocity.x*tangent+bend,
                     y:max(origin.y-NativeKiteFinaleMotion.maximumExitRise,origin.y-rise*ease+velocity.y*tangent+lift))
    }
    func bank(initial:Double,elapsed:Double)->Double {
        let p=min(1,max(0,elapsed)),direction=initial<0 ? -1.0:1.0
        let turn=min(1,p/0.65),ease=turn*turn*(3-2*turn)
        let rebound=2.5*sin(3 * .pi*p)*pow(sin(.pi*p),2)
        return direction*min(20,max(3,abs(initial)+(19-abs(initial))*ease+rebound))
    }
    func stretch(elapsed:Double)->(x:Double,y:Double) {
        guard elapsed>0,elapsed<1 else{return (1,1)}
        let envelope=pow(sin(.pi*elapsed),2)
        let strength=role == .hero ? 0.085:0.14
        let x=1+strength*sin(3 * .pi*elapsed)*envelope
        return (x,1/x)
    }

}


/// Compact wind-tension glide on the existing finite finale clock. Upper births
/// dip then turn back up; lower births rise. Captured facing owns side departure.
struct NativeKiteFinaleMotion {
    static let heroSize=390.0,flightDuration=4.7
    private let route:NativeBeeFinaleMotion
    let departure:NativeKiteDeparturePlan
    let wind:NativeKiteWindPlan
    let verticalDirection:Double
    private var departureAnchor=NativeBeeFinaleMotion.Point(x:0,y:0),departureVelocity=NativeBeeFinaleMotion.Point(x:0,y:0)
    init(route:NativeBeeFinaleMotion,random:()->Double={0.5}) {
        self.route=route;departure=NativeKiteDeparturePlan(role:.hero,random:random);wind=NativeKiteWindPlan(random:random)
        verticalDirection=random()<0.5 ? -1:1
        departureAnchor=hoverPosition(departure.start)
        let a=hoverPosition(departure.start-0.001),b=hoverPosition(departure.start+0.001)
        departureVelocity = .init(x:(b.x-a.x)/0.002,y:(b.y-a.y)/0.002)
    }
    private func smooth(_ value:Double)->Double {let p=min(1,max(0,value));return p*p*(3-2*p)}
    private func mix(_ a:Double,_ b:Double,_ p:Double)->Double {a+(b-a)*p}
    private var anchorX:Double {
        let inset=min(Self.heroSize*0.5+26,route.width*0.5)
        return min(route.width-inset,max(inset,route.origin.x))
    }
    private func hoverPosition(_ seconds:Double)->NativeBeeFinaleMotion.Point {
        let t=max(0,seconds),origin=route.origin
        let source=NativeKiteArt.translate.sample(NativeKiteArt.sourceTime(seconds:t)) ?? [0,0]
        let wind=smooth(t/0.45),settle=1-pow(1-min(1,t/0.85),3)
        // Broad, slow wind sway; no short attacks or gust impulses.
        let drift=self.wind.offset(seconds:t)
        let x=mix(origin.x,anchorX,settle)+drift.x+source[0]*0.035*wind
        // Cross the central 70% of the viewport with one broad turn, then
        // preserve the sampled tangent when the existing exit takes ownership.
        let first=route.height*(verticalDirection>0 ? 0.85:0.15)
        let last=route.height-first
        let turn=1.1
        let y=t<=turn ? mix(origin.y,first,smooth(t/turn))
            : mix(first,last,smooth((t-turn)/(departure.start-turn)))
        return .init(x:x,y:y+source[1]*0.025*wind)

    }
    var facing:Int {route.seed.truncatingRemainder(dividingBy:2 * .pi) < .pi ? 1:-1}
    private var departureSide:Double {Double(facing)}
    static let entryRiseDuration=0.225,maximumExitRise=150.0
    private static let scaleSettling:[(Double,Double)]=[(0,1.4),(0.155,0.86),(0.285,1.07),(0.415,0.97),(0.585,1)]
    private static let stretchSettling:[(Double,Double)]=[(0,0.86),(0.11,0.82),(0.225,1.18),(0.38,0.9),(0.51,1.06),(0.64,0.98),(0.81,1)]
    private static func sampleCurve(_ stops:[(Double,Double)],time:Double)->Double {
        for index in 1..<stops.count where time<=stops[index].0 {
            let a=stops[index-1],b=stops[index],p=min(1,max(0,(time-a.0)/(b.0-a.0)))
            return a.1+(b.1-a.1)*p*p*(3-2*p)
        }
        return 1
    }
    static func entranceScale(seconds:Double,rise:Double=entryRiseDuration)->Double {
        let t=max(0,seconds)
        if t<=rise {let p=t/rise;return 0.35+1.05*p*p*(3-2*p)}
        return sampleCurve(scaleSettling,time:t-rise)
    }
    private func position(_ seconds:Double)->NativeBeeFinaleMotion.Point {
        let t=max(0,seconds)
        guard t>departure.start else{return hoverPosition(t)}
        let start=departureAnchor
        let exitX=departureSide<0 ? -Self.heroSize*0.9-departure.padding:route.width+Self.heroSize*0.9+departure.padding
        return departure.point(origin:start,targetX:exitX,elapsed:t-departure.start,velocity:departureVelocity)

    }
    func sample(seconds:Double)->NativeBeeFinaleMotion.Pose {
        let t=min(Self.flightDuration,max(0,seconds)),point=position(t)
        let a=position(max(0,t-0.01)),b=position(min(Self.flightDuration,t+0.01))
        let vx=(b.x-a.x)/0.02,vy=(b.y-a.y)/0.02
        let svgBank=NativeKiteArt.rotation.sample(NativeKiteArt.sourceTime(seconds:t))?.first ?? 0
        let windBank=(vx*0.018+svgBank*0.08)*smooth(t/0.45)
        let originSide=departureSide
        let exitBank = originSide * 15
        let bank=t>departure.start
            ? departure.bank(initial:exitBank,elapsed:t-departure.start)
            : min(15,max(-15,mix(originSide*min(15,max(4,abs(windBank))),exitBank,smooth((t-(departure.start-0.45))/0.45))))
        let scale=Self.entranceScale(seconds:t)
        return .init(point:point,vx:vx,vy:vy,rotation:bank,scale:scale,facing:facing,phase:t<departure.start ? "kite-wind-glide":"kite-side-exit")
    }
    /// Finite area-preserving fabric recoil, followed by the existing quiet sway.
    static func fabricStretch(seconds:Double)->(x:Double,y:Double) {
        let t=max(0,seconds)
        let spring=Self.sampleCurve(Self.stretchSettling,time:t)
        let p=min(1,t/0.45)
        let amount=(sin(t*2.2)*0.008+sin(t*1.1)*0.006)*p*p*(3-2*p)
        let x=spring*(1+amount)
        return (x,1/x)
    }
    func stretch(seconds:Double)->(x:Double,y:Double) {
        let base=Self.fabricStretch(seconds:seconds),exit=departure.stretch(elapsed:seconds-departure.start)
        return (base.x*exit.x,base.y*exit.y)
    }
    func formationSample(seconds:Double)->NativeBeeFinaleMotion.Pose {
        var pose=sample(seconds:min(seconds,departure.start));pose.point=hoverPosition(seconds);return pose
    }
    static func flagOrigin(pose:NativeBeeFinaleMotion.Pose,size:Double,stretch:(x:Double,y:Double))->NativeBeeFinaleMotion.Point {
        let y=size*0.34*pose.scale*stretch.y,angle=pose.rotation * .pi/180
        return .init(x:pose.point.x-sin(angle)*y,y:pose.point.y+cos(angle)*y)
    }


}


/// Fixed upper/lower formation slots with gentle wind sway on the finite clock.
/// Distances are measured between carrier centers in logical viewport pixels.
struct NativeKiteBackgroundPlan {
    static let size=288.0,delay=0.45,flightDuration=NativeKiteFinaleMotion.flightDuration
    let main:NativeKiteFinaleMotion,width:Double,height:Double,flagCount:Int,index:Int
    private let phase:Double
    let departure:NativeKiteDeparturePlan
    let direction:Int
    // Original kite2.svg points left (tail right). Mirroring makes it point right.
    var facing:Int {-direction}
    let wind:NativeKiteWindPlan
    private var departureOrigin:NativeBeeFinaleMotion.Pose?
    private var departureVelocity=NativeBeeFinaleMotion.Point(x:0,y:0)
    var avoidanceMoveCount:Int {0}
    var size:Double {index==0 ? 228:288}
    var delay:Double {Self.delay+Double(index)*0.2}
    var side:Double {Double(direction)}
    // Only the edge assignment is paired; each carrier still captures its own
    // wind, phase and staggered departure rather than reflecting a shared path.
    static func makePair(main:NativeKiteFinaleMotion,width:Double,height:Double,flagCount:Int,random:()->Double)->[Self] {
        let first=Self(main:main,width:width,height:height,flagCount:flagCount,index:0,random:random)
        let second=Self(main:main,width:width,height:height,flagCount:flagCount,index:1,direction:-first.direction,random:random)
        return [first,second]
    }
    init(main:NativeKiteFinaleMotion,width:Double,height:Double,flagCount:Int,index:Int=0,direction:Int?=nil,random:()->Double={0.5}) {
        self.main=main;self.width=width;self.height=height;self.flagCount=flagCount;self.index=index
        let draw=random(),unit=draw.isFinite ? min(1,max(0,draw)):0.5
        phase=unit*0.12;self.direction=direction ?? (unit<0.5 ? -1:1)
        let style=NativeKiteDeparturePlan.Style(rawValue:(main.departure.style.rawValue+(index==0 ? 1:2))%3)!
        let timing=random(),interval=timing.isFinite ? min(1,max(0,timing)):0.5
        let lastStart=index==0 ? main.departure.start+0.4+0.1*interval:nil
        departure=NativeKiteDeparturePlan(role:index==1 ? .lower:.upper,style:style,startOverride:lastStart,random:random)
        wind=NativeKiteWindPlan(random:random)
        departureOrigin=formation(departure.start)
        let a=formation(departure.start-0.001),b=formation(departure.start+0.001)
        departureVelocity = .init(x:(b.point.x-a.point.x)/0.002,y:(b.point.y-a.point.y)/0.002)
    }
    private func smooth(_ value:Double)->Double {let p=min(1,max(0,value));return p*p*(3-2*p)}
    private func formation(_ t:Double)->NativeBeeFinaleMotion.Pose {
        let carrier=main.formationSample(seconds:t)
        var pose=carrier
        let sign=index==0 ? -1.0:1.0,angle=max(0,t-delay)*Double.pi/1.8+phase
        let arrival=smooth((t-delay)/1.15)
        let drift=wind.offset(seconds:max(0,t-delay))
        let gap=(index==0 ? 150.0:280.0)+drift.y*drift.y/200
        // Soft bounds retain continuous wind motion without drifting out of frame.
        // Reserve room for the artwork, entrance overshoot and fabric stretch.
        let inset=min(size*0.56,min(width,height)*0.46)
        func contained(_ value:Double,extent:Double)->Double {
            let half=max(1,extent*0.5-inset)
            return extent*0.5+half*tanh((value-extent*0.5)/half)
        }
        let targetY=contained(carrier.point.y+sign*gap,extent:height)
        let rawX=index==0 ? width*0.5+side*(45+sqrt(drift.x*drift.x+16)-4):width*0.5+drift.x
        let targetX=contained(rawX,extent:width)
        if index==0 {
            // Rightward flight enters from left middle; leftward flight enters from right.
            let birthX=side>0 ? -size*0.55:width+size*0.55
            pose.point.x=birthX*(1-arrival)+targetX*arrival
            pose.point.y=height*0.5*(1-arrival)+targetY*arrival
        }else {
            let birthY=max(height+size*0.7,targetY)
            pose.point.x=targetX;pose.point.y=birthY*(1-arrival)+targetY*arrival
        }
        pose.rotation=side*(5+sin(angle)*1.5)
        pose.scale=NativeKiteFinaleMotion.entranceScale(seconds:t-delay,rise:0.275)
        pose.facing=facing
        return pose
    }
    func sample(seconds:Double)->NativeBeeFinaleMotion.Pose {
        let t=min(Self.flightDuration,max(0,seconds))
        let start=departure.start
        if t<=start {return formation(t)}
        var pose=departureOrigin!
        let targetX=side<0 ? -size*0.75-departure.padding:width+size*0.75+departure.padding
        pose.point=departure.point(origin:pose.point,targetX:targetX,elapsed:t-start,velocity:departureVelocity)
        pose.rotation=departure.bank(initial:pose.rotation,elapsed:t-start)
        pose.phase="kite-corner-exit"
        return pose
    }
    func stretch(seconds:Double)->(x:Double,y:Double) {
        let base=NativeKiteFinaleMotion.fabricStretch(seconds:seconds-delay),exit=departure.stretch(elapsed:seconds-departure.start)
        return (base.x*exit.x,base.y*exit.y)
    }
    func point(seconds:Double)->NativeBeeFinaleMotion.Point {sample(seconds:seconds).point}
}

/// Original leaf fall recipe retained for Kite flags emitted at the lower edge.
struct NativeKiteFlagMotion {
    static func make(from base:NativeBeeLeafMotion,origin:NativeBeeFinaleMotion.Point,viewportHeight:Double)->NativeBeeLeafMotion {
        .init(birth:base.birth,lifetime:base.lifetime,birthX:origin.x,birthY:origin.y,velocityX:base.velocityX,velocityY:base.velocityY,
            gravity:NativeBeeLeafMotion.gravity(viewportHeight:viewportHeight,birthY:origin.y,velocityY:base.velocityY,lifetime:base.lifetime),
            flutter:base.flutter,spin:base.spin,scale:base.scale,peakOpacity:base.peakOpacity)
    }
}
