import UIKit

/// Exact mixed center/edge planner used by New Reward; original source options
/// are fixed here so generic World/board puffs cannot replace this composition.
struct NativeRewardSmokePlan {
    struct Particle {
        let radiusX:Double,radiusY:Double,alpha:Double,rotation:Double
        let startX:Double,startY:Double,endX:Double,endY:Double,scale:Double
        let delay:Double,fadeIn:Double,run:Double,hold:Double,fadeOut:Double
        var oracleValues:[Double] {[radiusX,radiusY,alpha,rotation,startX,startY,endX,endY,scale,delay,fadeIn,run,hold,fadeOut]}
    }
    let particles:[Particle],width:Double,height:Double,haloWidth:Double,haloHeight:Double
    init(width:Double,height:Double,random:()->Double) {
        let size=max(width,height),padding=size*0.4,cw=width+padding*2,ch=height+padding*2
        self.width=cw;self.height=ch
        let count=max(4,Int(((24+random()*8)*1.08*1.72).rounded())),perBurst=Int(ceil(Double(count)/4))
        let base=max(6,(size*0.051*0.98).rounded()),maximum=max(18,(size*0.24*0.98).rounded()),inset=size*0.02,maxRadius=min(maximum*1.5,size*0.18)
        var result:[Particle]=[]
        let allowed=[0,1,2,3,4,4,4]
        for burst in 0..<4 {for _ in 0..<perBurst {
            let side=allowed[min(6,Int(random()*7))],center=side==4
            var radius=base+random()*(maximum-base)
            let roll=random()
            if center {radius *= roll<0.46 ? 0.86+random()*0.34 : 0.52+random()*0.28}
            else if roll<0.68 {radius *= 0.34+random()*0.28}
            else if roll<0.92 {radius *= 0.58+random()*0.34}
            else {radius *= 0.98+random()*0.28}
            radius=min(radius,maxRadius)
            let ellipse=random()>0.5,aspect=ellipse ? 0.6+random()*0.8 : 1
            let alpha=0.94*(center ? 0.34+random()*0.36 : 0.46+random()*0.42)
            let rotation=ellipse ? random()*360 : 0
            let alongX=random()*(width-inset*2)-(width/2-inset),alongY=random()*(height-inset*2)-(height/2-inset)
            let sx:Double,sy:Double
            switch side {
            case 0:sx=alongX;sy = -height/2+inset
            case 1:sx=width/2*0.6-inset;sy=alongY
            case 2:sx=alongX;sy=height/2*0.6-inset
            case 4:sx=(random()-0.5)*width*0.54;sy=(random()-0.5)*height*0.48
            default:sx = -width/2+inset;sy=alongY
            }
            // Canonical owner consumes both center normal draws on every side.
            let normalX=cos(random() * .pi*2),normalY=sin(random() * .pi*2)
            let normals=[(0.0,-1.0),(1.0,0.0),(0.0,1.0),(-1.0,0.0),(normalX,normalY)]
            let normal=normals[side],theta=atan2(normal.1,normal.0)+(random()-0.5)*0.9
            let distance=center ? size*(0.025+random()*0.12)*0.88 : size*0.15*0.88+random()*max(0,size*0.34*0.88-size*0.15*0.88)
            let dx=sx+cos(theta)*distance,dy=sy+sin(theta)*distance
            let driftX=(random()-0.5)*(size*0.06*0.88),driftY=(random()-0.5)*(size*0.06*0.88)
            let fadeIn=0.018+random()*0.022
            var run=0.16+random()*0.12,hold=0.02+random()*0.03,out=0.08+random()*0.06
            let ratio=max(0.2,min(1.25,radius/max(1,maxRadius))),jitter=0.65+random()*0.85
            run *= 1+ratio*0.75*jitter;hold += ratio*random()*0.12;out *= 1.05+ratio*(0.4+random()*0.45)
            let scale=(0.65+random()*0.25)*max(0.7,0.98),delay=Double(burst)*0.04+random()*0.018
            result.append(Particle(radiusX:radius,radiusY:radius*aspect,alpha:alpha,rotation:rotation,startX:cw/2+sx,startY:ch/2+sy,endX:cw/2+dx+driftX,endY:ch/2+dy+driftY,scale:scale,delay:delay,fadeIn:fadeIn,run:run,hold:hold,fadeOut:out))
        }}
        particles=result
        let haloPad=size*(0.22+0.05*1.08)*1.02;haloWidth=width+haloPad*2;haloHeight=height+haloPad*2
    }
}

@MainActor
enum NativeRewardSmoke {
    static func layer(plan:NativeRewardSmokePlan,center:CGPoint)->CALayer {
        let container=CALayer();container.name="native.reward.reveal-smoke";container.bounds=CGRect(x:0,y:0,width:plan.width,height:plan.height);container.position=center
        for item in plan.particles {
            let puff=CAShapeLayer();puff.path=UIBezierPath(ovalIn:CGRect(x:-item.radiusX,y:-item.radiusY,width:item.radiusX*2,height:item.radiusY*2)).cgPath
            puff.fillColor=UIColor.white.withAlphaComponent(item.alpha).cgColor;puff.opacity=0
            puff.position=CGPoint(x:item.startX+item.radiusX,y:item.startY+item.radiusY)
            var transform=CATransform3DMakeRotation(item.rotation * .pi/180,0,0,1);transform=CATransform3DScale(transform,item.scale,item.scale,1);puff.transform=transform;container.addSublayer(puff)
            let duration=item.delay+item.fadeIn+item.run+item.hold+item.fadeOut
            let alpha=CAKeyframeAnimation(keyPath:"opacity");alpha.values=[0,0,0.9,0.9,0.9,0];alpha.keyTimes=[0,item.delay/duration,(item.delay+item.fadeIn)/duration,(item.delay+item.fadeIn+item.run)/duration,(item.delay+item.fadeIn+item.run+item.hold)/duration,1].map(NSNumber.init(value:));alpha.duration=duration
            alpha.timingFunctions=[CAMediaTimingFunction(name:.linear),CAMediaTimingFunction(controlPoints:0.33,0.66,0.66,1),CAMediaTimingFunction(name:.linear),CAMediaTimingFunction(name:.linear),CAMediaTimingFunction(controlPoints:0.33,0,0.66,0.33)]
            let position=CAKeyframeAnimation(keyPath:"position");position.values=[NSValue(cgPoint:puff.position),NSValue(cgPoint:puff.position),NSValue(cgPoint:CGPoint(x:item.endX+item.radiusX,y:item.endY+item.radiusY)),NSValue(cgPoint:CGPoint(x:item.endX+item.radiusX,y:item.endY+item.radiusY))];position.keyTimes=[0,(item.delay+item.fadeIn)/duration,(item.delay+item.fadeIn+item.run)/duration,1].map(NSNumber.init(value:));position.timingFunctions=[CAMediaTimingFunction(name:.linear),CAMediaTimingFunction(controlPoints:0.39,0.575,0.565,1),CAMediaTimingFunction(name:.linear)];position.duration=duration
            puff.add(alpha,forKey:"reward.smoke.opacity");puff.add(position,forKey:"reward.smoke.position")
        }
        let halo=CALayer();halo.bounds=CGRect(x:0,y:0,width:plan.haloWidth,height:plan.haloHeight);halo.position=CGPoint(x:plan.width/2,y:plan.height/2);halo.backgroundColor=UIColor.white.withAlphaComponent(0.10).cgColor;halo.cornerRadius=16;halo.opacity=0;container.addSublayer(halo)
        let pulse=CAKeyframeAnimation(keyPath:"opacity");pulse.values=[0,0.22,0.22,0];pulse.keyTimes=[0,0.08/0.46,0.18/0.46,1].map(NSNumber.init(value:));pulse.duration=0.46;halo.add(pulse,forKey:"reward.smoke.halo")
        let fade=CAKeyframeAnimation(keyPath:"opacity");fade.values=[1,1,0,0];fade.keyTimes=[0,0.82/1.75,1.62/1.75,1].map(NSNumber.init(value:));fade.duration=1.75;container.add(fade,forKey:"reward.smoke.retire")
        return container
    }
}
