import Foundation

/// Wrapper drift and image bounce are separate authored tracks, as in the source.
enum NativeTransitionCloudPlan {
    struct Cloud {
        let asset:Int,depth:Int
        let width,height,xPercent,yPercent,baseScale,rotation,bounceAmount,bounceSpeed,windDuration,driftDistance,initialY,enterDelay:Double
        struct Pose {let wrapperX,imageY,scaleX,scaleY,opacity:Double}
        func sample(seconds:Double,exitAt:Double?=nil)->Pose {
            func clamp(_ p:Double)->Double{min(1,max(0,p))}
            let t=max(0,seconds),drift=driftDistance*clamp((t-enterDelay-0.24)/windDuration)
            let bounceAge=max(0,t-enterDelay-0.5),bounceP=bounceAge.truncatingRemainder(dividingBy:bounceSpeed)/bounceSpeed
            let bounce=bounceP<0.5 ? sin(bounceP*Double.pi)*bounceAmount:cos((bounceP-0.5)*Double.pi)*bounceAmount
            let y=initialY+bounce
            func enter(_ time:Double)->(scale:Double,opacity:Double) {
                let age=time-enterDelay
                if age<0{return (0.12,0)}
                if age<0.34 {let p=NativeBoardTransitionPlan.backOut(age/0.34,2.2);return (0.12+(baseScale*1.22-0.12)*p,clamp(p))}
                let p=NativeBoardTransitionPlan.powerOut((age-0.34)/0.14,2);return (baseScale*1.22-baseScale*0.22*p,1)
            }
            let visible=enter(t)
            guard let exitAt,t>=exitAt else{return Pose(wrapperX:drift,imageY:y,scaleX:visible.scale,scaleY:visible.scale,opacity:visible.opacity)}
            let age=t-exitAt,entry=enter(exitAt).scale
            if age<0.07 {let p=NativeBoardTransitionPlan.powerIn(age/0.07,2);return Pose(wrapperX:drift,imageY:y,scaleX:entry+(0.94-entry)*p,scaleY:entry+(1.07-entry)*p,opacity:1)}
            if age<0.135 {let p=NativeBoardTransitionPlan.backOut((age-0.07)/0.065,2.2);return Pose(wrapperX:drift,imageY:y,scaleX:0.94+0.14*p,scaleY:1.07-0.14*p,opacity:1)}
            let p=clamp((age-0.135)/0.46),e=p==1 ? 1:p*p*((1.85+1)*p-1.85)
            // Source image remains opaque while shrinking; cleanup retires it.
            return Pose(wrapperX:drift,imageY:y,scaleX:1.08*(1-e),scaleY:0.93*(1-e),opacity:p==1 ? 0:1)
        }
    }
    static let assets=["./assets/board transition/oblak+srednji.png","./assets/board transition/oblak mali desno.png","./assets/board transition/oblak mali ljevo.png","./assets/board transition/oblak veliki ljevo dole.png"]
    static func make(theme:NativeBoardTransitionPlan.Theme,width:Double,random:()->Double)->[Cloud] {
        let baseTops=[15.0,46,24,55,21,52,43,49],slots:[(Double,Double)]=[(4,2),(52,7),(96,1),(12,22),(55,32),(90,39)]
        let count=theme == .beach ? 6:8,vw=max(320,width),base=min(240,max(104,vw*0.24)),step=max(18,base*0.16)
        var result:[Cloud]=[]
        for i in 0..<count {
            let randomizedTop=(theme == .beach ? slots[i].1:baseTops[i])+(random()*2-1)*(i>=count-2 ? 7:11)
            let beachTop=slots[i%6].1+(random()*2-1)*1.25
            let top=theme == .beach ? min(40,max(0,beachTop)):min(62,max(9,randomizedTop))
            let lower=i>=count-2,behind = !lower && top<32
            var boost=0.9+random()*0.35
            if lower {boost=1.02+random()*0.42}
            else if top<32 && random()<0.55 {boost=1.12+random()*0.5}
            else if top>=32 && top<64 && random()<0.4 {boost=0.98+random()*0.44}
            let size=((base+Double(i%3)*step)*boost*(theme == .beach ? 0.84:1)).rounded(),height=(size/1.15).rounded()
            let baseScale=lower ? 0.98+random()*0.26:(0.82+random()*0.36)*min(1.28,0.94+boost*0.16)
            let bandCenter=8+Double(i)/Double(max(1,count-1))*84,jitter=(random()*2-1)*(lower ? 18:24)
            let beachLeft=slots[i%6].0+(random()*2-1)*1.5,left=theme == .beach ? min(98,max(2,beachLeft)):min(96,max(4,bandCenter+jitter))
            let goesLeft=random()<0.5,delay=Double(i)*0.06,rotation=Double(i%5-2)*6
            let bounce=6+Double(i%3)*3,bounceSpeed=0.45+Double(i%4)*0.08,wind=9*(1+(random()*2-1)*0.18)
            let center=vw*left/100,distanceToSide=goesLeft ? center:max(0,vw-center)
            let distance=(distanceToSide+vw+size)*(goesLeft ? -1:1)
            let y=(lower ? -40.0:0)+(random()*2-1)*(lower ? 18:28)
            // Lower clouds live inside scene z15; other hosts are overlay z1/2/5.
            let depth=theme == .beach ? 1:behind ? 2:lower ? 415:i%3==1 ? 5:1
            result.append(Cloud(asset:i%4,depth:depth,width:size,height:height,xPercent:left,yPercent:top,baseScale:baseScale,rotation:rotation,bounceAmount:bounce,bounceSpeed:bounceSpeed,windDuration:wind,driftDistance:distance,initialY:y,enterDelay:delay))
        }
        return result
    }
}
