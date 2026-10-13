import UIKit
import SpriteKit
import MetalKit

/// Controller policy belongs to the mounted surface; Scene code reads the
/// corresponding render-host receipt rather than assuming a SpriteKit view.
@MainActor
protocol NativeGameplaySurfaceControl: AnyObject {
    var surfaceFrameRate: Int { get set }
    var surfacePaused: Bool { get set }
    var renderedScene: SKScene? { get }
    @discardableResult func presentGameplayScene(_ scene: NativeBoardScene?)->Bool
}

extension SKView: NativeGameplaySurfaceControl {
    var surfaceFrameRate:Int { get{preferredFramesPerSecond} set{preferredFramesPerSecond=newValue} }
    var surfacePaused:Bool { get{isPaused} set{isPaused=newValue} }
    @discardableResult func presentGameplayScene(_ scene: NativeBoardScene?)->Bool {
        presentScene(scene);return self.scene === scene
    }
}

extension NativeOwnedMetalGameplayView: NativeGameplaySurfaceControl {
    var surfaceFrameRate:Int { get{preferredFramesPerSecond} set{preferredFramesPerSecond=newValue} }
    var surfacePaused:Bool { get{renderingPaused} set{renderingPaused=newValue} }
    @discardableResult func presentGameplayScene(_ scene: NativeBoardScene?)->Bool { presentScene(scene) }
}
