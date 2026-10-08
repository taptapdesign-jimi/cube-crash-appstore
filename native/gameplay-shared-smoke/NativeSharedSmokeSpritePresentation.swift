import UIKit
import SpriteKit

/// PRIVATE authored common smoke adapter. No SpriteKit action or timer.
/// Source GSAP callbacks and renderer paints are distinct supplied inputs.
@MainActor
final class NativeSharedSmokeSpritePresentation {
    enum AdmissionError:Error{case unsupportedDeferredRootOrder,unsupportedParentOpacity}
    let layer=SKNode(),generation:UInt64,recipe:NativeSharedSmokeRecipe
    let runtime:NativeSharedSmokeRuntime
    private let pool:NativeSharedSmokeSpritePool,current:(UInt64)->Bool,birthClockMs:Double
    private var puffs:[Int:NativeSharedSmokeSpritePool.Lease]=[:]
    private var halo:NativeSharedSmokeSpritePool.Lease?
    private(set) var disposed=false
    var onFinished:((Bool)->Void)?
    var onParityFailure:((String)->Void)?
    var activeNodeCount:Int{puffs.count+(halo == nil ? 0 : 1)}
    var hasInstalledClock:Bool{layer.hasActions()}
    var puffNodes:[Int:SKShapeNode]{puffs.mapValues(\.node)}
    var haloNode:SKShapeNode?{halo?.node}
    init(recipe:NativeSharedSmokeRecipe,hotFactor:Double,generation:UInt64,sequence:UInt64,
         gsapNowMs:Double,origin:CGPoint,renderScale:CGFloat,pool:NativeSharedSmokeSpritePool,
         isCurrent:@escaping(UInt64)->Bool,random:@escaping()->Double,sourceOwnerID:String="",
         acquireActivity:(NativeSharedFxReceipt)->(()->Void)?) throws {
        // Every admitted source deferred callsite uses groupedOwner. Other
        // global roots need an explicit root-order scheduler, not guessed dates.
        guard !recipe.deferFutureBursts || recipe.groupedOwner else{throw AdmissionError.unsupportedDeferredRootOrder}
        self.recipe=recipe;self.pool=pool;self.generation=generation;current=isCurrent;birthClockMs=gsapNowMs
        runtime=NativeSharedSmokeRuntime(recipe:recipe,hotFactor:hotFactor,generation:generation,sequence:sequence,gsapNowMs:gsapNowMs,random:random,sourceOwnerID:sourceOwnerID,acquireActivity:acquireActivity)
        layer.position=origin;layer.setScale(renderScale);layer.zPosition=runtime.depth
        allocateNewPuffs()
        let lease=pool.acquire(),color=recipe.haloColor ?? recipe.color
        let radius=runtime.haloRadius
        lease.node.path=CGPath(ellipseIn:CGRect(x:-radius,y:-radius,width:radius*2,height:radius*2),transform:nil)
        lease.node.fillColor=Self.color(color,alpha:1);lease.node.strokeColor = .clear
        // No blend assignment here: source halo inherits pooled Graphics blend.
        layer.insertChild(lease.node,at:0);halo=lease
        paint(gsapNowMs:gsapNowMs)
    }
    func mount(in canvas:SKNode,before tile:SKNode?=nil)throws {
        guard !disposed,current(generation) else{dispose();return}
        // Pixel alpha quantization occurs after source ancestor opacity. The
        // opaque board recipe is proven; arbitrary fade ancestors require the
        // subsequent shader bridge, not UIColor's silent alpha clamp.
        guard Self.opaqueAncestors(canvas) else{dispose();throw AdmissionError.unsupportedParentOpacity}
        if recipe.behind,let tile,tile.parent === canvas,let index=canvas.children.firstIndex(where:{$0 === tile}) {canvas.insertChild(layer,at:index)}else{canvas.addChild(layer)}
    }
    /// Advance actual GSAP-equivalent callbacks; it does not advance gameplay,
    /// renderer cadence, wall cleanup, or a separate display-link clock.
    func advance(gsapNowMs:Double){
        guard !disposed else{return}
        guard current(generation) else{finish(false);return}
        if let parent=layer.parent,!Self.opaqueAncestors(parent){onParityFailure?("shared_smoke_parent_alpha_shader_not_admitted");finish(false);return}
        let seconds=max(0,(gsapNowMs-birthClockMs)/1000)
        if recipe.ttl>0,seconds>=recipe.ttl{runtime.advance(gsapNowMs:gsapNowMs);finish(true);return}
        // Original grouped root paints/releases existing children BEFORE its
        // globally registered delayed callbacks allocate the next burst.
        for puff in runtime.puffs where seconds>=puff.finish {if let lease=puffs.removeValue(forKey:puff.id){pool.release(lease)}}
        if seconds>=0.46,let lease=halo{halo=nil;pool.release(lease)}
        runtime.advance(gsapNowMs:gsapNowMs);allocateNewPuffs()
    }
    /// Paint an already advanced source state. Repainting/reducing native
    /// presentation cadence draws no RNG and creates no resource or activity.
    func paint(gsapNowMs:Double){
        guard !disposed else{return}
        guard current(generation) else{finish(false);return}
        for(id,x,y,alpha)in runtime.sample(gsapNowMs:gsapNowMs){guard let lease=puffs[id],pool.isCurrent(lease) else{continue};lease.node.position=CGPoint(x:x,y:-y);lease.node.alpha=Self.sourcePackedAlpha(alpha)}
        if let halo,pool.isCurrent(halo){halo.node.alpha=Self.sourcePackedAlpha(runtime.haloAlpha(gsapNowMs:gsapNowMs))}
    }
    func dispose(){finish(false)}
    private func allocateNewPuffs(){
        for puff in runtime.puffs where puffs[puff.id]==nil && !runtime.releasedPuffIDs.contains(puff.id){
            let lease=pool.acquire(),node=lease.node
            node.path=CGPath(ellipseIn:CGRect(x:-puff.radiusX,y:-puff.radiusY,width:puff.radiusX*2,height:puff.radiusY*2),transform:nil)
            node.fillColor=Self.color(puff.color,alpha:1);node.strokeColor = .clear
            node.blendMode=recipe.blendMode == "add" ? .add : .alpha
            node.setScale(puff.scale);node.zRotation = -puff.rotation
            node.position=CGPoint(x:puff.sx,y:-puff.sy);node.alpha=0
            layer.addChild(node);puffs[puff.id]=lease
        }
    }
    private func finish(_ success:Bool){
        guard !disposed else{return};disposed=true
        // Captured cadence cleanup is unconditional; stale core/generation
        // validation must not precede the old scope's retirement.
        runtime.retire();puffs.values.forEach(pool.release);puffs.removeAll()
        if let halo{pool.release(halo)};halo=nil;layer.removeFromParent()
        let receipt=onFinished;onFinished=nil;onParityFailure=nil;receipt?(success && current(generation))
    }
    // Installed original Pixi BatchableGraphics.packAttributes stores the fill
    // alpha * Graphics groupAlpha as an eight-bit vertex channel. Source values
    // above1 wrap through <<24; UIColor(alpha:) would silently clamp instead.
    static func sourcePackedAlpha(_ effectiveAlpha:Double)->CGFloat{
        guard effectiveAlpha.isFinite else{return 0}
        let byte=Int64((effectiveAlpha*255).rounded(.towardZero)) & 255
        return CGFloat(byte)/255
    }
    private static func color(_ rgb:UInt32,alpha:CGFloat)->UIColor{UIColor(red:CGFloat((rgb>>16)&255)/255,green:CGFloat((rgb>>8)&255)/255,blue:CGFloat(rgb&255)/255,alpha:alpha)}
    static func opaqueAncestors(_ node:SKNode)->Bool{var n:SKNode?=node;while let candidate=n{if candidate.alpha != 1{return false};n=candidate.parent};return true}
}
