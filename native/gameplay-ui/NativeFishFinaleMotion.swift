import Foundation
import CoreGraphics

/// Exact source fish-finale-swimmer.ts plan and sampler in top-left coordinates.
struct NativeFishFinaleMotion {
    static let duration: TimeInterval = 2.4
    let origin: CGPoint
    let end: CGPoint
    let direction: CGFloat
    let mediaSize = CGSize(width: 272.0*128/224*0.975,height: 280.0*128/224*0.975)
    struct Pose { let point: CGPoint; let rotation: CGFloat; let scale: CGFloat; let alpha: CGFloat }
    init(origin: CGPoint,viewport: CGSize) {
        self.origin = origin; direction = origin.x <= viewport.width/2 ? 1 : -1
        end = CGPoint(x: direction == 1 ? viewport.width+mediaSize.width/2+24 : -mediaSize.width/2-24,
                      y: origin.y <= viewport.height/2 ? viewport.height+mediaSize.height/2+24 : -mediaSize.height/2-24)
    }
    private func point(_ progress: CGFloat) -> CGPoint {
        func cubic(_ a: CGFloat,_ b: CGFloat) -> CGFloat {
            let t = min(1,max(0,progress)),r = 1-t
            return 3*r*r*t*a+3*r*t*t*b+t*t*t
        }
        return CGPoint(x: origin.x+(end.x-origin.x)*cubic(0.20,0.72),y: origin.y+(end.y-origin.y)*cubic(0.08,0.90))
    }
    func sample(seconds: TimeInterval) -> Pose {
        let time = min(Self.duration,max(0,seconds)),p = CGFloat(time/Self.duration)
        let previous = point(max(0,p-0.002)),next = point(min(1,p+0.002))
        let heading = atan2(next.y-previous.y,next.x-previous.x)*180 / .pi
        let relative = direction == 1 ? heading : heading >= 0 ? heading-180 : heading+180
        let emerge = NativeBoardMotion.Ease.backOut(1.70158).sample(CGFloat(min(1,time/0.22)))
        let pulse = sin(time * .pi*2/0.5625)*0.035*sin(.pi*Double(p))
        return Pose(point: point(p),rotation: min(20,max(-20,relative*0.55+CGFloat(pulse)*55)),
                    scale: max(0.18,0.18+0.82*emerge+CGFloat(pulse)),alpha: CGFloat(min(1,max(0,(Self.duration-time)/0.12))))
    }
}
