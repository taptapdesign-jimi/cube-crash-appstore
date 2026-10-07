import Foundation
import CoreGraphics

/// fx.ts animateStarsToHudIcon: 22 cached wavy points, authored hyper-space
/// pacing and exact 98% arrival receipt. Coordinates are source screen space.
struct NativeHUDStarMotion {
    let points: [CGPoint]
    let delay: TimeInterval
    let duration: TimeInterval
    let size: CGFloat
    let rotation: CGFloat
    var end: TimeInterval { delay+duration }
    struct Pose { let point: CGPoint; let size: CGFloat; let rotation: CGFloat; let arrived: Bool }
    static func batch(origins: [CGPoint],target: CGPoint,random: () -> Double = { Double.random(in: 0..<1) }) -> [Self] {
        var sizes: [CGFloat] = [56,42,30]
        // Source's three-size random ordering is presentation-only. Preserve
        // all three authored sizes; never use gameplay RNG for a visual lane.
        for index in stride(from: 2,through: 1,by: -1) { sizes.swapAt(index,min(index,max(0,Int(random()*Double(index+1))))) }
        var previousArrival: Double = 0
        return origins.enumerated().map { index,origin in
            let ordinal = index % 3
            let spreadAngle = random()*2 * .pi,spreadRadius = random()*5
            let start = CGPoint(x: origin.x+cos(spreadAngle)*spreadRadius,y: origin.y+sin(spreadAngle)*spreadRadius)
            let size = max(22,sizes[ordinal]+CGFloat(random()-0.5)*2.5)
            let dx = target.x-start.x,dy = target.y-start.y,distance = hypot(dx,dy)
            let factor = min(1,max(0.6,distance/800))
            let delay = ordinal == 0 ? random()*0.015 : (ordinal == 1 ? 0.055 : 0.125)+random()*0.03
            var duration = 2.15*0.65*factor+0.06+random()*0.28+Double(ordinal)*0.06
            duration = max(duration,previousArrival+0.12-delay)
            previousArrival = delay+duration
            let direction: CGFloat = random() < 0.5 ? -1 : 1
            let amplitude = 95+random()*85,frequency = 0.75+random()*0.75,phase = random()*2 * .pi
            let drift = (random()-0.5)*110,kickX = (random()-0.5)*90,kickY = -30-random()*70
            let perpendicular = atan2(dy,dx)+CGFloat.pi/2
            let points: [CGPoint] = (0...22).map { index in
                if index == 0 { return start }; if index == 22 { return target }
                let t = Double(index)/22,magnet = pow(t,1.38)
                let base = CGPoint(x: start.x+dx*magnet,y: start.y+dy*magnet)
                let primary = sin(t * .pi*frequency+phase)*amplitude*(1-t*0.58)
                let micro = sin(t * .pi*(frequency*2.2)+phase*0.65)*(amplitude*0.18)*(1-t*0.8)
                let wave = (primary+micro)*Double(direction)+drift*(1-t)*(1-t*0.35)
                let kick = max(0,1-t*2.4),ramp = pow(t,0.92)
                return CGPoint(x: base.x+(cos(perpendicular)*wave+kickX*kick)*ramp,
                               y: base.y+(sin(perpendicular)*wave+kickY*kick)*ramp)
            }
            return Self(points: points,delay: delay,duration: duration,size: size,rotation: CGFloat(12+random()*20)*direction * .pi/180)
        }
    }
    static func pathProgress(raw: CGFloat) -> CGFloat {
        let t = min(1,max(0,raw))
        if t < 0.18 { return 0.06*pow(t/0.18,2.4) }
        if t < 0.82 { return 0.06+0.78*pow((t-0.18)/0.64,1.55) }
        if t < 0.95 { return 0.84+0.145*pow((t-0.82)/0.13,0.68) }
        let p = (t-0.95)/0.05
        return 0.985+0.015*p*p*(3-2*p)
    }
    func sample(seconds: TimeInterval) -> Pose {
        let raw = CGFloat(min(1,max(0,(seconds-delay)/duration))),progress = Self.pathProgress(raw: raw)
        let position = progress*CGFloat(points.count-1),index = min(points.count-1,Int(floor(position)))
        let next = min(index+1,points.count-1),mix = position-CGFloat(index)
        let point = CGPoint(x: points[index].x+(points[next].x-points[index].x)*mix,y: points[index].y+(points[next].y-points[index].y)*mix)
        let scale = progress >= 0.9 ? size+(28-size)*(progress-0.9)/0.1 : size
        let rotate = NativeBoardMotion.Ease.sineInOut.sample(min(1,raw/0.98))
        return Pose(point: point,size: scale,rotation: rotation*rotate,arrived: progress >= 0.98)
    }
}
