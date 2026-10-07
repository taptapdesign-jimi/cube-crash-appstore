import CoreGraphics
import Foundation

/// app-core.ts Magnet/Honey/Bottle pull. Commit occurs when every captured
/// target reaches 75% spatial convergence, independent of frame frequency.
struct NativeMagnetPullMotion {
    let start: CGPoint
    let destination: CGPoint
    let away: CGPoint
    let rotation: CGFloat
    let delay: TimeInterval
    let baseScale: CGFloat
    struct Pose { let point: CGPoint; let rotation: CGFloat; let scale: CGFloat; let converged: Bool }

    init(start: CGPoint,destination: CGPoint,tileSize: CGFloat,baseScale: CGFloat,index: Int,count: Int,
         random: () -> Double = { Double.random(in: 0..<1) }) {
        self.start = start; self.destination = destination; self.baseScale = baseScale
        let dx = start.x-destination.x,dy = start.y-destination.y,distance = hypot(dx,dy)
        away = CGPoint(x: start.x+(distance > 0 ? dx/distance : 0)*tileSize*0.63,
                       y: start.y+(distance > 0 ? dy/distance : 0)*tileSize*0.63)
        rotation = -CGFloat(10+random()*20)*(random() < 0.5 ? 1 : -1) * .pi/180
        delay = max(0,0.3+Double(index)*0.04-(index == count-1 ? 0.15 : 0))
    }
    var end: TimeInterval { delay+0.065+0.35 }
    func sample(time: TimeInterval) -> Pose {
        let local = max(0,time-delay)
        let direction = NativeBoardMotion.Ease.power2Out.sample(CGFloat(min(1,local/0.05)))
        var point = CGPoint(x: start.x+(away.x-start.x)*direction,y: start.y+(away.y-start.y)*direction)
        var angle = rotation*direction, scale = baseScale
        if local >= 0.065 {
            let progress = NativeBoardMotion.Ease.power2InOut.sample(CGFloat(min(1,(local-0.065)/0.35)))
            point = CGPoint(x: away.x+(destination.x-away.x)*progress,y: away.y+(destination.y-away.y)*progress)
            if local >= 0.135 {
                let shrink = NativeBoardMotion.Ease.power2InOut.sample(CGFloat(min(1,(local-0.135)/0.28)))
                scale = baseScale*(1-0.6*shrink)
            }
            // Source rotation-back tween begins after the scale hold segment.
            let back = NativeBoardMotion.Ease.power2InOut.sample(CGFloat(min(1,max(0,local-0.135)/0.35)))
            angle = rotation*(1-back)
        }
        let initial = hypot(start.x-destination.x,start.y-destination.y)
        let current = hypot(point.x-destination.x,point.y-destination.y)
        return Pose(point: point,rotation: angle,scale: scale,converged: time >= delay && (initial == 0 || 1-current/initial >= 0.75))
    }
}
