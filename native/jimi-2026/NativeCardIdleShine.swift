import UIKit
import CoreImage

/// The original New Reward interim sheen: brighten the selected original, then
/// reveal it through one diagonal traveling alpha band. No per-frame filtering.
nonisolated enum NativeCardSheenRecipe {
    static func pixels(_ image:CGImage,cancelled:()->Bool)->CGImage? {
        guard !cancelled() else{return nil}
        let input=CIImage(cgImage:image).applyingFilter("CIColorControls",parameters:[kCIInputSaturationKey:1.06])
            .applyingFilter("CIColorMatrix",parameters:["inputRVector":CIVector(x:1.65,y:0,z:0,w:0),"inputGVector":CIVector(x:0,y:1.65,z:0,w:0),"inputBVector":CIVector(x:0,y:0,z:1.65,w:0)])
        let context=CIContext(options:[.cacheIntermediates:false])
        let image=context.createCGImage(input,from:input.extent)
        context.clearCaches()
        return cancelled() ? nil:image
    }
    @MainActor static func configure(_ band:CAGradientLayer,size:CGSize) {
        band.colors=[0.0,0.06,0.35,1,0.35,0.06,0].map{UIColor(white:1,alpha:$0).cgColor}
        band.locations=[0,0.18,0.38,0.5,0.62,0.82,1]
        band.startPoint=CGPoint(x:0,y:0.2);band.endPoint=CGPoint(x:1,y:0.8)
        band.bounds=CGRect(x:0,y:0,width:size.width*1.12,height:size.height)
        band.position=CGPoint(x:-size.width*0.26,y:size.height/2);band.opacity=0
    }
    @MainActor static func animation(width:CGFloat)->CAAnimationGroup {
        let sweep=CABasicAnimation(keyPath:"position.x")
        sweep.fromValue = -width*0.26;sweep.toValue=width*1.26;sweep.duration=1.05
        sweep.timingFunction=CAMediaTimingFunction(name:.easeInEaseOut)
        let glow=CAKeyframeAnimation(keyPath:"opacity")
        glow.values=[0,1,1,0];glow.keyTimes=[0,0.12,0.86,1];glow.duration=1.05
        let pass=CAAnimationGroup();pass.animations=[sweep,glow];pass.duration=3;pass.repeatCount = .infinity
        pass.fillMode = .backwards
        return pass
    }
}
nonisolated final class NativeCardShineLease:@unchecked Sendable {
    private let lock=NSLock();private var retired=false
    var cancelled:Bool {lock.lock();defer{lock.unlock()};return retired}
    func cancel(){lock.lock();retired=true;lock.unlock()}
}
nonisolated enum NativeCardShinePreparation {
    private static let queue=DispatchQueue(label:"stacktosix.card-idle-shine",qos:.userInitiated)
    static func prepare(_ image:CGImage,lease:NativeCardShineLease,completion:@escaping @MainActor @Sendable (CGImage?)->Void) {
        queue.async {
            guard let pixels=NativeCardSheenRecipe.pixels(image,cancelled:{lease.cancelled}),!lease.cancelled else{return}
            Task { @MainActor in guard !lease.cancelled else{return};completion(pixels) }
        }
    }
}

/// One visible illustrated modal face owns two compositor layers and at most one
/// full-density sheen image. Flip/background/retirement cancel and drop pixels.
@MainActor final class NativeCardIdleShine {
    typealias Prepare=@MainActor (CGImage,NativeCardShineLease,@escaping @MainActor @Sendable (CGImage?)->Void)->Void
    let layer=CALayer(),band=CAGradientLayer()
    private weak var front:UIImageView?
    private var source:CGImage?
    private var lease:NativeCardShineLease?
    private var visible=false,disposed=false
    private let prepare:Prepare
    private let reducedMotion:@MainActor ()->Bool
    private(set) var decodedBytes=0
    init(front:UIImageView,prepare:@escaping Prepare=NativeCardShinePreparation.prepare,reducedMotion:@escaping @MainActor ()->Bool={UIAccessibility.isReduceMotionEnabled}) {
        self.front=front;self.prepare=prepare;self.reducedMotion=reducedMotion
        layer.name="modal.card.idle-shine";band.name="modal.card.idle-shine.band"
        layer.contentsGravity = .resizeAspect;layer.opacity=0;layer.isDoubleSided=false
        layer.allowsEdgeAntialiasing=true;layer.shouldRasterize=false;layer.minificationFilter = .trilinear
        layer.mask=band
    }
    func layout() {
        guard !disposed,let front else{return}
        CATransaction.begin();CATransaction.setDisableActions(true)
        layer.frame=front.bounds;layer.contentsScale=front.window?.screen.scale ?? front.traitCollection.displayScale
        NativeCardSheenRecipe.configure(band,size:front.bounds.size)
        CATransaction.commit()
        guard visible else{return}
        if source !== front.image?.cgImage {setVisible(true)}
    }
    func setVisible(_ value:Bool) {
        guard !disposed else{return}
        guard value,!reducedMotion(),let front,front.window != nil,let image=front.image?.cgImage else{stop();return}
        if visible,source === image {return}
        stop();visible=true;source=image
        front.layer.addSublayer(layer);layout()
        let token=NativeCardShineLease();lease=token
        prepare(image,token) { [weak self] pixels in
            guard let self,!self.disposed,self.visible,self.lease === token,!token.cancelled,
                  self.front?.image?.cgImage === image,!self.reducedMotion(),let pixels else{return}
            CATransaction.begin();CATransaction.setDisableActions(true)
            self.layer.contents=pixels;self.decodedBytes=pixels.bytesPerRow*pixels.height;self.layer.opacity=0.72
            let pass=NativeCardSheenRecipe.animation(width:self.layer.bounds.width)
            pass.beginTime=self.band.convertTime(CACurrentMediaTime(),from:nil)
            self.band.add(pass,forKey:"modal.card.idle-shine")
            CATransaction.commit()
        }
    }
    private func stop() {
        visible=false;lease?.cancel();lease=nil;source=nil;decodedBytes=0
        CATransaction.begin();CATransaction.setDisableActions(true)
        band.removeAllAnimations();layer.removeAllAnimations();layer.opacity=0;layer.contents=nil;layer.removeFromSuperlayer()
        CATransaction.commit()
    }
    func dispose(){guard !disposed else{return};stop();disposed=true;layer.mask=nil;front=nil}
}
