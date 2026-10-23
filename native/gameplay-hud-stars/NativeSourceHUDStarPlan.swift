import Foundation

/// Immutable Source fx.ts construction values. JSC's three-element random-sort
/// comparison order is pinned by the original function running in JavaScriptCore.
nonisolated struct NativeSourceHUDStarPlan {
    let points:[CGPoint],delay:Double,duration:Double,size:Double,rotation:Double,textureWidth:Double
    var launchPower:Double=0
    var originalMotionDuration:Double=0
    var accelerationStart:Double=0
    var end:Double {delay+duration}
    var sourceDuration:Double {Self.round7(duration)}
    struct Pose {let point:CGPoint,scale:Double,rotation:Double,arrived:Bool,elapsed:Double}
    /// Normalize the authored30...56pt width plus +/-1.25pt variation.
    /// Capture before the common28pt trophy shrink; readable Native coins are1.2x.
    static func relativeCoinSize(_ width:Double,enlargement:Double=1)->Double {
        guard width.isFinite,enlargement.isFinite,enlargement>0 else{return 0}
        return min(1,max(0,(width/enlargement-28.75)/(57.25-28.75)))
    }
    static func sizeOrder(random:()->Double)->[Double] {
        var sizes:[Double]=[56,42,30]
        // Literal JSC stable insertion-sort for this exact immutable length3.
        for i in 1...2 {let value=sizes[i];var j=i
            while j>0 {let comparison=random()-0.5;if comparison>=0 {break};sizes[j]=sizes[j-1];j -= 1}
            sizes[j]=value
        }
        return sizes
    }
    static func construct(ordinal:Int,sizes:[Double],origin:CGPoint,target:CGPoint,textureWidth:Double,previousArrival:inout Double,random:()->Double)->Self {
        let angle=random()*Double.pi*2,radius=random()*5
        let start=CGPoint(x:origin.x+cos(angle)*radius,y:origin.y+sin(angle)*radius)
        let size=max(22,sizes[ordinal % sizes.count]+(random()-0.5)*2.5)
        let dx=Double(target.x-start.x),dy=Double(target.y-start.y)
        let factor=min(1,max(0.6,hypot(dx,dy)/800))
        let delay=ordinal==0 ? random()*0.015 : (ordinal==1 ? 0.055:0.125)+random()*0.03
        var duration=2.15*0.65*factor+0.06+random()*0.28+Double(ordinal)*0.06
        let required=previousArrival+0.12
        if delay+duration<required {duration += required-delay-duration}
        previousArrival=delay+duration
        let direction=random()<0.5 ? -1.0:1.0
        let amplitude=95+random()*85,frequency=0.75+random()*0.75,phase=random()*Double.pi*2
        let drift=(random()-0.5)*110,kickX=(random()-0.5)*90,kickY = -30-random()*70
        let perpendicular=atan2(dy,dx)+Double.pi/2
        let points:[CGPoint]=(0...22).map {i in
            if i==0{return start};if i==22{return target}
            let t=Double(i)/22,magnet=pow(t,1.38)
            let primary=sin(t*Double.pi*frequency+phase)*amplitude*(1-t*0.58)
            let micro=sin(t*Double.pi*(frequency*2.2)+phase*0.65)*(amplitude*0.18)*(1-t*0.8)
            let wave=(primary+micro)*direction, lane=drift*(1-t)*(1-t*0.35)
            let kick=max(0,1-t*2.4),ramp=pow(t,0.92)
            return CGPoint(x:Double(start.x)+dx*magnet+(cos(perpendicular)*(wave+lane)+kickX*kick)*ramp,
                           y:Double(start.y)+dy*magnet+(sin(perpendicular)*(wave+lane)+kickY*kick)*ramp)
        }
        let rotation=(12+random()*20)*direction*Double.pi/180
        return Self(points:points,delay:delay,duration:duration,size:size,rotation:rotation,textureWidth:textureWidth)
    }
    /// Native coin fan reuses captured randomness; Source plans stay literal.
    /// All displacement is finite and the existing job still owns HUD arrival.
    func readableCoin(ordinal:Int,previousEnd:inout Double,viewport:CGSize?=nil,gentleLaunch:Bool=false,launchInterval:Double?=nil)->Self {
        let variation=abs(sin(rotation*17.13+size*0.731+Double(ordinal)*2.399))
        let baseFlight=duration*1.25*1.30/(0.60*1.20*2*0.90)*(0.82+variation*0.36)
        let flight=baseFlight*(gentleLaunch ? 1:0.82)
        // Compact irregular pairs, captured from the existing visual variation.
        // No fixed train cadence or extra random draw/scheduler.
        let interval=launchInterval ?? flight*0.20
        let launch=ordinal == 0 ? 0:Double(ordinal/2)*interval*0.60+Double(ordinal%2)*0.028+variation*0.04
        let power=gentleLaunch ? 1.8:1.35
        let accelerationStart=flight*pow(0.8,1/power)
        // Magnetic trophy pull: smooth 1x→1.4x playback over the final20% of the path.
        let acceleratedDuration=accelerationStart+(flight-accelerationStart)/(1+0.40/3)
        previousEnd=max(previousEnd,launch+acceleratedDuration)
        var start=points[0]
        let target=points[points.count-1]
        if let viewport,viewport.width>0,viewport.height>0 {
            let margin=min(min(viewport.width,viewport.height)/2,size*1.2*0.75+2)
            start.x=min(viewport.width-margin,max(margin,start.x))
            start.y=min(viewport.height-margin,max(margin,start.y))
        }
        let dx=target.x-start.x,dy=target.y-start.y,distance=max(1,hypot(dx,dy))
        // Alternating wide lanes fan left/right while every center keeps moving
        // upward. No radial kick, shared waiting point or spring around the HUD.
        let side=ordinal.isMultiple(of:2) ? -1.0:1.0
        let lane=side*min(150,distance*0.42)*(0.70+variation*0.30)*1.20
        let bend=0.75+variation*0.50
        let burstPoints:[CGPoint]=(0...64).map {i in
            let t=Double(i)/64
            let fan=sin(.pi*pow(t,bend))*pow(1-t,0.35)
            var point=CGPoint(x:start.x+dx*t+lane*fan,y:start.y+dy*t)
            if let viewport,viewport.width>0,viewport.height>0 {
                let shrink=min(1,max(0,(t-0.7)/0.3))
                let margin=min(min(viewport.width,viewport.height)/2,(size*1.2+(28-size*1.2)*shrink)*0.75+2)
                point.x=min(viewport.width-margin,max(margin,point.x))
                point.y=min(viewport.height-margin,max(margin,point.y))
            }
            if i==64 {return target}
            return point
        }
        return Self(points:burstPoints,delay:launch,duration:acceleratedDuration,size:size*1.20,
            rotation:rotation,textureWidth:textureWidth,launchPower:power,originalMotionDuration:flight,accelerationStart:accelerationStart)
    }
    /// Bloob-only radial departure and crossing lanes, captured from the existing plan.
    /// Per-flight timing stays bounded by the existing job and canonical HUD arrival.
    static func round7(_ x:Double)->Double {(x*1e7).rounded()/1e7}
    static func round6(_ x:Double)->Double {(x*1e6).rounded()/1e6}
    static func pathProgress(_ raw:Double)->Double {
        if raw<0.18{return 0.06*pow(raw/0.18,2.4)}
        if raw<0.82{return 0.06+0.78*pow((raw-0.18)/0.64,1.55)}
        if raw<0.95{return 0.84+0.145*pow((raw-0.82)/0.13,0.68)}
        let p=(raw-0.95)/0.05;return 0.985+0.015*p*p*(3-2*p)
    }
    /// Source onUpdate retained-scale hysteresis; do not paint a freshly sampled
    /// scale on every frame. GSAP numeric-property writes round to six decimals.
    func motionSeconds(_ elapsed:Double)->Double {
        guard originalMotionDuration>0,elapsed>accelerationStart else{return elapsed}
        let tail=duration-accelerationStart
        let q=min(1,max(0,(elapsed-accelerationStart)/tail))
        return min(originalMotionDuration,accelerationStart+tail*(q+0.40*q*q*q/3))
    }
    func sample(localSeconds elapsedSeconds:Double,previousScale:Double)->Pose {
        let localSeconds=motionSeconds(elapsedSeconds)
        let sourceDuration=Self.round7(originalMotionDuration>0 ? originalMotionDuration:duration)
        let raw=Self.round6(min(1,max(0,localSeconds/sourceDuration)))
        let t:Double
        // Readable coins keep incoming speed all the way into the trophy.
        // Arrival owns retirement; no lingering ease-out or extra settling tail.
        if launchPower>0 {t=pow(raw,launchPower)}
        else {t=Self.pathProgress(raw)}
        let position=t*Double(points.count-1),i=min(points.count-1,Int(floor(position)))
        let next=min(i+1,points.count-1),mix=position-Double(i)
        let point=CGPoint(x:Double(points[i].x)+(Double(points[next].x)-Double(points[i].x))*mix,y:Double(points[i].y)+(Double(points[next].y)-Double(points[i].y))*mix)
        var scale=previousScale
        let shrinkStart=originalMotionDuration>0 ? 0.7:0.9
        if t>=shrinkStart && (t<0.98 || originalMotionDuration>0) {
            let target=28/textureWidth,current=size/textureWidth+(target-size/textureWidth)*(t-shrinkStart)/(1-shrinkStart)
            if abs(previousScale-current)>0.01 {scale=current}
        }
        let rotationDuration=Self.round7((originalMotionDuration>0 ? originalMotionDuration:duration)*0.98),q=min(1,max(0,localSeconds/rotationDuration))
        let rotated=Self.round6(rotation*(-(cos(Double.pi*q)-1)/2))
        return Pose(point:point,scale:scale,rotation:rotated,arrived:originalMotionDuration>0 ? localSeconds>=sourceDuration-0.000001:t>=0.98,elapsed:elapsedSeconds)
    }
}
