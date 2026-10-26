import Foundation
import CoreGraphics

/// Every random choice belongs to this finite presentation, never its paint loop.
struct NativeBloobFinaleMotion {
    static let fakeDiceCount=24
    static let fakeDieFlightSpeed=1.2
    static let floatingBallCount=66
    static let reverseBallCount=1+floatingBallCount
    static let heroGrowthDuration=0.52
    static let heroAnticipationExtension=1.0
    static let heroReverseStart=heroGrowthDuration+heroAnticipationExtension
    static let heroReverseRate=1.6
    private static let heroSpeedPulses:[(Double,Double,Double)]=[(0,0.2,0.5),(0.2,0.4,2),(0.4,0.55,0.25),(0.55,0.75,3.5),(0.75,1,5)]
    private static func baseArtworkClock(_ seconds:Double)->Double {
        let t=max(0,seconds);return min(t,1)*1.7+max(0,t-1)
    }
    static func heroArtworkClock(_ seconds:Double)->Double {
        let t=max(0,seconds),age=min(heroAnticipationExtension,max(0,t-heroGrowthDuration))
        // Continuous source-frame clock with increasingly urgent speed pulses.
        let extra=heroSpeedPulses.reduce(0.0){sum,phase in sum+max(0,min(age,phase.1)-phase.0)*phase.2}
        return baseArtworkClock(t)+extra
    }
    static func heroReverseSeconds(_ seconds:Double)->Double {
        let source=seconds<heroGrowthDuration ? seconds:seconds<heroReverseStart ? heroGrowthDuration:seconds-heroAnticipationExtension
        return (baseArtworkClock(source)-baseArtworkClock(heroGrowthDuration))*heroReverseRate
    }
    static func heroEventTime(_ svgSeconds:Double)->Double {
        let clock=baseArtworkClock(heroGrowthDuration)+svgSeconds/heroReverseRate
        let original=clock<=1.7 ? clock/1.7:1+(clock-1.7)
        return original+heroAnticipationExtension
    }
    static var scatterStart:Double {heroEventTime(NativeBloobReverseArt.burstOffset)}
    struct FakeDie {
        let flight:Profile,inside:CGPoint
        let value:Int,exit:Double,scatterDepth:Double
    }
    struct Profile {
        let x,y,size,phaseX,playbackRate,playbackPhase,baseRotation,frequencyX,frequencyY,flightDuration,bendX,bendY:Double
        let playbackRoute:NativeBloobArt.PlaybackRoute?
        let mirrored,front:Bool
        let asset:Int
    }
    struct Pose {let center:CGPoint,scale,rotation,alpha:Double;let hidden:Bool}
    struct GravityTail {
        let start:Double,origin,velocity:CGPoint,gravity:Double
        func center(seconds:Double)->CGPoint {
            let age=max(0,seconds-start)
            return CGPoint(x:origin.x+velocity.x*age,y:origin.y+velocity.y*age+0.5*gravity*age*age)
        }
    }
    let gravityTails:[Int:GravityTail]
    let reverseBalls:[Profile],fakeDice:[FakeDie],viewport:CGSize
    let origin:CGPoint
    let heroSize:Double
    let heroDestination:CGPoint
    let exitTimes:[Double]
    let originalScatterDuration:Double
    let scatterTimeScale:Double
    var reverseStart:Double {Self.heroReverseStart}
    var duration:Double {max(exitTimes.max() ?? 0,fakeDice.map(\.exit).max() ?? 0)}
    init(viewport:CGSize,origin:CGPoint?=nil,random:()->Double={Double.random(in:0..<1)}) {
        self.viewport=viewport
        self.origin=origin ?? CGPoint(x:viewport.width/2,y:viewport.height/2)
        let size=min(320,Double(min(viewport.width,viewport.height))-32)
        heroSize=size
        let destination=Self.destination(viewport:viewport,origin:origin ?? CGPoint(x:viewport.width/2,y:viewport.height/2),size:size)
        heroDestination=destination
        func roll()->Double {let r=random();return r.isFinite ? min(0.999999,max(0,r)):0.5}
        func profile(x:Double,y:Double,size:Double,asset:Int=0,front:Bool=true)->Profile {
            let phase=roll()*2 * .pi
            return Profile(x:x,y:y,size:size,phaseX:phase,playbackRate:1.3+roll()*1.5,
                           playbackPhase:roll()*2 * .pi,baseRotation:roll()*360,frequencyX:1.5+roll()*0.8,frequencyY:1.4+roll()*0.8,flightDuration:0.65+roll()*1.15,bendX:(roll()-0.5)*160,bendY:(roll()-0.5)*180,
                           playbackRoute:.init(seed:phase.bitPattern ^ size.bitPattern),
                           mirrored:roll()<0.5,front:front,asset:asset)
        }
        let hero=profile(x:0.5,y:0.5,size:size)
        // Independent angles and path styles: no paired angles or radial slots.
        let children=(0..<Self.floatingBallCount).map {_ in
            let angle=roll()*2 * .pi,reach=hypot(Double(viewport.width),Double(viewport.height))+400
            let x=(Double(destination.x)+cos(angle)*reach)/Double(viewport.width)
            let y=(Double(destination.y)+sin(angle)*reach)/Double(viewport.height)
            let bucket=roll(),size=bucket<0.34 ? 24+roll()*24:bucket<0.72 ? 52+roll()*48:110+roll()*80
            return profile(x:x,y:y,size:size,asset:Int(roll()*5),front:roll()<0.5)
        }
        reverseBalls=[hero]+children
        let originalExits=[Self.heroEventTime(NativeBloobReverseArt.duration)]+children.map {
            Self.firstExit($0,viewport:viewport,origin:destination)
        }
        let originalDice=(0..<Self.fakeDiceCount).map {_ in
            let insideAngle=roll()*2 * .pi,insideRadius=roll()*38
            let inside=CGPoint(x:cos(insideAngle)*insideRadius,y:sin(insideAngle)*insideRadius)
            let from=CGPoint(x:destination.x+inside.x,y:destination.y+inside.y)
            let outAngle=roll()*2 * .pi,reach=hypot(Double(viewport.width),Double(viewport.height))+500
            let flight=profile(x:(Double(from.x)+cos(outAngle)*reach)/Double(viewport.width),
                               y:(Double(from.y)+sin(outAngle)*reach)/Double(viewport.height),size:36+roll()*32,asset:Int(roll()*5),front:true)
            return FakeDie(flight:flight,inside:inside,value:1+Int(roll()*6),
                           exit:Self.firstExit(flight,viewport:viewport,origin:from),scatterDepth:[2.0,5.0,9.0][Int(roll()*3)])
        }
        // Preserve the outgoing phase’s extra second as a maximum budget.
        // Gravity may retire late survivors earlier, never leaving an idle tail.
        let lastExit=max(originalExits.dropFirst().max() ?? Self.scatterStart,originalDice.map{Self.scatterStart+($0.exit-Self.scatterStart)/Self.fakeDieFlightSpeed}.max() ?? Self.scatterStart)
        let originalDuration=max(0.001,lastExit-Self.scatterStart)
        originalScatterDuration=originalDuration
        let timeScale=(originalDuration+1)/originalDuration
        scatterTimeScale=timeScale
        var exits=originalExits.enumerated().map{index,time in index==0 ? time:Self.scatterStart+(time-Self.scatterStart)*timeScale}
        fakeDice=originalDice.map{FakeDie(flight:$0.flight,inside:$0.inside,value:$0.value,
            exit:Self.scatterStart+($0.exit-Self.scatterStart)*timeScale/Self.fakeDieFlightSpeed,scatterDepth:$0.scatterDepth)}
        // Only the slowest third switches to gravity. The burst and faster
        // authored lanes remain intact; no extra random draws or paint state.
        let late=children.indices.map{$0+1}.sorted{a,b in exits[a]==exits[b] ? a<b:exits[a]>exits[b]}.prefix(Self.floatingBallCount/3)
        var tails:[Int:GravityTail]=[:]
        for index in late {
            let p=reverseBalls[index],deadline=exits[index]
            let start=Self.scatterStart+(deadline-Self.scatterStart)*0.55
            let age=(start-Self.scatterStart)/timeScale,step=0.0001
            let point=Self.childPosition(p,age:age,viewport:viewport,origin:destination)
            let a=Self.childPosition(p,age:age-step/timeScale,viewport:viewport,origin:destination)
            let b=Self.childPosition(p,age:age+step/timeScale,viewport:viewport,origin:destination)
            let velocity=CGPoint(x:(b.x-a.x)/(2*step),y:(b.y-a.y)/(2*step))
            let remaining=max(0.001,deadline-start),radius=p.size*0.86+4
            let gravity=max(Double(viewport.height)*1.5,
                            2*(Double(viewport.height)+radius+8-Double(point.y)-Double(velocity.y)*remaining)/(remaining*remaining))
            let tail=GravityTail(start:start,origin:point,velocity:velocity,gravity:gravity)
            tails[index]=tail
            exits[index]=Self.gravityExit(tail,radius:radius,viewport:viewport,deadline:deadline)
        }
        gravityTails=tails;exitTimes=exits
    }
    private static func gravityExit(_ tail:GravityTail,radius:Double,viewport:CGSize,deadline:Double)->Double {
        func outside(_ time:Double)->Bool {
            let c=tail.center(seconds:time)
            return c.x+radius<0 || c.y+radius<0 || c.x-radius>viewport.width || c.y-radius>viewport.height
        }
        var low=tail.start
        for step in 1...240 {
            let time=tail.start+(deadline-tail.start)*Double(step)/240
            if outside(time) {
                var high=time
                for _ in 0..<16 {let mid=(low+high)/2;if outside(mid){high=mid}else{low=mid}}
                return high
            }
            low=time
        }
        return deadline
    }
    private static func firstExit(_ p:Profile,viewport:CGSize,origin:CGPoint)->Double {
        let radius=p.size*0.86+4
        func outside(_ age:Double)->Bool {
            let c=childPosition(p,age:age,viewport:viewport,origin:origin)
            return c.x+radius<0 || c.y+radius<0 || c.x-radius>viewport.width || c.y-radius>viewport.height
        }
        var previous=0.0
        for step in 1...240 {
            let age=p.flightDuration*Double(step)/240
            if outside(age) {
                var low=previous,high=age
                for _ in 0..<12 {let mid=(low+high)/2;if outside(mid){high=mid}else{low=mid}}
                return scatterStart+high
            }
            previous=age
        }
        return scatterStart+p.flightDuration
    }
    private static func destination(viewport:CGSize,origin:CGPoint,size:Double)->CGPoint {
        let margin=CGFloat(size/2+12),dx=viewport.width/2-origin.x,dy=viewport.height/2-origin.y
        let length=max(1,hypot(dx,dy)),travel=min(180,max(80,length*0.7))
        return CGPoint(x:min(viewport.width-margin,max(margin,origin.x+dx/length*travel)),
                       y:min(viewport.height-margin,max(margin,origin.y+dy/length*travel)))
    }
    static var boardReactionStart:Double {scatterStart-heroAnticipationExtension-0.2}
    static func boardReactionOffset(plan:NativeShortWildBoardBlastPlan,phase:Double,seconds t:Double,startTime:Double=boardReactionStart,returnTime:Double=scatterStart,vibrates:Bool=true)->CGPoint {
        let age=t-startTime
        guard age>0 else{return .zero}
        let dx=plan.blast.x-plan.rest.x,dy=plan.blast.y-plan.rest.y
        if t<returnTime {
            let progress=NativeBoardMotion.Ease.backOut(2.9).sample(CGFloat(max(0,age-plan.waveDelay)/plan.blastDuration))
            let strength=min(1,age/0.08)
            let x=sin(2 * .pi*(25*age+15*age*age)+phase),y=sin(2 * .pi*(31*age+17*age*age)+phase)
            let vibration=(vibrates ? 4.0:0)*strength/max(1,hypot(x,y))
            return CGPoint(x:dx*progress+x*vibration,y:dy*progress+y*vibration)
        }
        guard t<returnTime+plan.returnDuration else{return .zero}
        let progress=NativeBoardMotion.Ease.elasticOut(1,CGFloat(plan.returnElastic)).sample(CGFloat((t-returnTime)/plan.returnDuration))
        let from=Self.boardReactionOffset(plan:plan,phase:phase,seconds:returnTime-0.000001,startTime:startTime,returnTime:returnTime,vibrates:vibrates)
        return CGPoint(x:from.x*(1-progress),y:from.y*(1-progress))
    }
    func heroShakeOffset(seconds t:Double)->CGPoint {
        let duration=Self.heroAnticipationExtension+0.2,start=Self.scatterStart-duration
        guard t>=start,t<Self.scatterStart else{return .zero}
        let age=t-start,p=min(1,age/duration)
        let envelope=min(1,age/0.02)*(0.3+0.7*p),limit=heroSize*0.05
        let x=sin(2 * .pi*(25*age+15*age*age)),y=sin(2 * .pi*(31*age+17*age*age)),length=max(1,hypot(x,y))
        return CGPoint(x:limit*envelope*x/length,y:limit*envelope*y/length)
    }
    func screenShakeOffset(seconds t:Double)->CGPoint {
        let hero=heroShakeOffset(seconds:t),limit=min(9,Double(min(viewport.width,viewport.height))*0.025)
        let scale=limit/(heroSize*0.05)
        return CGPoint(x:hero.x*scale,y:hero.y*scale)
    }
    func reverseAnimationStart(_ index:Int)->Double {index==0 ? Self.heroReverseStart:.infinity}
    func reverseRate(_ index:Int)->Double {Self.heroReverseRate}
    func reverseDuration(_ index:Int)->Double {index==0 ? Self.heroEventTime(NativeBloobReverseArt.duration)-Self.heroReverseStart:0}
    func popStart(_ index:Int)->Double {index==0 ? Self.scatterStart:.infinity}
    func stretch(_ index:Int,seconds t:Double)->CGSize {
        guard index>0 else{return CGSize(width:1,height:1)}
        let u=(t-Self.scatterStart)/(exitTimes[index]-Self.scatterStart)
        return Self.flightStretch(progress:u)
    }
    private static func childPosition(_ p:Profile,age:Double,viewport:CGSize,origin:CGPoint)->CGPoint {
        let u=min(1,max(0,age/p.flightDuration)),dx=Double(viewport.width)*p.x-Double(origin.x),dy=Double(viewport.height)*p.y-Double(origin.y)
        let envelope=sin(u * .pi)
        var x=Double(origin.x)+dx*u,y=Double(origin.y)+dy*u
        switch p.asset {
        case 0: // Ballistic fall or rising arc, solved to the outside endpoint.
            y+=0.5*(600+p.frequencyY*180)*p.flightDuration*p.flightDuration*(u*u-u)
        case 1: // Sideways float with an uneven elastic-looking bob.
            x=Double(origin.x)+dx*pow(u,0.85)
            y+=sin(u*3 * .pi+p.phaseX)*abs(p.bendY)*envelope
        case 2: // Coin-like arcing lane and spin.
            y-=(100+abs(p.bendY)*2)*4*u*(1-u)
            x+=p.bendX*envelope
        case 3: // Bee-like crossing, with a captured independent wingbeat phase.
            x+=sin(u*7 * .pi+p.phaseX)*p.bendX*envelope
            y+=sin(u*5 * .pi+p.playbackPhase)*p.bendY*envelope
        default: // Crooked accelerating escape.
            x=Double(origin.x)+dx*u*u+p.bendX*envelope
            y=Double(origin.y)+dy*u*u+p.bendY*sin(u*2 * .pi)*envelope
        }
        return CGPoint(x:x,y:y)
    }
    func reversePose(_ index:Int,seconds t:Double)->Pose {
        let p=reverseBalls[index]
        if index==0 {
            let u=min(1,max(0,t/Self.heroGrowthDuration)),e=1-pow(1-u,3),target=heroDestination
            let shake=heroShakeOffset(seconds:t)
            return Pose(center:CGPoint(x:origin.x+(target.x-origin.x)*e+shake.x,y:origin.y+(target.y-origin.y)*e+shake.y),
                        scale:(0.2+0.8*e)*(1+0.5*min(1,max(0,(t-Self.heroReverseStart)/0.1))),rotation:0,alpha:1,hidden:t<0 || t>=exitTimes[0])
        }
        let age=(t-Self.scatterStart)/scatterTimeScale
        let center:CGPoint
        if let tail=gravityTails[index],t>=tail.start {center=tail.center(seconds:t)}
        else {center=Self.childPosition(p,age:age,viewport:viewport,origin:heroDestination)}
        return Pose(center:center,
                    scale:0.45+0.55*min(1,max(0,age/0.08)),rotation:p.baseRotation+max(0,age)*(p.asset==2 ? 390:90)*sin(p.phaseX),
                    alpha:1,hidden:age<0 || t>=exitTimes[index])
    }
    private static func flightStretch(progress:Double)->CGSize {
        let u=min(1,max(0,progress))
        // Neutral until40%,peak squeeze50%,peak stretch65%,neutral80%.
        // Smooth keyframe joins and direct axes cap BOTH dimensions at±20%.
        func smooth(_ p:Double)->Double {let x=min(1,max(0,p));return x*x*(3-2*x)}
        let deformation:Double
        if u<0.4 || u>=0.8 {deformation=0}
        else if u<0.5 {deformation=smooth((u-0.4)/0.1)}
        else if u<0.65 {deformation=1-2*smooth((u-0.5)/0.15)}
        else {deformation = -1+smooth((u-0.65)/0.15)}
        return CGSize(width:1-0.2*deformation,height:1+0.2*deformation)
    }
    func fakeDiePose(_ index:Int,seconds t:Double)->Pose {
        let die=fakeDice[index],p=die.flight
        if t<Self.scatterStart {
            return Pose(center:CGPoint(x:heroDestination.x+die.inside.x,y:heroDestination.y+die.inside.y),
                        scale:0,rotation:p.baseRotation,alpha:0,hidden:true)
        }
        let age=(t-Self.scatterStart)*Self.fakeDieFlightSpeed/scatterTimeScale,from=CGPoint(x:heroDestination.x+die.inside.x,y:heroDestination.y+die.inside.y)
        return Pose(center:Self.childPosition(p,age:age,viewport:viewport,origin:from),
                    scale:0.4+0.6*min(1,age/0.1),rotation:p.baseRotation+age*(180+p.frequencyX*100),
                    alpha:1,hidden:t>=die.exit)
    }
}
