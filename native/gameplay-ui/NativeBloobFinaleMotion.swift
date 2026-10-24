import Foundation
import CoreGraphics

/// Every random choice belongs to this finite presentation, never its paint loop.
struct NativeBloobFinaleMotion {
    static let fakeDiceCount=24
    static let floatingBallCount=66
    static let reverseBallCount=1+floatingBallCount
    static let heroReverseStart=0.52
    static let heroReverseRate=1.6
    static func heroArtworkClock(_ seconds:Double)->Double {
        let t=max(0,seconds)
        return min(t,1)*1.7+max(0,t-1)
    }
    static func heroReverseSeconds(_ seconds:Double)->Double {
        (heroArtworkClock(seconds)-heroArtworkClock(heroReverseStart))*heroReverseRate
    }
    static func heroEventTime(_ svgSeconds:Double)->Double {
        let clock=heroArtworkClock(heroReverseStart)+svgSeconds/heroReverseRate
        return clock<=1.7 ? clock/1.7:1+(clock-1.7)
    }
    static var scatterStart:Double {heroEventTime(NativeBloobReverseArt.burstOffset)}
    struct FakeDie {
        let flight:Profile,incoming:CGPoint,inside:CGPoint
        let intakeDelay,intakeDuration:Double,value:Int,exit:Double,scatterDepth:Double
    }
    struct Profile {
        let x,y,size,phaseX,playbackRate,playbackPhase,baseRotation,frequencyX,frequencyY,flightDuration,bendX,bendY:Double
        let playbackRoute:NativeBloobArt.PlaybackRoute?
        let mirrored,front:Bool
        let asset:Int
    }
    struct Pose {let center:CGPoint,scale,rotation,alpha:Double;let hidden:Bool}
    let reverseBalls:[Profile],fakeDice:[FakeDie],viewport:CGSize
    let origin:CGPoint
    let heroSize:Double
    let heroDestination:CGPoint
    let exitTimes:[Double]
    var reverseStart:Double {Self.heroReverseStart}
    var duration:Double {max(exitTimes.max() ?? 0,fakeDice.map(\.exit).max() ?? 0)}
    init(viewport:CGSize,origin:CGPoint?=nil,boardRect:CGRect?=nil,random:()->Double={Double.random(in:0..<1)}) {
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
        exitTimes=[Self.heroEventTime(NativeBloobReverseArt.duration)]+children.map {
            Self.firstExit($0,viewport:viewport,origin:destination)
        }
        let board=boardRect ?? CGRect(x:24,y:120,width:max(1,viewport.width-48),height:max(1,viewport.height-180))
        fakeDice=(0..<Self.fakeDiceCount).map {_ in
            // Incoming and outgoing angles are new independent draws, never a BLOOB path.
            let inAngle=roll()*2 * .pi,margin=70+roll()*90
            let cx=cos(inAngle),cy=sin(inAngle)
            let distance=min((Double(board.width)/2+margin)/max(0.00001,abs(cx)),
                             (Double(board.height)/2+margin)/max(0.00001,abs(cy)))
            let incoming=CGPoint(x:Double(board.midX)+cx*distance,y:Double(board.midY)+cy*distance)
            let insideAngle=roll()*2 * .pi,insideRadius=roll()*38
            let inside=CGPoint(x:cos(insideAngle)*insideRadius,y:sin(insideAngle)*insideRadius)
            let from=CGPoint(x:destination.x+inside.x,y:destination.y+inside.y)
            let outAngle=roll()*2 * .pi,reach=hypot(Double(viewport.width),Double(viewport.height))+500
            let flight=profile(x:(Double(from.x)+cos(outAngle)*reach)/Double(viewport.width),
                               y:(Double(from.y)+sin(outAngle)*reach)/Double(viewport.height),size:36+roll()*32,asset:Int(roll()*5),front:true)
            return FakeDie(flight:flight,incoming:incoming,inside:inside,intakeDelay:roll()*0.12,
                           intakeDuration:0.30+roll()*0.25,value:1+Int(roll()*6),
                           exit:Self.firstExit(flight,viewport:viewport,origin:from),scatterDepth:[2.0,5.0,9.0][Int(roll()*3)])
        }
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
    func reverseAnimationStart(_ index:Int)->Double {index==0 ? Self.heroReverseStart:.infinity}
    func reverseRate(_ index:Int)->Double {Self.heroReverseRate}
    func reverseDuration(_ index:Int)->Double {index==0 ? Self.heroEventTime(NativeBloobReverseArt.duration)-Self.heroReverseStart:0}
    func popStart(_ index:Int)->Double {index==0 ? Self.scatterStart:.infinity}
    func stretch(_ index:Int,seconds t:Double)->CGSize {
        guard index>0 else{return CGSize(width:1,height:1)}
        let p=reverseBalls[index],age=max(0,t-Self.scatterStart)
        let wobble=sin(age*(p.asset==3 ? 23:11)+p.phaseX)*0.12*min(1,age/0.1)
        return CGSize(width:1+wobble,height:1-wobble)
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
            let u=min(1,max(0,t/Self.heroReverseStart)),e=1-pow(1-u,3),target=heroDestination
            return Pose(center:CGPoint(x:origin.x+(target.x-origin.x)*e,y:origin.y+(target.y-origin.y)*e),
                        scale:(0.2+0.8*e)*(1+0.5*min(1,max(0,(t-Self.heroReverseStart)/0.1))),rotation:0,alpha:1,hidden:t<0 || t>=exitTimes[0])
        }
        let age=t-Self.scatterStart
        return Pose(center:Self.childPosition(p,age:age,viewport:viewport,origin:heroDestination),
                    scale:0.45+0.55*min(1,max(0,age/0.08)),rotation:p.baseRotation+max(0,age)*(p.asset==2 ? 390:90)*sin(p.phaseX),
                    alpha:1,hidden:age<0 || t>=exitTimes[index])
    }
    func fakeDiePose(_ index:Int,seconds t:Double)->Pose {
        let die=fakeDice[index],p=die.flight
        if t<Self.scatterStart {
            let u=min(1,max(0,(t-die.intakeDelay)/die.intakeDuration))
            let e=u*u*u // Accelerating magnetic intake, then hold inside the moving hero.
            let hero=reversePose(0,seconds:t).center
            let target=CGPoint(x:hero.x+die.inside.x,y:hero.y+die.inside.y)
            let curve=sin(u * .pi)
            return Pose(center:CGPoint(x:die.incoming.x+(target.x-die.incoming.x)*e+CGFloat(p.bendX*curve),
                                       y:die.incoming.y+(target.y-die.incoming.y)*e+CGFloat(p.bendY*curve)),
                        scale:1,rotation:p.baseRotation+(1-e)*t*280,alpha:t<Self.heroReverseStart ? 1:0,hidden:t<die.intakeDelay)
        }
        let age=t-Self.scatterStart,from=CGPoint(x:heroDestination.x+die.inside.x,y:heroDestination.y+die.inside.y)
        return Pose(center:Self.childPosition(p,age:age,viewport:viewport,origin:from),
                    scale:0.4+0.6*min(1,age/0.1),rotation:p.baseRotation+age*(180+p.frequencyX*100),
                    alpha:1,hidden:t>=die.exit)
    }
}
