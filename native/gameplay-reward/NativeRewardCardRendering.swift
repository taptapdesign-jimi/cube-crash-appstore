import UIKit

/// Keep the selected reward's artwork and effect masks at display density.
/// Live transforms must not inherit a low-resolution flattened bitmap.
@MainActor
enum NativeRewardCardRendering {
    static func configure(faces:[UIView],images:[UIImageView],displayScale:CGFloat) {
        for face in faces {configure(layer:face.layer,displayScale:displayScale)}
        for image in images {configure(layer:image.layer,displayScale:displayScale)}
    }
    private static func configure(layer:CALayer,displayScale:CGFloat) {
        layer.allowsEdgeAntialiasing=true
        layer.edgeAntialiasingMask=[.layerLeftEdge,.layerRightEdge,.layerTopEdge,.layerBottomEdge]
        layer.contentsScale=max(1,displayScale)
        layer.shouldRasterize=false
        layer.minificationFilter = .trilinear
        layer.magnificationFilter = .linear
        for child in layer.sublayers ?? [] {configure(layer:child,displayScale:displayScale)}
        if let mask=layer.mask {configure(layer:mask,displayScale:displayScale)}
    }
}
