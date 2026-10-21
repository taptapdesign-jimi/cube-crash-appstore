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
    /// Shared icon contact borrows the alert's active squash/stretch bounce,
    /// compressed into one0.4s track without its idle pause or notification tilt.
    static func play(on target:UIView){
        guard !UIAccessibility.isReduceMotionEnabled else{return}
        let painted=target.layer.presentation()?.transform ?? CATransform3DIdentity
        target.layer.removeAnimation(forKey:animationKey)
        let poses=NativeHUDTapMotion.poses
        let motion=CAKeyframeAnimation(keyPath:"transform")
        motion.values=poses.enumerated().map{index,pose in
            if index==0{return NSValue(caTransform3D:painted)}
            let (x,y,offset)=(CGFloat(pose.x),CGFloat(pose.y),CGFloat(pose.offset))
            return NSValue(caTransform3D:CATransform3DScale(CATransform3DMakeTranslation(0,offset,0),x,y,1))
        }
        motion.keyTimes=NativeHUDTapMotion.phases.map{NSNumber(value:$0)}
        motion.duration=NativeHUDTapMotion.duration
        motion.timingFunctions=Array(repeating:CAMediaTimingFunction(name:.easeInEaseOut),count:5)
        motion.beginTime=target.layer.convertTime(CACurrentMediaTime(),from:nil)
        target.layer.add(motion,forKey:animationKey)
    }
    static let switchKey="native.backpack.icon-switch"
    /// Same finite contact bounce as the gameplay HUD; the image child remains
    /// independent of its navigation header's outgoing route transform.
    static func switchArtwork(on button:UIButton,open:Bool,assets:JimiV9Artwork,delay:TimeInterval=0,crate:Bool=false) {
        let path=crate ? (open ? "assets/hud/crate-open.png":"assets/hud/crate - hud.png"):(open ? "assets/nav/stats-nav-open.png":"assets/nav/stats-nav.png")
        guard let image=assets.image(path,densityAware:true) else{return}
        let target=button.imageView ?? button
        let previous=button.image(for:.normal)
        let aligned:UIImage
        if open && !crate {
            // Both originals are 64px. Match the closed backpack's painted
            // body bounds while retaining the open lid and original pixels.
            let format=UIGraphicsImageRendererFormat();format.scale=image.scale
            aligned=UIGraphicsImageRenderer(size:image.size,format:format).image{_ in
                image.draw(in:CGRect(x:image.size.width*3.6/64,y:image.size.height*1.1/64,width:image.size.width*0.949,height:image.size.height*0.949))
            }
        }else{aligned=image}
        button.setImage(aligned,for:.normal)
        guard !UIAccessibility.isReduceMotionEnabled else{target.layer.removeAnimation(forKey:switchKey);return}
        target.layer.removeAnimation(forKey:animationKey)
        let bounce=CAKeyframeAnimation(keyPath:"transform")
        bounce.values=NativeHUDTapMotion.poses.map{pose in NSValue(caTransform3D:CATransform3DScale(CATransform3DMakeTranslation(0,pose.offset,0),pose.x,pose.y,1))}
        bounce.keyTimes=NativeHUDTapMotion.phases.map{NSNumber(value:$0)}
        bounce.timingFunctions=Array(repeating:CAMediaTimingFunction(name:.easeInEaseOut),count:5)
        bounce.duration=NativeHUDTapMotion.duration
        let contents=CAKeyframeAnimation(keyPath:"contents")
        contents.values=[previous?.cgImage ?? aligned.cgImage!,aligned.cgImage!,aligned.cgImage!];contents.keyTimes=[0,0.0001,1];contents.calculationMode = .discrete;contents.duration=NativeHUDTapMotion.duration
        let group=CAAnimationGroup();group.animations=[bounce,contents];group.duration=0.4
        group.fillMode = .backwards
        group.beginTime=target.layer.convertTime(CACurrentMediaTime(),from:nil)+max(0,delay)
        target.layer.add(group,forKey:switchKey)
    }
    private func cancel(){guard let button else{return};let target=button.imageView ?? button;target.layer.removeAnimation(forKey:Self.animationKey);CATransaction.begin();CATransaction.setDisableActions(true);target.layer.transform=CATransform3DIdentity;CATransaction.commit()}
    func dispose(){guard !disposed else{return};disposed=true;active=false;cancel();button=nil}
}

/// Pass-through outside the actual CTA, including when its button is hidden.
@MainActor
final class NativeCartoonBounceSurface:UIView {
    override func hitTest(_ point:CGPoint,with event:UIEvent?)->UIView? {
        guard !isHidden,alpha>0.01,isUserInteractionEnabled else{return nil}
        for child in subviews.reversed(){if let hit=child.hitTest(convert(point,to:child),with:event){return hit}}
        return nil
    }
}
