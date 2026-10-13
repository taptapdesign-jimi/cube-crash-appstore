import UIKit

/// Sampling policy for the reward's continuously tilted original artwork.
/// Keep Core Animation's live transforms; do not flatten the card into a
/// cached bitmap whose resolution becomes stale during reveal and drag.
@MainActor
enum NativeRewardCardRendering {
    static func configure(faces:[UIView],images:[UIImageView],displayScale:CGFloat) {
        for face in faces {
            face.layer.allowsEdgeAntialiasing=true
            face.layer.edgeAntialiasingMask=[.layerLeftEdge,.layerRightEdge,.layerTopEdge,.layerBottomEdge]
            face.layer.contentsScale=max(1,displayScale)
        }
        for image in images {
            image.layer.allowsEdgeAntialiasing=true
            image.layer.edgeAntialiasingMask=[.layerLeftEdge,.layerRightEdge,.layerTopEdge,.layerBottomEdge]
            image.layer.contentsScale=max(1,displayScale)
            image.layer.minificationFilter = .trilinear
            image.layer.magnificationFilter = .linear
        }
    }
}
