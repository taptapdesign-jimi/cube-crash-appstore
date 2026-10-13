import UIKit

/// Original default text-bolts.ts SWOOP field. The enclosing finite caption
/// owns retirement; individual electric timelines retain their authored repeat.
struct NativeMagnetBoltMotion {
    struct Pose { let point:CGPoint,scale:CGFloat,alpha:CGFloat,rotation:CGFloat }
    struct Plan {
        let assetIndex:Int,birth:CGPoint,size:CGFloat,delay:TimeInterval,repeatDelay:TimeInterval
        let durations:[TimeInterval],poses:[Pose]
        var cycleDuration:TimeInterval {durations.reduce(0,+)}
        func sample(seconds:TimeInterval)->Pose {
            func precise(_ value:Double)->Double {floor(value*10_000_000+0.5)/10_000_000}
            let local=precise(seconds-precise(delay))
            guard local>=0 else{return absolute(poses[0])}
            let period=cycleDuration+repeatDelay
            let quotient=precise(local/period)
            // GSAP owns an exact repeat seam as the preceding terminal frame,
            // rather than resetting the electric flash one callback too early.
            let seam=quotient>0 && quotient==floor(quotient)
            let time=seam ? cycleDuration:precise(local.truncatingRemainder(dividingBy:period))
            guard time<cycleDuration else{return absolute(poses[4])}
            var start=0.0
            for index in durations.indices {
                let end=start+durations[index]
                if time<end {
                    let raw=CGFloat((time-start)/durations[index])
                    let p:CGFloat=index==0 ? 1-pow(1-raw,3):index==3 ? raw*raw*raw:raw
                    let a=rounded(poses[index]),b=poses[index+1]
                    return absolute(Pose(point:.init(x:a.point.x+(b.point.x-a.point.x)*p,y:a.point.y+(b.point.y-a.point.y)*p),
                        scale:a.scale+(b.scale-a.scale)*p,alpha:a.alpha+(b.alpha-a.alpha)*p,rotation:a.rotation+(b.rotation-a.rotation)*p),roundRotation:index>0 && p<1)
                }
                start=end
            }
            return absolute(poses[4])
        }
        private func rounded(_ pose:Pose)->Pose {
            func css(_ value:CGFloat)->CGFloat {floor(value*10_000+0.5)/10_000}
            return Pose(point:.init(x:css(pose.point.x),y:css(pose.point.y)),scale:css(pose.scale),alpha:css(pose.alpha),rotation:pose.rotation)
        }
        private func absolute(_ pose:Pose,roundRotation:Bool=false)->Pose {let value=rounded(pose);return Pose(point:.init(x:birth.x+value.point.x,y:birth.y+value.point.y),scale:value.scale,alpha:value.alpha,rotation:roundRotation ? floor(value.rotation*10_000+0.5)/10_000:value.rotation)}
    }
    static func make(viewport:CGSize,random:()->Double={Double.random(in:0..<1)})->[Plan] {
        func roll()->CGFloat {CGFloat(min(1-Double.ulpOfOne,max(0,random())))}
        func css(_ value:CGFloat)->CGFloat {floor(value*10_000+0.5)/10_000}
        func precise(_ value:Double)->Double {floor(value*10_000_000+0.5)/10_000_000}
        let w=max(320,viewport.width),h=max(520,viewport.height)
        return (0..<16).map {index in
            let ring=index%3,radius=w*(ring==0 ? 0.24:ring==1 ? 0.36:0.5)
            let angle=CGFloat(index)/16*2 * .pi+(roll()-0.5)*0.75,jitter=0.82+roll()*0.42
            _=18+roll()*88;_=((roll()-0.5)*190) // Unused original Bee-only draws remain in order.
            let x=w/2+cos(angle)*radius*jitter+(roll()-0.5)*60
            let y=h/2+sin(angle)*radius*0.62*jitter+(roll()-0.5)*46
            let size=index%5==0 ? 110+roll()*52:64+roll()*40
            let dx=x-w/2,dy=y-h/2,length=max(1,hypot(dx,dy))
            let sign:CGFloat=(index%2==0 ? -1:1)*(roll()<0.5 ? 1:-1)
            let move=54+roll()*90,split=(22+roll()*34)*sign
            let driftX=dx/length*move+split+(roll()-0.5)*14
            let driftY=dy/length*move*0.78+(roll()-0.5)*11
            let jitterX=(4+roll()*8)*1.3,jitterY=(3+roll()*7)*1.3
            let scale=0.72+roll()*0.55,rotation=(roll()-0.5)*52
            let rotationA=(roll()-0.5)*20*1.3,rotationB=(roll()-0.5)*22*1.3,rotationDrift=(roll()-0.5)*28
            let alpha=0.55+roll()*0.35
            let delay=Double(CGFloat(index)*0.04+roll()*0.2),repeatDelay=Double(0.08+roll()*0.25)
            let scaleA=scale*(1+roll()*0.15),durationA=Double(0.09+roll()*0.05)
            let xB=css(driftX*0.35)+(roll()<0.5 ? -1:1)*jitterX
            let yB=css(driftY*0.35)+(roll()<0.5 ? -1:1)*jitterY
            let alphaB=alpha*(0.6+roll()*0.3),durationB=Double(0.05+roll()*0.05)
            let xC=css(xB)+(roll()<0.5 ? -1:1)*jitterX*0.8
            let yC=css(yB)+(roll()<0.5 ? -1:1)*jitterY*0.8
            let alphaC=alpha*(0.45+roll()*0.25),durationC=Double(0.04+roll()*0.04),durationD=Double(0.12+roll()*0.08)
            let poses=[Pose(point:.zero,scale:0.2,alpha:0,rotation:rotation),
                Pose(point:.init(x:driftX*0.35,y:driftY*0.35),scale:scaleA,alpha:alpha,rotation:rotation),
                Pose(point:.init(x:xB,y:yB),scale:scaleA,alpha:alphaB,rotation:rotation+rotationA),
                Pose(point:.init(x:xC,y:yC),scale:scaleA,alpha:alphaC,rotation:rotation+rotationA-rotationB),
                Pose(point:.init(x:driftX,y:driftY),scale:scale*0.65,alpha:0,rotation:rotation+rotationDrift)]
            return Plan(assetIndex:index%8+1,birth:.init(x:floor(x+0.5),y:floor(y+0.5)),size:floor(size+0.5),
                delay:delay,repeatDelay:repeatDelay,durations:[durationA,durationB,durationC,durationD].map(precise),poses:poses)
        }
    }
}
