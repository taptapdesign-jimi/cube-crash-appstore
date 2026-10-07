import UIKit

/// Source bottom-pivot breath/cartoon accent, renewed once per complete cycle.
struct NativeKantaIdleMotion {
    static let cycle:TimeInterval=4.79
    let squash:Bool
    func sample(seconds:TimeInterval)->CGPoint {
        let segments:[(TimeInterval,CGPoint,NativeBoardMotion.Ease)]=[
            (1.2,CGPoint(x:0.992,y:1.012),.sineInOut),(1.2,CGPoint(x:1,y:1),.sineInOut),
            (0.1,CGPoint(x:1.0175,y:0.9825),.power2In),
            (0.2,squash ? CGPoint(x:1.05,y:0.9775):CGPoint(x:0.98,y:1.0525),.backOut(2.5)),
            (0.13,squash ? CGPoint(x:0.985,y:1.035):CGPoint(x:1.0375,y:0.97),.power2In),
            (0.14,CGPoint(x:0.9925,y:1.0125),.power2Out),(0.22,CGPoint(x:1,y:1),.backOut(1.7))]
        var time=max(0,seconds),from=CGPoint(x:1,y:1)
        for (duration,to,ease) in segments {
            if time <= duration {let p=ease.sample(CGFloat(time/duration));return CGPoint(x:from.x+(to.x-from.x)*p,y:from.y+(to.y-from.y)*p)}
            time-=duration;from=to
        }
        return CGPoint(x:1,y:1)
    }
    static func centerCorrection(width:CGFloat)->CGFloat {
        let left=min(8-width/2,-width*0.4-width*0.7/2),right=max(8+width/2,-width*0.4+width*0.7/2)
        return -(left+right)/2
    }
    static func rearReveal(seconds:TimeInterval)->CGFloat {
        var time=max(0,seconds-0.12)
        if time<=0.18 {return 0.12+(1.26-0.12)*NativeBoardMotion.Ease.backOut(3.4).sample(CGFloat(time/0.18))}
        time-=0.18
        if time<=0.08 {return 1.26+(0.86-1.26)*NativeBoardMotion.Ease.power2InOut.sample(CGFloat(time/0.08))}
        time-=0.08
        if time<=0.22 {return 0.86+(1-0.86)*NativeBoardMotion.Ease.backOut(1.7).sample(CGFloat(time/0.22))}
        return 1
    }
}
