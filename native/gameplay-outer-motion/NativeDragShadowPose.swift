import Foundation
import CoreGraphics

/// Literal immutable-v9 drag-shadow-pose helpers in Source logical coordinates.
struct NativeDragShadowPose:Equatable {
    let position:CGPoint
    let appearanceScale:CGFloat
    let alpha:CGFloat
    static func resolve(direction:CGPoint,tilt:CGFloat,tileSize:CGFloat=128)->Self {
        let valid=tilt.isFinite && tileSize.isFinite && tileSize>0
        let center=valid ? CGPoint(x:-sin(tilt)*tileSize*0.5,y:-tileSize*0.5+cos(tilt)*tileSize*0.5):.zero
        let length=hypot(direction.x,direction.y)
        let distance=direction.x.isFinite && direction.y.isFinite && tileSize.isFinite && tileSize>0 && length>0 ? tileSize*0.1:0
        let shift=length.isFinite && length>0 ? CGPoint(x:direction.x/length*distance,y:direction.y/length*distance):.zero
        let strength=tilt.isFinite ? max(0,min(1,abs(tilt)/0.16)):0
        return Self(position:CGPoint(x:center.x+shift.x,y:center.y+shift.y),appearanceScale:1+0.08*strength,alpha:0.18)
    }
    static func center(tilt:CGFloat,tileSize:CGFloat=128)->CGPoint {
        guard tilt.isFinite,tileSize.isFinite,tileSize>0 else{return .zero}
        return CGPoint(x:-sin(tilt)*tileSize*0.5,y:-tileSize*0.5+cos(tilt)*tileSize*0.5)
    }
}
struct NativeDragShadowDirection {
    private(set) var cast=CGPoint(x:0,y:1)
    mutating func update(filteredVelocity:CGPoint) {
        if hypot(filteredVelocity.x,filteredVelocity.y)>0.01 {cast=CGPoint(x:-filteredVelocity.x,y:-filteredVelocity.y)}
    }
    mutating func reset(){cast=CGPoint(x:0,y:1)}
}
struct NativeDragScalarTween {
    enum Curve {case power2Out,backOut18}
    let start:CGFloat,target:CGFloat,duration:Double,curve:Curve
    func sample(_ seconds:Double)->CGFloat {
        let t=CGFloat(max(0,min(1,seconds/duration)))
        let e:CGFloat
        switch curve {
        case .power2Out:e=1-pow(1-t,3)
        case .backOut18:let u=t-1;e=1+u*u*(2.8*u+1.8)
        }
        return start+(target-start)*e
    }
}
