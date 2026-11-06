import UIKit

/// Layout-only policy. Each existing surface retains its own input, motion,
/// resource and save owners; no scaled screenshot or additional render clock.
enum NativeTabletLayout {
    static func applies(_ size:CGSize)->Bool {size.width>=600 && size.height>=850 && size.height>size.width}
    // Full-screen authored effects use the phone's390pt canvas. Uniformly
    // project its lengths and trajectories, retaining the tablet aspect ratio.
    static func animationScale(_ size:CGSize)->CGFloat {applies(size) ? size.width/390:1}
    static func animationViewport(_ size:CGSize)->CGSize {
        let scale=animationScale(size)
        return scale==1 ? size:CGSize(width:390,height:size.height/scale)
    }
    static func animationPoint(_ point:CGPoint,viewport:CGSize)->CGPoint {
        let scale=animationScale(viewport)
        return scale==1 ? point:CGPoint(x:point.x/scale,y:point.y/scale)
    }
    @MainActor static func projectAnimation(_ animation:UIView,viewport:CGSize) {
        guard applies(viewport) else{return}
        let scale=animationScale(viewport)
        animation.autoresizingMask=[]
        animation.bounds=CGRect(origin:.zero,size:animationViewport(viewport))
        animation.center=CGPoint(x:viewport.width/2,y:viewport.height/2)
        animation.transform=CGAffineTransform(scaleX:scale,y:scale)
    }
    static func smokeSpriteBoost(_ size:CGSize)->CGFloat {
        // Phone smoke gains another10% after its previous20% and30% increases; tablet retains
        // its accepted sizing. Core TNT already owns its1.4*1.2*1.2
        // enlargement AND the full-width scene projection.
        applies(size) ? (1.694*1.2*1.30*0.80*0.80)/(1.4*1.2*1.2*animationScale(size)):0.80*1.20*1.30*1.10
    }
    static func smokeVerticalOffset(_ size:CGSize)->CGFloat {applies(size) ? animationViewport(size).height*0.1:0}
    static func tntSmokeVerticalOffset(_ size:CGSize)->CGFloat {
        // SpriteKit Y points up. Convert the20pt screen-space lift once.
        -smokeVerticalOffset(size)+(applies(size) ? 20/animationScale(size):0)
    }
    // Match the current iPad navigation icon factor with one whole-modal
    // projection. All inner dimensions remain the authored390pt phone recipe.
    static func settingsPaperCornerRadius(_ viewport:CGSize)->CGFloat {applies(viewport) ? 24:22}
    @MainActor static func paperCornerRadius(in surface:UIView)->CGFloat {
        var root=surface,ancestor:UIView?=surface,projected=false
        while let view=ancestor {root=view;if view is NativeModalProjectionView {projected=true};ancestor=view.superview}
        let viewport=surface.window?.bounds.size ?? root.bounds.size
        return settingsPaperCornerRadius(viewport)/(projected ? modalScale(viewport):1)
    }
    static func modalScale(_ size:CGSize)->CGFloat {applies(size) ? 1.4:1}
    // Modal titles stay32pt on screen, independent of the paper projection.
    static func modalTitleSize(_ viewport:CGSize,phone:CGFloat)->CGFloat {
        applies(viewport) ? 32/modalScale(viewport):phone
    }
    @MainActor static func modalBounds(in host:UIView,card:UIView,referenceWidth:CGFloat=390,isolatesDepth:Bool=false)->CGRect {
        guard applies(host.bounds.size) else {
            if let old=card.superview as? NativeModalProjectionView {
                host.insertSubview(card,aboveSubview:old);old.removeFromSuperview()
                sharpenModalText(in:card,scale:host.window?.screen.scale ?? host.traitCollection.displayScale)
            }
            return host.bounds
        }
        let projection:NativeModalProjectionView
        if let current=card.superview as? NativeModalProjectionView {
            projection=current
            if current.superview !== host {host.addSubview(current)}
        }
        else {
            projection=isolatesDepth ? NativeIsolatedModalProjectionView(frame:.zero):NativeModalProjectionView(frame:.zero)
            let index=host.subviews.firstIndex(where:{$0 === card}) ?? host.subviews.count
            host.insertSubview(projection,at:index);projection.addSubview(card)
        }
        let scale=modalScale(host.bounds.size)
        projection.bounds=CGRect(x:0,y:0,width:referenceWidth,height:host.bounds.height/scale)
        projection.center=CGPoint(x:host.bounds.midX,y:host.bounds.midY)
        projection.transform=CGAffineTransform(scaleX:scale,y:scale)
        sharpenModalText(in:card,scale:max(1,host.window?.screen.scale ?? host.traitCollection.displayScale)*scale)
        return projection.bounds
    }
    @MainActor private static func sharpenModalText(in view:UIView,scale:CGFloat) {
        // Only static UIKit glyph layers; preview/Metal/SpriteKit/media retain
        // their own drawable budgets and selected-resource policies.
        if view is UILabel || view is UITextView {
            if abs(view.contentScaleFactor-scale)>0.001 {view.contentScaleFactor=scale;view.setNeedsDisplay()}
        }
        for child in view.subviews {sharpenModalText(in:child,scale:scale)}
    }
    @MainActor static func modalSafeInsets(in host:UIView)->UIEdgeInsets {
        let scale=modalScale(host.bounds.size),insets=host.safeAreaInsets
        return UIEdgeInsets(top:insets.top/scale,left:insets.left/scale,bottom:insets.bottom/scale,right:insets.right/scale)
    }
    @MainActor static func modalProjectionScale(of card:UIView)->CGFloat {
        card.superview is NativeModalProjectionView ? abs(card.superview!.transform.a):1
    }
    static func textScale(_ size:CGSize)->CGFloat {applies(size) ? 1.15:1}
    static func settingsWidth(_ size:CGSize)->CGFloat {
        collectionWidth(size,crate:false)
    }
    static func navigationSideInset(_ size:CGSize)->CGFloat {
        (size.width-settingsWidth(size))/2+(applies(size) ? 32:24)
    }
    static func paperWidth(_ size:CGSize,padding:CGFloat=80)->CGFloat {
        min(applies(size) ? 500:390,max(0,size.width-padding))
    }
    static func worldFrame(_ bounds:CGRect)->CGRect {
        guard applies(bounds.size) else{return bounds}
        let width=min(680,bounds.width-64)
        return CGRect(x:bounds.midX-width/2,y:bounds.minY,width:width,height:bounds.height)
    }
    static func journeyScale(_ size:CGSize)->CGFloat {
        min(applies(size) ? 1.35:1,max(0,(size.width-40)/326),max(0,(size.height-96)/481.76))
    }
    static func collectionWidth(_ size:CGSize,crate:Bool)->CGFloat {
        applies(size) ? min(744,size.width-48):size.width
    }
    static func collectionColumns(_ size:CGSize,crate:Bool,phoneColumns:Int)->Int {
        applies(size) ? 3:phoneColumns
    }
    @MainActor static func labelFont(_ label:UILabel,size:CGFloat) {
        guard abs(label.font.pointSize-size)>0.001 else{return}
        let ratio=size/label.font.pointSize,font=label.font.withSize(size)
        if let source=label.attributedText {
            let text=NSMutableAttributedString(attributedString:source)
            source.enumerateAttribute(.paragraphStyle,in:NSRange(location:0,length:source.length)) { value,range,_ in
                if let paragraph=(value as? NSParagraphStyle)?.mutableCopy() as? NSMutableParagraphStyle {
                    paragraph.minimumLineHeight*=ratio;paragraph.maximumLineHeight*=ratio
                    text.addAttribute(.paragraphStyle,value:paragraph,range:range)
                }
            }
            text.addAttribute(.font,value:font,range:NSRange(location:0,length:text.length));label.attributedText=text
        }
        label.font=font
    }
    @MainActor static func buttonFont(_ button:UIButton,size:CGFloat) {
        guard let label=button.titleLabel,abs(label.font.pointSize-size)>0.001 else{return}
        let font=label.font.withSize(size)
        if let source=button.attributedTitle(for:.normal) {
            let text=NSMutableAttributedString(attributedString:source)
            text.addAttribute(.font,value:font,range:NSRange(location:0,length:text.length));button.setAttributedTitle(text,for:.normal)
        }
        labelFont(label,size:size)
    }
}

/// Static geometry only; preserve descendant3D planes and existing clocks.
@MainActor private class NativeModalProjectionView:UIView {
    override class var layerClass:AnyClass {CATransformLayer.self}
    override func hitTest(_ point:CGPoint,with event:UIEvent?)->UIView? {
        let hit=super.hitTest(point,with:event)
        return hit === self ? nil:hit // Blank projected canvas still reaches backdrop.
    }
}

/// Flatten only at the modal boundary so its internal flip cannot cross the dimmer.
@MainActor private final class NativeIsolatedModalProjectionView:NativeModalProjectionView {
    override class var layerClass:AnyClass {CALayer.self}
}
