import Foundation

/// Coordinate conversion of original Pixi HUD root. No clock or lifecycle owner.
enum NativeHUDTransitionMotion {
    struct Pose {
        let offset: Double
        let alpha: Double
    }
    static let dropDuration=0.8
    static let riseDuration=0.3
    static func drop(at elapsed:Double)->Pose {
        let t=min(1,max(0,elapsed/dropDuration))
        let eased:Double
        if t==0 || t==1 {eased=t} else {
            let period=0.6,shift=period/4
            eased=pow(2,-10*t)*sin((t-shift)*2 * .pi/period)+1
        }
        return Pose(offset:140*(1-eased),alpha:eased)
    }
    static func rise(at elapsed:Double,top:Double,from:Pose)->Pose {
        let t=min(1,max(0,elapsed/riseDuration)),eased=t*t*t
        return Pose(offset:from.offset+(3*top-from.offset)*eased,alpha:from.alpha*(1-eased))
    }
}
