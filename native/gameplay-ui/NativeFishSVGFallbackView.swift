import UIKit

/// Original embedded-frame fallback, with the source SMIL transforms applied
/// by the accepted native board clock. No WebView and no independent ticker.
@MainActor
final class NativeFishSVGFallbackView:UIView {
    private var resources:NativeFishSVGFallbackResources?
    private let image=CALayer()
    private var frameIndex:Int?
    init(resources:NativeFishSVGFallbackResources) {
        self.resources=resources
        super.init(frame:CGRect(origin:.zero,size:NativeFishIdlePresentation.logicalMediaSize))
        backgroundColor = .clear;isUserInteractionEnabled=false;clipsToBounds=true
        image.anchorPoint = .zero;image.position = .zero;image.bounds=CGRect(x:0,y:0,width:128,height:128);image.contentsGravity = .resize
        layer.addSublayer(image);paint(seconds:0)
    }
    required init?(coder:NSCoder){fatalError("Use original source resources")}
    func paint(seconds:Double) {
        guard let resources else {return}
        let pose=resources.sample(seconds:seconds),scale:CGFloat=128.0/224
        let transform=CGAffineTransform(translationX:(24+pose.x)*scale,y:(28+pose.y)*scale)
            .translatedBy(x:resources.pivot.x*scale,y:resources.pivot.y*scale)
            .rotated(by:pose.rotation).scaledBy(x:pose.scaleX,y:pose.scaleY)
            .translatedBy(x:-resources.pivot.x*scale,y:-resources.pivot.y*scale)
        CATransaction.begin();CATransaction.setDisableActions(true)
        if frameIndex != pose.frame {frameIndex=pose.frame;image.contents=resources.frames[pose.frame]}
        image.setAffineTransform(transform);CATransaction.commit()
    }
    var currentFrame:Int? {frameIndex}
    var currentTransform:CGAffineTransform {image.affineTransform()}
    func dispose() {resources=nil;image.contents=nil;frameIndex=nil;image.removeFromSuperlayer();removeFromSuperview()}
}
