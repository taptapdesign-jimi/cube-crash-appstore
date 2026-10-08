import SpriteKit

/// PRIVATE opt-in constructor dependency. Captures the same app RNG stream
/// for shader→common-smoke→shake, rather than accepting unrelated closures.
/// Caller lifecycle/global-pause and Source RNG-domain admission remain gated.
@MainActor
final class NativeRegularSixSharedSlot{
    let context:NativeRegularSixSharedContext
    private weak var canvas:SKNode?,tile:SKNode?
    init(context:NativeRegularSixSharedContext,canvas:SKNode,tile:SKNode){self.context=context;self.canvas=canvas;self.tile=tile}
    func make(origin:CGPoint,tileSize:CGFloat,destinationDepth:CGFloat,generation:UInt64,reduced:Bool)throws->NativeRegularSixSharedLayers{
        guard let canvas,let tile else{throw NativeRegularSixSharedLayers.AdmissionError.stale}
        return try .init(context:context,canvas:canvas,tile:tile,origin:origin,tileSize:tileSize,destinationDepth:destinationDepth,generation:generation,reduced:reduced)
    }
    func nextRandom()->Double{context.resources.smoke.nextVisualRandom()}
}
