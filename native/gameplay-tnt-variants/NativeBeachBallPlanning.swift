import Foundation

enum NativeBeachBallPlanning {
    struct Ball: Equatable {
        let assetIndex: Int
        let x,y,scale,alpha,duration: Double
        let floorY,bounceY,exitY,x1,x2,x3,rotation: Double
        var lifetime: Double { duration*1.2+0.015 }
        var oracleValues: [Double] { [Double(assetIndex),x,y,scale,alpha,duration,floorY,bounceY,exitY,x1,x2,x3,rotation] }
    }
    struct Pose { let x,y,scaleX,scaleY,rotation,alpha: Double }
    static func ball(width: Double,height: Double,random: () -> Double) -> Ball {
        let asset=Int(random()*6)+1,big=random()<0.5
        let base=big ? 55+random()*35:18+random()*25
        let size=base*(0.75+random()*0.08)
        let x=(random()-0.5)*width*1.4+width*0.5,y=height*(-0.15-random()*0.20)
        let opaque=random()<0.85,alpha=opaque ? 1:0.8+random()*0.1
        _ = 0.70+random()*0.26 // Source samples Mushroom size before its profile branch.
        let scale=(0.5+random()*0.4)*(size/80)
        _ = height*(1.1+random()*0.18) // Source common endY, overridden by Ball exit.
        let duration=1.05+random()*0.24,drift=(random()-0.5)*100
        let floor=height*(0.93+random()*0.07)
        let bounce=max(height*0.38,floor-height*(0.18+random()*0.20))
        let exit=height*(1.18+random()*0.18),direction=random()<0.5 ? -1.0:1.0
        let side=width*(0.10+random()*0.22),x1=x+drift*0.28
        let x2=x1+direction*side+(random()-0.5)*42
        let x3=x2+direction*width*(0.05+random()*0.12)+(random()-0.5)*56
        let rotation=(random()<0.5 ? -1.0:1.0)*(0.12+random()*0.16)
        return Ball(assetIndex:asset,x:x,y:y,scale:scale,alpha:alpha,duration:duration,floorY:floor,bounceY:bounce,exitY:exit,x1:x1,x2:x2,x3:x3,rotation:rotation)
    }
    static func pose(_ plan: Ball,time: Double) -> Pose {
        func clamped(_ x:Double)->Double { min(1,max(0,x)) }
        func powerIn(_ p:Double)->Double { pow(clamped(p),3) }
        func powerOut(_ p:Double)->Double { 1-pow(1-clamped(p),3) }
        func backOut(_ p:Double,_ strength:Double)->Double { let t=clamped(p)-1;return 1+t*t*((strength+1)*t+strength) }
        func mix(_ a:Double,_ b:Double,_ p:Double)->Double { a+(b-a)*p }
        let fall=plan.duration*0.52,bounceStart=fall+0.015,bounceEnd=bounceStart+plan.duration*0.26
        var x=plan.x,y=plan.y,rotation=0.0
        if time<fall { let p=powerIn(time/fall);x=mix(plan.x,plan.x1,p);y=mix(plan.y,plan.floorY,p) }
        else if time<bounceStart { x=plan.x1;y=plan.floorY }
        else if time<bounceEnd { let p=powerOut((time-bounceStart)/(plan.duration*0.26));x=mix(plan.x1,plan.x2,p);y=mix(plan.floorY,plan.bounceY,p);rotation=mix(plan.rotation,plan.rotation * -0.55,p) }
        else { let p=powerIn((time-bounceEnd)/(plan.duration*0.42));x=mix(plan.x2,plan.x3,p);y=mix(plan.bounceY,plan.exitY,p);rotation=mix(plan.rotation * -0.55,plan.rotation * -1.25,p) }
        if time<bounceStart { rotation=plan.rotation*powerOut((time-0.01)/0.045) }
        // Source GSAP '<+=.01' is relative to the fall tween's START.
        // Preserve its actual authored playhead rather than retiming by prose.
        var sx=1.0,sy=1.0
        if time<fall { let p=powerOut((time-0.01)/0.035);sx=mix(1,1.26,p);sy=mix(1,0.70,p) }
        else if time<fall+0.035 { let p=backOut((time-fall)/0.055,2.1);sx=mix(1.26,0.84,p);sy=mix(0.70,1.18,p) }
        else {
            let startP=backOut(0.035/0.055,2.1),p=backOut((time-fall-0.035)/0.09,1.7)
            sx=mix(mix(1.26,0.84,startP),1,p);sy=mix(mix(0.70,1.18,startP),1,p)
        }
        return Pose(x:x,y:y,scaleX:plan.scale*sx,scaleY:plan.scale*sy,rotation:rotation,alpha:time>=plan.lifetime ? 0:plan.alpha)
    }
}
