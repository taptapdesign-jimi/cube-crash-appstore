import Foundation

/// Immutable Source fx.ts construction values. JSC's three-element random-sort
/// comparison order is pinned by the original function running in JavaScriptCore.
nonisolated struct NativeSourceHUDStarPlan {
    let points:[CGPoint],delay:Double,duration:Double,size:Double,rotation:Double,textureWidth:Double
    var end:Double {delay+duration}
    var sourceDuration:Double {Self.round7(duration)}
    struct Pose {let point:CGPoint,scale:Double,rotation:Double,arrived:Bool}
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
        let size=max(22,sizes[ordinal]+(random()-0.5)*2.5)
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
    func sample(localSeconds:Double,previousScale:Double)->Pose {
        let raw=Self.round6(min(1,max(0,localSeconds/sourceDuration))),t=Self.pathProgress(raw)
        let position=t*Double(points.count-1),i=min(points.count-1,Int(floor(position)))
        let next=min(i+1,points.count-1),mix=position-Double(i)
        let point=CGPoint(x:Double(points[i].x)+(Double(points[next].x)-Double(points[i].x))*mix,y:Double(points[i].y)+(Double(points[next].y)-Double(points[i].y))*mix)
        var scale=previousScale
        if t>=0.9 && t<0.98 {
            let target=28/textureWidth,current=size/textureWidth+(target-size/textureWidth)*(t-0.9)/0.1
            if abs(previousScale-current)>0.01 {scale=current}
        }
        let rotationDuration=Self.round7(duration*0.98),q=min(1,max(0,localSeconds/rotationDuration))
        let rotated=Self.round6(rotation*(-(cos(Double.pi*q)-1)/2))
        return Pose(point:point,scale:scale,rotation:rotated,arrived:t>=0.98)
    }
}
