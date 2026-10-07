import Foundation
import CoreGraphics

/// Immutable source-authored airborne combat. The transition's parent clock owns
/// visibility, cues and disposal; sampling never schedules work or reads layout.
struct NativeTransitionRoboCombatPlan {
    enum Side: String { case left, right }
    struct Pose {
        var x = 0.0, y = 0.0, scale = 1.0, rotation = 0.0, opacity = 1.0
        var hoverX = 0.0, hoverY = 0.0, skewX = 0.0
    }
    struct FighterPose { var outer: Pose; var inner: Pose; let depth: Int }
    struct BeamPose {
        let anchorX, anchorY, scaleX, scaleY, rotation, opacity, glow: Double
        let depth = 29
        let originX = 0.88, originY = 0.75
    }
    struct Cue { let seconds: Double; let index: Int }
    let cues = [Cue(seconds: 0.20,index: 1),Cue(seconds: 2.12,index: 2)]
    let swapTime, captureTime, duration: Double
    let exitStart: Double
    private struct Point { let time,x,y,scale: Double }
    private struct Hover { let phase,amplitude: Double }
    private struct Exit { let phase,strength,radius,targetX,yDelta: Double }
    private struct Beam { let start,x,y,dx,dy,rotation,scale: Double; let mirrored: Bool }
    private let leftPoints,rightPoints: [Point]
    private let leftBank,rightBank: Double
    private let leftHover,rightHover: Hover
    private let leftExit,rightExit: Exit
    private let exitDuration: Double
    private let hit,final: Beam

    init(viewport: CGSize,sceneFrame: CGRect,exitStart: Double = 2.681,random: () -> Double) {
        self.exitStart = exitStart; captureTime = exitStart + 0.35
        let width = Double(viewport.width), height = Double(viewport.height), sceneWidth = Double(sceneFrame.width)
        func bounded() -> Double { let v = random(); return v.isFinite ? max(0,min(1,v)):0.5 }
        func between(_ a: Double,_ b: Double) -> Double { a + bounded()*(b-a) }
        // Preserve every source variation draw, including currently unused sway
        // and crossing fields: later allocations share this captured RNG stream.
        let profile = min(2,Int(floor(bounded()*3))), pattern = min(2,Int(floor(bounded()*3)))
        let horizontal = profile == 0 ? between(1.15,1.38):profile == 1 ? between(0.82,1):between(1.02,1.28)
        let verticalBias = profile == 0 ? between(-58,-28):profile == 1 ? between(28,58):between(-20,20)
        let verticalScale = profile == 0 ? between(1.05,1.28):profile == 1 ? between(0.72,0.90):between(0.92,1.12)
        let polarity = profile == 2 ? -1.0:1.0, postDirection = bounded() < 0.5 ? -1.0:1.0
        let entryX = between(96,132), jitterX = between(16,30), jitterY = between(12,24)
        _ = between(24,42); _ = between(16,30); _ = between(1.10,1.65)
        let one = (ratio:between(0.80,0.94),rotation:between(-14,14),travel:between(1.18,1.42),scale:between(1.35,1.68),dx:between(-44,44))
        let four = (ratio:between(0.06,0.20),rotation:between(-16,16),travel:between(1.36,1.66),scale:between(1.44,1.78),dx:between(-52,52))
        let exitVerticalScale = between(0.62,1.12)
        exitDuration = between(0.82,1.08); duration = captureTime + exitDuration
        let jitters = (0..<12).map { _ in (x:between(-jitterX,jitterX),y:between(-jitterY,jitterY)) }
        let upper = min(20-(Double(sceneFrame.height)-470-90*188/194),-135+jitters[11].y-80)
        leftHover = Hover(phase:between(-Double.pi,Double.pi),amplitude:between(1.55,2.15))
        rightHover = Hover(phase:between(-Double.pi,Double.pi),amplitude:between(1.35,1.95))
        let firstTime = between(1.52,1.66), gap = between(0.28,0.40), swapGap = between(0.30,0.46)
        let firstX = between(86,134)*horizontal, secondX = between(92,142)*horizontal
        _ = between(72,128)
        let crossingUpper = min(upper-between(18,42),between(-168,-136))+verticalBias
        let separation = between(192,242)*verticalScale
        _ = between(-34,34); _ = between(-18,18)
        leftBank = between(-Double.pi,Double.pi); rightBank = between(-Double.pi,Double.pi)
        let secondTime = firstTime + gap
        swapTime = max(2.12+0.18,secondTime+swapGap)
        let lower = crossingUpper+separation, leftBase = 1.15, rightBase = 1.15*1.40
        let leftFourX = polarity*secondX+jitters[6].x-67, leftFourY = crossingUpper-50
        let rightFourX = -polarity*secondX+jitters[7].x+45
        leftPoints = [
            Point(time:0,x:-(width*0.5+90+60),y:-134,scale:leftBase),
            Point(time:0.72,x:20+jitters[0].x,y:upper+20+jitters[1].y,scale:leftBase*1.50),
            Point(time:1.30,x:70+jitters[0].x,y:upper+20+jitters[1].y-68,scale:leftBase*1.50*0.90),
            Point(time:firstTime,x:-polarity*firstX+jitters[4].x,y:upper-18+verticalBias+jitters[5].y,scale:leftBase*1.42),
            Point(time:secondTime,x:polarity*secondX+jitters[6].x,y:crossingUpper,scale:leftBase*1.48),
            Point(time:2.12,x:leftFourX,y:leftFourY,scale:leftBase*1.48),
            Point(time:swapTime,x:leftFourX+postDirection*50,y:leftFourY-10,scale:leftBase*1.72),
            Point(time:3,x:leftFourX+postDirection*100+jitters[8].x*0.25,y:leftFourY+16,scale:leftBase*1.48/0.60)
        ]
        rightPoints = [
            Point(time:0,x:min(entryX,width*0.34),y:-32,scale:rightBase*0.80),
            Point(time:0.72,x:-40+jitters[1].x,y:-100+jitters[2].y,scale:rightBase*1.60),
            Point(time:1.30,x:-40+jitters[1].x,y:-51+jitters[2].y,scale:rightBase*1.60),
            Point(time:firstTime,x:polarity*firstX+jitters[5].x,y:-96+verticalBias+jitters[6].y,scale:rightBase*1.52),
            Point(time:secondTime,x:-polarity*secondX+jitters[7].x,y:lower,scale:rightBase*1.46),
            Point(time:2.12,x:rightFourX,y:lower,scale:rightBase*1.46),
            Point(time:swapTime,x:rightFourX-postDirection*22,y:lower+4,scale:rightBase*1.12),
            Point(time:3,x:rightFourX-postDirection*44,y:lower+10,scale:rightBase*1.46*0.60)
        ]
        func beam(start: Double,ratio: Double,rotation: Double,horizontal: Double,travel: Double,scale: Double,dx: Double,dy: Double,mirror: Bool,launchY: Double) -> Beam {
            let jitter = between(-22,22), flightScale = between(2.10,2.35)*scale
            let intrinsic = mirror ? -22.6:22.6, vertical = 480*travel+dy-launchY
            let axis = (rotation+180+intrinsic)*Double.pi/180
            let projected = abs(sin(axis)) > 0.08 ? vertical*cos(axis)/sin(axis):horizontal
            let minimum = min(sceneWidth*0.48,max(170,abs(horizontal)*travel*1.12)), maximum = max(minimum,sceneWidth*0.68)
            let aligned = (horizontal < 0 ? -1.0:1.0)*max(minimum,min(maximum,abs(projected)))+dx+jitter
            return Beam(start:start,x:sceneWidth*ratio,y:-Double(sceneFrame.minY)-70+launchY,dx:aligned,dy:vertical,rotation:atan2(vertical,aligned)*180/Double.pi-intrinsic,scale:flightScale,mirrored:mirror)
        }
        hit = beam(start:0.20,ratio:one.ratio,rotation:-96+one.rotation,horizontal:-154,travel:one.travel,scale:one.scale,dx:one.dx,dy:0,mirror:false,launchY:0)
        final = beam(start:2.12,ratio:four.ratio,rotation:-96+four.rotation,horizontal:154,travel:four.travel,scale:four.scale,dx:four.dx,dy:-70,mirror:true,launchY:-40)
        let horizontalExit = width*2+108+60, verticalExit = (height*0.85+100)*exitVerticalScale
        let directions: [(Double,Double)] = pattern == 0 ? [(-1,-1),(1,1)]:pattern == 1 ? [(-1,1),(1,-1)]:[(1,-1),(-1,1)]
        func makeExit(_ side: Int) -> Exit { Exit(phase:between(-Double.pi,Double.pi),strength:between(1.8,2.8),radius:between(16,26),targetX:directions[side].0*horizontalExit,yDelta:directions[side].1*verticalExit) }
        leftExit = makeExit(0); rightExit = makeExit(1)
    }

    func fighter(side: Side,seconds: Double) -> FighterPose {
        let t = max(0,seconds), captured = min(t,captureTime), delay = side == .left ? 0.0:0.20
        let points = side == .left ? leftPoints:rightPoints, hover = side == .left ? leftHover:rightHover
        var outer = flight(points:points,elapsed:min(3,max(0,captured-delay)),bank:side == .left ? leftBank:rightBank)
        if captured < delay { outer.rotation = 0 }
        outer.opacity = t >= delay && t < duration ? 1:0
        var inner = Pose()
        if captured >= delay {
            let h = Self.hover(captured-delay,hover.phase)
            if side == .left { outer.hoverX = 9*hover.amplitude*h.x; outer.hoverY = 12*hover.amplitude*h.y; outer.skewX = h.bank*0.2 }
            else { inner.x = 9*hover.amplitude*h.x; inner.y = 12*hover.amplitude*h.y; inner.skewX = h.bank*0.2 }
        }
        if t >= captureTime {
            let e = side == .left ? leftExit:rightExit, p = max(0,min(1,(t-captureTime)/exitDuration))
            let accelerated = 0.12*p+0.88*p*p, arc = sin(Double.pi*p), direction = side == .left ? 1.0:-1.0
            let envelope = 0.65+arc*0.35, phaseNow = p*Double.pi*2+e.phase, micro = p*exitDuration*Double.pi*0.94+e.phase
            outer.x += (e.targetX-outer.x)*accelerated+direction*e.radius*2.2*arc+(sin(phaseNow)-sin(e.phase))*e.radius*envelope+(sin(micro)-sin(e.phase))*e.strength
            outer.y += e.yDelta*accelerated-e.radius*1.35*arc+(cos(phaseNow)-cos(e.phase))*e.radius*0.72*envelope+(cos(micro*1.17)-cos(e.phase*1.17))*e.strength*0.72
            outer.rotation += direction*30*accelerated+(sin(micro*1.31)-sin(e.phase*1.31))*1.6*envelope
            outer.scale *= 1+(sin(micro*0.83)-sin(e.phase*0.83))*0.01*envelope
        }
        let front = t >= swapTime ? side == .left:side == .right
        return FighterPose(outer:outer,inner:inner,depth:front ? 11:9)
    }

    func beam(key: String,seconds: Double) -> BeamPose? {
        let b: Beam
        switch key { case "robo-beam-hit": b = hit; case "robo-beam-final": b = final; default:return nil }
        let t = seconds-b.start, p = max(0,min(1,t/0.6)), fade = max(0,min(1,(t-0.7)/0.07))
        let scale = b.scale+(1-b.scale)*p+0.55*fade
        return BeamPose(anchorX:b.x+b.dx*p,anchorY:b.y+b.dy*p,scaleX:scale,scaleY:(b.mirrored ? -1:1)*scale,rotation:b.rotation,opacity:t >= 0 && t < 0.77 && seconds < exitStart ? 1-fade:0,glow:9+3*p)
    }

    private static func hover(_ t: Double,_ phase: Double) -> (x: Double,y: Double,bank: Double) {
        let tau = Double.pi*2
        return (sin(t*tau*0.09+phase)*0.65+sin(t*tau*0.38+phase*0.7)*0.35,sin(t*tau*0.07+phase*0.8)*0.55+sin(t*tau*0.47+phase)*0.45,3*sin(t*tau*0.47+phase))
    }
    private func flight(points: [Point],elapsed: Double,bank: Double) -> Pose {
        var i = 0; while i < points.count-2 && elapsed >= points[i+1].time { i += 1 }
        let a = points[i],b = points[i+1],dt = max(0.001,b.time-a.time), p = max(0,min(1,(elapsed-a.time)/dt)), smooth = p*p*(3-2*p)
        let before = max(0,elapsed-0.016),after = min(3,elapsed+0.016)
        let velocity = (sample(points,after,\.x)-sample(points,before,\.x))/max(0.001,after-before)
        return Pose(x:sample(points,elapsed,\.x),y:sample(points,elapsed,\.y),scale:a.scale+(b.scale-a.scale)*smooth,rotation:7*tanh(velocity/240)+Self.hover(elapsed,bank).bank)
    }
    private func sample(_ points: [Point],_ elapsed: Double,_ key: KeyPath<Point,Double>) -> Double {
        var i = 0; while i < points.count-2 && elapsed >= points[i+1].time { i += 1 }
        let a = points[i],b = points[i+1],previous = points[max(0,i-1)],after = points[min(points.count-1,i+2)]
        let dt = max(0.001,b.time-a.time),p = max(0,min(1,(elapsed-a.time)/dt)),p2 = p*p,p3 = p2*p
        let m0 = (b[keyPath:key]-previous[keyPath:key])/max(0.001,b.time-previous.time)*dt
        let m1 = (after[keyPath:key]-a[keyPath:key])/max(0.001,after.time-a.time)*dt
        return (2*p3-3*p2+1)*a[keyPath:key]+(p3-2*p2+p)*m0+(-2*p3+3*p2)*b[keyPath:key]+(p3-p2)*m1
    }
}
