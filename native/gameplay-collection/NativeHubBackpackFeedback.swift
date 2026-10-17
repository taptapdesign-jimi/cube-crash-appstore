import UIKit

/// Finite image-only navigation feedback, independent of parent route motion.
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
        Self.play(on:button.imageView ?? button)
        acceptedContacts += 1;return true
    }
    /// Call after route cancellation so outgoing parent motion cannot erase contact.
    /// Core Animation retires this finite track; repeated taps replace only this key.
    static func play(on target:UIView) {
        guard !UIAccessibility.isReduceMotionEnabled else{return}
        CATransaction.begin();CATransaction.setDisableActions(true)
        target.layer.removeAnimation(forKey:animationKey)
        let animation=CAKeyframeAnimation(keyPath:"transform.scale")
        animation.values=(0...220).map{NSNumber(value:scale(at:Double($0)/1000))}
        animation.keyTimes=(0...220).map{NSNumber(value:Double($0)/220)}
        animation.duration=0.22;animation.isRemovedOnCompletion=true
        // Pin contact to input time. A zero beginTime starts only when a
        // deferred/hidden layer is next committed, replaying on modal return.
        animation.beginTime=target.layer.convertTime(CACurrentMediaTime(),from:nil)
        target.layer.add(animation,forKey:animationKey)
        CATransaction.commit()
    }
    static func scale(at seconds:Double)->Double {NativeHUDTapMotion.scale(at:seconds)}
    static func ease(_ progress:Double)->Double {NativeHUDTapMotion.ease(progress)}
    private func cancel(){guard let button else{return};let target=button.imageView ?? button;target.layer.removeAnimation(forKey:Self.animationKey);CATransaction.begin();CATransaction.setDisableActions(true);target.layer.transform=CATransform3DIdentity;CATransaction.commit()}
    func dispose(){guard !disposed else{return};disposed=true;active=false;cancel();button=nil}
}
