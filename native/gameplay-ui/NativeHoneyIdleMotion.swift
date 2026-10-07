import Foundation
import CoreGraphics

/// Source honey-bee-idle-orbit.ts; every RNG draw is captured once per live tile.
enum NativeHoneyIdleMotion {
    static let tau=Double.pi*2
    struct Profile {
        var phase:Double
        let turnProgressOffset,direction,revolutionsPerSecond,radiusX,radiusY,centerY,wobblePhase,wobbleAmount,bounceAmount,cutMix,reverseAfterLaps,trailStrength,trailSpring,trailDamping,chaseLaneX,chaseLaneY,chaseFanDistance,chaseDistancePulseRate,chaseDelaySeconds,chaseCurveAmount,chaseCurveRate,chaseCurvePhase,chaseCurveDirection,entranceDelay,entranceDuration,sizeScale:Double
    }
    struct Orbit {let x,y,velocityX,velocityY:Double;let front:Bool}
    struct Trail {var x=0.0,y=0.0,velocityX=0.0,velocityY=0.0}
    struct Pose {let x,y,alpha,scale:Double;let asset:Int,front:Bool}
    static func make(random:()->Double)->[Profile] {
        let xBands=[(0.45,0.48),(0.49,0.52),(0.53,0.55)],yBands=[(0.39,0.43),(0.45,0.48),(0.50,0.53)],delayBands=[(0.035,0.075),(0.105,0.165),(0.19,0.27)]
        let laneX=[-0.30,0.05,0.34],laneY=[-0.20,-0.58,-0.34],fan=[-0.58,0.12,0.62],turn=[0.18,0.43,0.71]
        func r(_ a:Double,_ b:Double)->Double {a+(b-a)*random()}
        return (0..<3).map {i in
            let x=xBands[i],y=yBands[(i+1)%3],delay=delayBands[i]
            return Profile(phase:Double(i)/3*tau+r(-0.24,0.24),turnProgressOffset:turn[i]+r(-0.035,0.035),direction:random()>0.5 ? 1:-1,revolutionsPerSecond:r(0.19,0.31),radiusX:128*r(x.0,x.1),radiusY:128*r(y.0,y.1),centerY:128*r(-0.015,0.015),wobblePhase:r(0,tau),wobbleAmount:128*r(0.009,0.016),bounceAmount:128*r(0.008,0.016),cutMix:r(0.08,0.14),reverseAfterLaps:r(2.2,4.2),trailStrength:r(0.58+Double(i)*0.17,0.70+Double(i)*0.17),trailSpring:r(19+Double(i)*3,25+Double(i)*3),trailDamping:r(7.2,9.4),chaseLaneX:128*(laneX[i]+r(-0.035,0.035)),chaseLaneY:128*(laneY[i]+r(-0.04,0.04)),chaseFanDistance:128*(fan[i]+r(-0.04,0.04)),chaseDistancePulseRate:r(0.72,1.28),chaseDelaySeconds:r(delay.0,delay.1),chaseCurveAmount:128*r(0.16+Double(i)*0.035,0.24+Double(i)*0.045),chaseCurveRate:r(0.52+Double(i)*0.12,0.78+Double(i)*0.16),chaseCurvePhase:r(0,tau),chaseCurveDirection:i==1 ? 1:-1,entranceDelay:Double(i)*0.055+r(0,0.025),entranceDuration:r(0.30,0.40),sizeScale:r(0.86,1.14))
        }
    }
    static func orbit(_ p:Profile,seconds:Double)->Orbit {
        let half=p.reverseAfterLaps/p.revolutionsPerSecond,position=p.turnProgressOffset+max(0,seconds)/half,index=floor(position),progress=position-index,eased=0.5-0.5*cos(Double.pi*progress),forward=Int(index)%2==0
        let travel=forward ? eased:1-eased,angle=p.phase+travel*tau*p.reverseAfterLaps*p.direction,velocity=sin(Double.pi*progress)*(forward ? 1:-1)*p.direction
        let wobble=sin(angle*2.3+p.wobblePhase)*p.wobbleAmount,cutX=cos(angle)*(1-p.cutMix)+cos(angle*2.15+p.wobblePhase)*p.cutMix,cutY=sin(angle)*(1-p.cutMix)+sin(angle*1.72-p.wobblePhase)*p.cutMix
        return Orbit(x:cutX*p.radiusX+wobble,y:p.centerY+cutY*p.radiusY+sin(angle*3.35+p.wobblePhase)*p.bounceAmount,velocityX:velocity * -sin(angle)*p.radiusX,velocityY:velocity*cos(angle)*p.radiusY,front:sin(angle)>=0)
    }
    static func advance(_ state:inout Trail,targetX:Double,targetY:Double,delta:Double,spring:Double,damping:Double,maxDistance:Double) {
        let dt=min(0.05,max(1/240,delta))
        state.velocityX+=(targetX-state.x)*spring*dt;state.velocityY+=(targetY-state.y)*spring*dt
        let factor=exp(-damping*dt);state.velocityX*=factor;state.velocityY*=factor
        state.x+=state.velocityX*dt;state.y+=state.velocityY*dt
        let distance=hypot(state.x,state.y)
        if distance>maxDistance,distance>0 {state.x*=maxDistance/distance;state.y*=maxDistance/distance}
    }
    static func asset(x:Double,y:Double,fallback:Int)->Int {
        let magnitude=hypot(x,y)
        guard magnitude.isFinite,magnitude>=0.01 else {return fallback}
        if abs(x)<magnitude*0.12 {return y<0 ? 5:7}
        let steepness=abs(x)*0.42
        if x>0 {return y < -steepness ? 2:y>steepness ? 6:1}
        if y < -steepness {return abs(y)>abs(x)*1.35 ? 5:4}
        return y>steepness ? 7:3
    }
    struct Runtime {
        struct Bee {
            var trail=Trail(),depthScale=1.0,orbitBlend=1.0,chaseLaneBlend=0.0,chaseDelayRemaining=0.0,reentryPhasePending=false
            var pose=Pose(x:0,y:0,alpha:0,scale:0,asset:1,front:true)
        }
        var profiles:[Profile],bees=Array(repeating:Bee(),count:3)
        private(set) var dragging=false
        private var dragScale=1.0,lastElapsed=0.0,lastPaint = -Double.infinity,lastDragOffsetX=0.0,lastDragOffsetY=0.0,perpendicularX=0.0,perpendicularY=1.0,fanStrength=0.0
        init(profiles:[Profile]) {self.profiles=profiles}
        mutating func setDragging(_ value:Bool) {
            let wasDragging=dragging;dragging=value
            if !wasDragging && value {lastDragOffsetX=0;lastDragOffsetY=0;for i in bees.indices {bees[i].chaseDelayRemaining=profiles[i].chaseDelaySeconds}}
            if wasDragging && !value {for i in bees.indices {bees[i].chaseDelayRemaining=0;bees[i].reentryPhasePending=true}}
        }
        mutating func updateDrag(offsetX:Double,offsetY:Double,velocityX:Double,velocityY:Double) {
            guard dragging else {return}
            let dx=offsetX-lastDragOffsetX,dy=offsetY-lastDragOffsetY;lastDragOffsetX=offsetX;lastDragOffsetY=offsetY
            let speed=hypot(velocityX,velocityY)
            if speed>0.004 {perpendicularX = -velocityY/speed;perpendicularY=velocityX/speed}
            fanStrength+=(min(1,speed/0.32)-fanStrength)*0.28
            for i in bees.indices {
                bees[i].chaseLaneBlend=1;bees[i].trail.x-=dx;bees[i].trail.y-=dy
                let old=bees[i].pose;bees[i].pose=Pose(x:old.x-dx,y:old.y-dy,alpha:old.alpha,scale:old.scale,asset:old.asset,front:old.front)
                let distance=hypot(bees[i].trail.x,bees[i].trail.y),bound=128*2.4*profiles[i].trailStrength
                if distance>bound,distance>0 {bees[i].trail.x*=bound/distance;bees[i].trail.y*=bound/distance}
            }
        }
        mutating func paint(seconds:Double,force:Bool=false,idleFPS:Double=30,random:()->Double)->Bool {
            let t=min(3600,max(0,seconds))
            if !force,!dragging,t>=0.6,idleFPS>0,t-lastPaint<1/idleFPS {return false}
            lastPaint=t
            let elapsed=t-lastElapsed,delta=min(0.05,max(1/240,elapsed==0 ? 1/60:elapsed));lastElapsed=t
            dragScale+=((dragging ? 1.1:1)-dragScale)*0.16
            for i in bees.indices {
                var state=bees[i];let p=profiles[i],index=Double(i)
                state.chaseLaneBlend+=((dragging ? 1:0)-state.chaseLaneBlend)*(dragging ? 0.16:0.025)
                let pulse=0.78+sin(t*tau*p.chaseDistancePulseRate+p.wobblePhase)*0.22
                let laneX=(p.chaseLaneX+perpendicularX*p.chaseFanDistance*fanStrength)*pulse*state.chaseLaneBlend,laneY=(p.chaseLaneY+perpendicularY*p.chaseFanDistance*fanStrength)*pulse*state.chaseLaneBlend
                state.chaseDelayRemaining=max(0,state.chaseDelayRemaining-delta)
                let ax=laneX-state.trail.x,ay=laneY-state.trail.y,length=hypot(ax,ay)==0 ? 1:hypot(ax,ay),envelope=min(1,length/(128*0.42)),wave=sin(t*tau*p.chaseCurveRate+p.chaseCurvePhase)
                let offset=p.chaseCurveDirection*p.chaseCurveAmount*envelope*(0.68+abs(wave)*0.32),cx=laneX-ay/length*offset,cy=laneY+ax/length*offset
                advance(&state.trail,targetX:state.chaseDelayRemaining>0 ? state.trail.x:cx,targetY:state.chaseDelayRemaining>0 ? state.trail.y:cy,delta:delta,spring:p.trailSpring,damping:p.trailDamping,maxDistance:128*2.4*p.trailStrength)
                let distance=hypot(state.trail.x,state.trail.y),normalized=min(1,max(0,distance)/(128*0.35)),target=dragging ? 0.8-normalized*0.72:normalized>=0.46 ? 0.08:1-normalized/0.46*0.92
                state.orbitBlend+=(target-state.orbitBlend)*(dragging ? 0.16:0.09)
                if state.reentryPhasePending,state.orbitBlend<0.24 {profiles[i].phase += -Double.pi+tau*random();state.reentryPhasePending=false}
                let o=orbit(profiles[i],seconds:t),velocityLength=hypot(state.trail.velocityX,state.trail.velocityY),vx=velocityLength>0.01 ? state.trail.velocityX:-state.trail.x,vy=velocityLength>0.01 ? state.trail.velocityY:-state.trail.y,vLength=hypot(vx,vy)==0 ? 1:hypot(vx,vy)
                let wobble=sin(t*tau*(2.4+index*0.35)+p.wobblePhase)*128*0.022*(1-state.orbitBlend),nervousX=sin(t*tau*(4.8+index*0.7)+p.wobblePhase)*128*0.005,nervousY=cos(t*tau*(5.6+index*0.6)-p.wobblePhase)*128*0.004
                let toX = -(state.trail.x+o.x*state.orbitBlend),toY = -(state.trail.y+o.y*state.orbitBlend),heading=1-state.orbitBlend
                let asset=asset(x:o.velocityX*state.orbitBlend+toX*heading,y:o.velocityY*state.orbitBlend+toY*heading,fallback:i%2==0 ? 1:3)
                let entrance=max(0,min(1,(t-p.entranceDelay)/p.entranceDuration)),ease=entrance<1 ? 1+2.70158*pow(entrance-1,3)+1.70158*pow(entrance-1,2):1
                state.depthScale+=((o.front ? 1.2:1)-state.depthScale)*0.14
                let wing=1+sin(t*tau*2.7+index)*0.038+sin(t*tau*6.1+p.wobblePhase)*0.008
                state.pose=Pose(x:state.trail.x+o.x*state.orbitBlend-vy/vLength*wobble+nervousX,y:state.trail.y+o.y*state.orbitBlend+vx/vLength*wobble+nervousY,alpha:entrance,scale:wing*dragScale*state.depthScale*ease,asset:asset,front:entrance<1 || o.front)
                bees[i]=state
            }
            return true
        }
    }
}
