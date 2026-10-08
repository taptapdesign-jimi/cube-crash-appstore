import Foundation

struct NativeTileOuterMotion {
    struct Pose { let position: CGPoint; let scale: CGPoint; let rotation: CGFloat }
    enum Kind { case pickup, snapBack }
    let kind: Kind
    let base: CGPoint
    let from: CGPoint
    let target: CGPoint
    let rotation: CGFloat
    var duration: Double { kind == .pickup ? 0.13 : 0.285 }
    static func canonicalBase(cached: CGPoint?, live: CGPoint) -> CGPoint {
        func usable(_ p: CGPoint) -> Bool { p.x.isFinite && p.y.isFinite && p.x > 0 && p.y > 0 && abs(p.x-p.y) <= 0.005 }
        if let cached, usable(cached) { return cached }
        return usable(live) ? live : CGPoint(x: 1,y: 1)
    }
    private func back(_ t: CGFloat,_ s: CGFloat) -> CGFloat { let x=t-1;return 1+x*x*((s+1)*x+s) }
    private func mix(_ a: CGFloat,_ b: CGFloat,_ t: CGFloat) -> CGFloat {a+(b-a)*t}
    func sample(_ seconds: Double) -> Pose {
        let time=max(0,min(duration,seconds))
        if kind == .pickup {
            let scale: CGPoint
            if time <= 0.055 {
                let t=CGFloat(time/0.055),e=1-pow(1-t,4)
                scale=CGPoint(x:mix(base.x,base.x*1.13,e),y:mix(base.y,base.y*1.09,e))
            } else {
                let e=back(CGFloat((time-0.055)/0.075),2.2)
                scale=CGPoint(x:mix(base.x*1.13,base.x*1.105,e),y:mix(base.y*1.09,base.y*1.105,e))
            }
            return Pose(position:from,scale:scale,rotation:rotation)
        }
        let move=back(CGFloat(min(1,time/0.18)),1.65)
        let scale: CGPoint
        if time<=0.13 {
            let t=CGFloat(time/0.13),e=t*t*t
            scale=CGPoint(x:mix(base.x,base.x*1.035,e),y:mix(base.y,base.y*0.965,e))
        } else if time<=0.18 {scale=CGPoint(x:base.x*1.035,y:base.y*0.965)}
        else {
            let e=back(CGFloat((time-0.18)/0.105),2.5)
            scale=CGPoint(x:mix(base.x*1.035,base.x,e),y:mix(base.y*0.965,base.y,e))
        }
        return Pose(position:CGPoint(x:mix(from.x,target.x,move),y:mix(from.y,target.y,move)),scale:scale,rotation:mix(rotation,0,move))
    }
}

// Caller delivers through the existing scene clock; this value installs no clock.
struct NativeTileOuterOwnership {
    private var current: [NativeTileOuterReceipt.Kind: NativeTileOuterReceipt] = [:]
    func receipt(for kind: NativeTileOuterReceipt.Kind) -> NativeTileOuterReceipt? { current[kind] }
    mutating func replace(_ receipt: NativeTileOuterReceipt) -> NativeTileOuterReceipt? { current.updateValue(receipt,forKey:receipt.kind) }
    @discardableResult mutating func retire(_ receipt: NativeTileOuterReceipt) -> Bool {
        guard current[receipt.kind] == receipt else { return false }
        current.removeValue(forKey:receipt.kind);return true
    }
    mutating func retireAll() -> [NativeTileOuterReceipt] {let captured=Array(current.values);current.removeAll();return captured}
    var flags: NativeTileOuterEligibility.Owners {
        var value=NativeTileOuterEligibility.Owners()
        value.mergeImpact=current[.mergeImpact] != nil;value.pickupScale=current[.pickupScale] != nil;value.snapBack=current[.snapBack] != nil
        return value
    }
    var idleTimelinePresent: Bool {current[.idle] != nil}
}
