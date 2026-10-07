import UIKit

/// One stateful paint owner preserves the source's first-arrival receipt.
/// A missed frame cannot retroactively choose a different arrival alpha/scale.
enum NativeMushroomSporeMotion {
    struct Profile {let startBandProgress,birthDelay,travelRatio,riseDuration,arrivalDuration,swayAmplitudeRatio,swaySpeed,driftSpeedRatio:Double;let driftDirection:Double}
    struct Plan {let originX,originY,radius,phase,twinkleSpeed,baseAlpha,birthDelay,riseSpeed,targetY,driftDirection,driftSpeed,swayAmplitude,swaySpeed,arrivalDuration,depth:Double}
    struct Pose {let x,y,alpha,scale:Double;let visible:Bool}
    struct Runtime {
        let plan:Plan
        private(set) var arrivalStartTime:Double?,arrivalStartAlpha=0.0,arrivalStartScale=1.0,finished=false
        private var alpha=0.0,scale=0.88
        init(_ plan:Plan) {self.plan=plan}
        mutating func sample(seconds:Double,viewport:CGSize)->Pose {
            let age=seconds-plan.birthDelay
            guard age>0,!finished else {return Pose(x:plan.originX,y:plan.originY,alpha:0,scale:scale,visible:!finished)}
            let primary=sin(age*plan.swaySpeed+plan.phase)*plan.swayAmplitude
            let secondary=sin(age*plan.swaySpeed*1.83+plan.phase*0.61)*plan.swayAmplitude*0.38
            let x=max(-8,min(Double(viewport.width)+8,plan.originX+plan.driftDirection*plan.driftSpeed*age+primary+secondary))
            let risingY=plan.originY-plan.riseSpeed*age+sin(age*3.4+plan.phase)*Double(viewport.height)*0.012,y=max(plan.targetY,risingY)
            if risingY<=plan.targetY {
                if arrivalStartTime==nil {arrivalStartTime=seconds;arrivalStartAlpha=alpha;arrivalStartScale=scale}
                let p=max(0,min(1,(seconds-arrivalStartTime!)/plan.arrivalDuration)),pulse=0.22+0.78*(0.5+0.5*sin(p * .pi*4+plan.phase))
                let flash=exp(-pow((p-0.24)/0.105,2))
                alpha=max(0,min(1,(arrivalStartAlpha*(0.42+pulse*0.58)+flash*0.52)*(1-p)))
                scale=arrivalStartScale*(0.96+pulse*0.08+flash*0.34)
                if p>=1 {finished=true;alpha=0}
            } else {
                let sparkle=max(0,min(1,0.5+0.34*sin(age*plan.twinkleSpeed+plan.phase)+0.16*sin(age*plan.twinkleSpeed*1.71+plan.phase*1.37)))
                alpha=min(1,age/0.16)*plan.baseAlpha*(0.24+sparkle*0.76);scale=0.80+sparkle*0.50
            }
            return Pose(x:x,y:y,alpha:alpha,scale:scale,visible:!finished)
        }
    }
    static func makeProfiles(count:Int=72,random:()->Double)->[Profile] {
        func roll()->Double {let value=random();return value.isFinite ? min(1-Double.ulpOfOne,max(0,value)):0.5}
        func ranks()->[Int] {
            var result=Array(0..<count)
            for index in stride(from:count-1,through:1,by:-1) {result.swapAt(index,Int(roll()*Double(index+1)))}
            return result
        }
        let starts=ranks(),travels=ranks(),timeScale=5.0/7.2
        return (0..<count).map {index in
            let start=(Double(starts[index])+roll())/Double(count),travelProgress=(Double(travels[index])+roll())/Double(count),travel=0.16+travelProgress*0.60
            return Profile(startBandProgress:start,birthDelay:roll()*0.78*timeScale,travelRatio:travel,riseDuration:(1.25+travel*4.2+roll()*0.85)*timeScale,arrivalDuration:(0.20+roll()*0.82)*timeScale,swayAmplitudeRatio:0.012+roll()*0.098,swaySpeed:1.05+roll()*3.15,driftSpeedRatio:0.008+roll()*0.048,driftDirection:roll()<0.5 ? -1:1)
        }
    }
    static func make(viewport:CGSize,random:()->Double)->[Plan] {
        func roll()->Double {let value=random();return value.isFinite ? min(1-Double.ulpOfOne,max(0,value)):0.5}
        let profiles=makeProfiles(random:random),width=Double(viewport.width),height=Double(viewport.height),depths:[Double]=[140,88,68,49,30]
        return profiles.enumerated().map {index,p in
            let radius=3.2+roll()*1.28,x=width*(0.03+roll()*0.94),y=height*(0.70+p.startBandProgress*0.30),targetY=y-height*p.travelRatio
            return Plan(originX:x,originY:y,radius:radius,phase:roll() * .pi*2,twinkleSpeed:7.2+roll()*4.8,baseAlpha:0.82+roll()*0.18,birthDelay:p.birthDelay,riseSpeed:max(1,(y-targetY)/p.riseDuration),targetY:targetY,driftDirection:p.driftDirection,driftSpeed:width*p.driftSpeedRatio,swayAmplitude:width*p.swayAmplitudeRatio,swaySpeed:p.swaySpeed,arrivalDuration:p.arrivalDuration,depth:depths[index%5])
        }
    }
}
