import UIKit

/// The preserved app-paper-background.ts composition. One fixed viewport
/// owner remains behind the gameplay canvas throughout entry and shake.
@MainActor
final class NativeAppPaperSurface:UIView {
    static let base=UIColor(red:243/255,green:238/255,blue:232/255,alpha:1)
    private let gradient=CAGradientLayer()
    init(artwork:JimiV9Artwork) {
        super.init(frame:.zero)
        accessibilityIdentifier="native-canonical-paper"
        backgroundColor=Self.base;isUserInteractionEnabled=false
        gradient.colors=[Self.base.cgColor,UIColor(red:252/255,green:236/255,blue:223/255,alpha:1).cgColor,UIColor(red:252/255,green:236/255,blue:223/255,alpha:1).cgColor]
        gradient.locations=[0,0.6,1];layer.addSublayer(gradient)
        let texture=UIImageView(image:artwork.image("assets/paper-bg.png"))
        texture.contentMode = .scaleToFill;texture.autoresizingMask=[.flexibleWidth,.flexibleHeight];addSubview(texture)
        let tint=UIView();tint.backgroundColor=Self.base.withAlphaComponent(0.4)
        tint.autoresizingMask=[.flexibleWidth,.flexibleHeight];addSubview(tint)
    }
    required init?(coder:NSCoder){fatalError("Use original artwork")}
    override func layoutSubviews() {
        super.layoutSubviews()
        CATransaction.begin();CATransaction.setDisableActions(true);gradient.frame=bounds;CATransaction.commit()
        for child in subviews {child.frame=bounds}
    }
}
