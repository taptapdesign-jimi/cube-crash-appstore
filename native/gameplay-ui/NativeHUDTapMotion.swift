import Foundation

/// Authored NAV_ICON_TAP_BOUNCE timing, with user-selected 30% stronger amplitude. Caller owns the clock.
enum NativeHUDTapMotion {
    static let duration=0.22
    static let squeezeScale=1-0.08*1.3
    static let popScale=1+0.06*1.3
    static func ease(_ progress:Double)->Double {
        if progress<=0{return 0};if progress>=1{return 1}
        func coordinate(_ t:Double,_ a:Double,_ b:Double)->Double {
            let inverse=1-t
            return 3*inverse*inverse*t*a+3*inverse*t*t*b+t*t*t
        }
        var lower=0.0,upper=1.0
        for _ in 0..<12 {
            let candidate=(lower+upper)/2
            if coordinate(candidate,0.34,0.64)<progress {lower=candidate}else{upper=candidate}
        }
        return coordinate((lower+upper)/2,1.56,1)
    }
    static func scale(at elapsed:Double)->Double {
        if elapsed<=0{return 1};if elapsed>=duration{return 1}
        if elapsed<0.077{return 1+(squeezeScale-1)*ease(elapsed/0.077)}
        if elapsed<0.154{return squeezeScale+(popScale-squeezeScale)*ease((elapsed-0.077)/0.077)}
        return popScale+(1-popScale)*ease((elapsed-0.154)/0.066)
    }
}
