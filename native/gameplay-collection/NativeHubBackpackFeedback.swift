import UIKit

/// The current source Hub Backpack is intentionally a visual contact only.
/// Its image receives the shared former-heart bounce; it opens no new route.
@MainActor
final class NativeHubBackpackFeedback {
    private weak var button:UIButton?
    private var active=false,disposed=false
    private(set) var generation=0
    private(set) var acceptedContacts=0
    static let animationKey="native.hub.backpack-bounce"
    init(button:UIButton){self.button=button}
    func setActive(_ value:Bool,generation:Int) {
        guard !disposed,generation>=self.generation else{return}
        if generation != self.generation || !value {cancel()}
        self.generation=generation;active=value
    }
    @discardableResult
    func activate(generation:Int)->Bool {
        guard !disposed,active,generation==self.generation,let button,!button.isHidden,button.isEnabled else{return false}
        let target=button.imageView ?? button
        target.layer.removeAnimation(forKey:Self.animationKey)
        CATransaction.begin();CATransaction.setDisableActions(true);target.layer.transform=CATransform3DIdentity;CATransaction.commit()
        let animation=CAKeyframeAnimation(keyPath:"transform")
        animation.values=(0...220).map{NSValue(caTransform3D:CATransform3DMakeScale(Self.scale(at:Double($0)/1000),Self.scale(at:Double($0)/1000),1))}
        animation.keyTimes=(0...220).map{NSNumber(value:Double($0)/220)};animation.duration=0.22;animation.isRemovedOnCompletion=true
        target.layer.add(animation,forKey:Self.animationKey);acceptedContacts += 1;return true
    }
    static func scale(at seconds:Double)->Double {
        let t=max(0,min(0.22,seconds)),start:Double,end:Double,p:Double
        if t<=0.077 {start=1;end=0.92;p=t/0.077}
        else if t<=0.154 {start=0.92;end=1.06;p=(t-0.077)/0.077}
        else {start=1.06;end=1;p=(t-0.154)/0.066}
        return start+(end-start)*ease(p)
    }
    /// Same twelve-step inversion as nav-icon-bounce.ts.
    static func ease(_ progress:Double)->Double {
        if progress<=0{return 0};if progress>=1{return 1}
        func coordinate(_ t:Double,_ a:Double,_ b:Double)->Double {let inverse=1-t;return 3*inverse*inverse*t*a+3*inverse*t*t*b+t*t*t}
        var lower=0.0,upper=1.0
        for _ in 0..<12 {let candidate=(lower+upper)/2;if coordinate(candidate,0.34,0.64)<progress {lower=candidate}else{upper=candidate}}
        return coordinate((lower+upper)/2,1.56,1)
    }
    private func cancel(){guard let button else{return};let target=button.imageView ?? button;target.layer.removeAnimation(forKey:Self.animationKey);CATransaction.begin();CATransaction.setDisableActions(true);target.layer.transform=CATransform3DIdentity;CATransaction.commit()}
    func dispose(){guard !disposed else{return};disposed=true;active=false;cancel();button=nil}
}
