import UIKit

/// The preserved app-paper-background.ts composition. One fixed viewport
/// owner remains behind the gameplay canvas throughout entry and shake.
@MainActor
final class NativeAppPaperSurface:UIView {
    static let base=UIColor(red:243/255,green:238/255,blue:232/255,alpha:1)
    private let gradient=CAGradientLayer()
    private let textureBottomExtension:CGFloat
    init(artwork:JimiV9Artwork,textureBottomExtension:CGFloat=24) {
        self.textureBottomExtension=max(0,textureBottomExtension)
        super.init(frame:.zero)
        accessibilityIdentifier="native-canonical-paper"
        backgroundColor=Self.base;isUserInteractionEnabled=false;clipsToBounds=true
        gradient.colors=[Self.base.cgColor,UIColor(red:252/255,green:236/255,blue:223/255,alpha:1).cgColor,UIColor(red:252/255,green:236/255,blue:223/255,alpha:1).cgColor]
        gradient.locations=[0,0.6,1];layer.addSublayer(gradient)
        let texture=UIImageView(image:artwork.image("assets/paper-bg.png"))
        texture.contentMode = .scaleAspectFill;texture.autoresizingMask=[.flexibleWidth,.flexibleHeight];addSubview(texture)
        let tint=UIView();tint.backgroundColor=Self.base.withAlphaComponent(0.4)
        tint.autoresizingMask=[.flexibleWidth,.flexibleHeight];addSubview(tint)
    }
    static func textureFrame(imageSize:CGSize,bounds:CGRect,bottomExtension:CGFloat=24)->CGRect {
        guard imageSize.width>0,imageSize.height>0 else{return bounds}
        let scale=max(bounds.width/imageSize.width,(bounds.height+max(0,bottomExtension))/imageSize.height)
        let size=CGSize(width:imageSize.width*scale,height:imageSize.height*scale)
        return CGRect(x:bounds.midX-size.width/2,y:bounds.minY,width:size.width,height:size.height)
    }
    required init?(coder:NSCoder){fatalError("Use original artwork")}
    override func layoutSubviews() {
        super.layoutSubviews()
        CATransaction.begin();CATransaction.setDisableActions(true);gradient.frame=bounds;CATransaction.commit()
        for child in subviews {
            // Keep the authored lower folds below the viewport, including the home indicator.
            if let texture=child as? UIImageView,let image=texture.image {
                texture.frame=Self.textureFrame(imageSize:image.size,bounds:bounds,bottomExtension:textureBottomExtension)
            } else {child.frame=bounds}
        }
    }
}
