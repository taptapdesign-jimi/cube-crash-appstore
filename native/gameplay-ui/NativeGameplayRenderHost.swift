import UIKit
import SpriteKit

/// Actual mounted renderer capability. A Scene never borrows a hidden SKView
/// to manufacture attachment, input coordinates or a presentation receipt.
@MainActor protocol NativeGameplayRenderHost:AnyObject {
    var renderView:UIView {get}
    var renderedScene:SKScene? {get}
    var renderingPaused:Bool {get}
    var renderingFPS:Int {get}
    func scenePointToView(_ point:CGPoint,scene:SKScene)->CGPoint
    func viewPointToScene(_ point:CGPoint,scene:SKScene)->CGPoint
}

extension SKView:NativeGameplayRenderHost {
    var renderView:UIView {self}
    var renderedScene:SKScene? {scene}
    var renderingPaused:Bool {isPaused}
    var renderingFPS:Int {preferredFramesPerSecond}
    func scenePointToView(_ point:CGPoint,scene:SKScene)->CGPoint {convert(point,from:scene)}
    func viewPointToScene(_ point:CGPoint,scene:SKScene)->CGPoint {convert(point,to:scene)}
}
