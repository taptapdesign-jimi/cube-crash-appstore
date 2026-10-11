import Foundation

/// Literal Source fresh-demo alpha tween. The target/from-value is captured by
/// the actual APP lazy-root delivery, never by construction or Scene polling.
public struct NativeSourceTutorialFocusPlan:Equatable,Sendable {
    public let duration:Double,delay:Double,target:Double
    public init(focused:Bool,random:()->Double) {
        duration=focused ? 0.22:0.42+random()*0.22
        delay=focused ? 0:random()*0.28
        target=focused ? 1:0.2
    }
    public init(duration:Double,delay:Double,target:Double){self.duration=duration;self.delay=delay;self.target=target}
    public func alpha(from:Double,seconds:Double)->Double {
        let t=max(0,min(1,seconds/duration)),ease=(1-cos(Double.pi*t))/2
        return from+(target-from)*ease
    }
}
