import Foundation

enum NativeTransitionInterpolation {
    struct Pose:Equatable {
        var x=0.0,y=0.0,sx=1.0,sy=1.0,opacity=1.0,rotation=0.0
        func mixing(_ to:Pose,_ p:Double)->Pose {
            Pose(x:x+(to.x-x)*p,y:y+(to.y-y)*p,sx:sx+(to.sx-sx)*p,sy:sy+(to.sy-sy)*p,opacity:opacity+(to.opacity-opacity)*p,rotation:rotation+(to.rotation-rotation)*p)
        }
    }
    enum Ease {case linear,sineOut,sineIn,sineInOut,powerIn(Int),powerOut(Int),backIn(Double),backOut(Double)
        func value(_ value:Double)->Double {
            let p=min(1,max(0,value));if p==0||p==1{return p}
            switch self {
            case .linear:return p
            case .sineOut:return sin(p*Double.pi/2)
            case .sineIn:return 1-cos(p*Double.pi/2)
            case .sineInOut:return (1-cos(p*Double.pi))/2
            case .powerIn(let power):return pow(p,Double(power+1))
            case .powerOut(let power):return 1-pow(1-p,Double(power+1))
            case .backIn(let strength):return p*p*((strength+1)*p-strength)
            case .backOut(let strength):let a=p-1;return 1+a*a*((strength+1)*a+strength)
            }
        }
    }
    struct Frame {let duration:Double,to:Pose,ease:Ease}
    struct Track {
        let initial:Pose,frames:[Frame]
        var duration:Double{frames.reduce(0){$0+$1.duration}}
        func sample(_ age:Double)->Pose {
            guard age>=0 else{return initial};var remaining=age,from=initial
            for frame in frames {if remaining<frame.duration{return from.mixing(frame.to,frame.ease.value(remaining/frame.duration))};remaining -= frame.duration;from=frame.to}
            return from
        }
    }
    static func clamp(_ p:Double)->Double{min(1,max(0,p))}
    static func smooth(_ p:Double)->Double{let p=clamp(p);return p*p*(3-2*p)}
    static func between(_ low:Double,_ high:Double,random:()->Double)->Double {let value=random();return low+(high-low)*(value.isFinite ? min(1,max(0,value)):0.5)}
}
