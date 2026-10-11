import Foundation

/// Literal gameplay-tile-cartoon-motion('stack') plus the next Source RNG draw.
struct NativeMergeImpactMotion {
    let squash:Bool,variation:Double
    init(variantDraw:Double,variationDraw:Double) {
        squash=variantDraw.isFinite && variantDraw>=0.5
        variation=0.97+variationDraw*0.06
    }
    var duration:Double {0.465*variation}
    func sample(_ seconds:Double)->CGPoint {
        let base:[CGPoint]=squash ? [CGPoint(x:0.95,y:1.055),CGPoint(x:1.1,y:0.96),CGPoint(x:0.985,y:1.025)]:[CGPoint(x:1.06,y:0.95),CGPoint(x:0.965,y:1.1),CGPoint(x:1.025,y:0.985)]
        let poses=[CGPoint(x:1,y:1)]+base.map{CGPoint(x:1+($0.x-1)*1.3,y:1+($0.y-1)*1.3)}+[CGPoint(x:1,y:1)]
        let durations=[0.065,0.09,0.13,0.18],eases:[NativeBoardMotion.Ease]=[.power2Out,.backOut(1.65),.power2Out,.backOut(1.9)]
        var start=0.0;let time=max(0,min(duration,seconds))
        for i in durations.indices {
            let end=start+durations[i]*variation
            if time<=end {let e=eases[i].sample(CGFloat((time-start)/(end-start)));return CGPoint(x:poses[i].x+(poses[i+1].x-poses[i].x)*e,y:poses[i].y+(poses[i+1].y-poses[i].y)*e)}
            start=end
        }
        return poses.last!
    }
}
