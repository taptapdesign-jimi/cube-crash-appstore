import Foundation
import CoreGraphics

/// Literal immutable-v9 contact math. Allocation/selection/draw order belongs
/// to the callsite; no random generator or clock is created here.
struct NativeRegularContactClickMotion {
    let base:CGFloat,rotation:CGFloat,duration:Double
    init(base:CGFloat,directionDraw:Double,angleDraw:Double,durationDraw:Double) {
        self.base=base
        rotation=(directionDraw<0.5 ? -1:1)*CGFloat(0.035+angleDraw*0.017)
        duration=0.13+durationDraw*0.025
    }
    var immediate:CGFloat {base+rotation}
    func sample(seconds:Double,capturedStart:CGFloat)->CGFloat {
        let e=NativeBoardMotion.Ease.backOut(2.3).sample(CGFloat(seconds/duration))
        return capturedStart+(base-capturedStart)*e
    }
}
struct NativeRegularContactNeighborMotion {
    let base:CGPoint,peak:CGPoint
    static let duration=0.16
    init(base:CGPoint,offset:CGPoint,impulseDraw:Double,renderScale:CGFloat) {
        self.base=base
        // Convert source TILE-unit displacement into the existing native
        // canvas coordinates; direction remains invariant to uniform scale.
        let length=max(renderScale,hypot(offset.x,offset.y))
        let impulse=CGFloat(1.25+impulseDraw*0.65)*renderScale
        peak=CGPoint(x:base.x+offset.x/length*impulse,y:base.y+offset.y/length*impulse)
    }
    func sample(seconds:Double)->CGPoint {
        let from:CGPoint,to:CGPoint,e:CGFloat
        if seconds<=0.055 {from=base;to=peak;e=NativeBoardMotion.Ease.power2Out.sample(CGFloat(seconds/0.055))}
        else {from=peak;to=base;e=NativeBoardMotion.Ease.backOut(2).sample(CGFloat((seconds-0.055)/0.105))}
        return CGPoint(x:from.x+(to.x-from.x)*e,y:from.y+(to.y-from.y)*e)
    }
}

struct NativeRegularContactCandidate:Equatable {
    let id:String,index:Int,position:CGPoint,destroyed:Bool,locked:Bool,special:Bool,visualPresent:Bool
    static func selected(_ candidates:[Self],destination:CGPoint,destinationID:String,sourceID:String,tileSize:CGFloat,reduced:Bool)->[Self] {
        guard !reduced else{return []}
        return candidates.filter {c in
            guard c.id != destinationID,c.id != sourceID,!c.destroyed,!c.locked,!c.special else{return false}
            let distance=hypot(c.position.x-destination.x,c.position.y-destination.y)
            return distance>0 && distance<=tileSize*1.55
        }.sorted {a,b in
            let da=hypot(a.position.x-destination.x,a.position.y-destination.y),db=hypot(b.position.x-destination.x,b.position.y-destination.y)
            return da==db ? a.index<b.index:da<db
        }.prefix(4).filter(\.visualPresent).map{$0}
    }
}
