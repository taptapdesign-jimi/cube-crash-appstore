import UIKit
import SpriteKit

/// PRIVATE projection of the source-tested per-root controller. It owns no
/// animation clock, array-tick, GSAP root approximation or gameplay callback.
@MainActor
final class NativeSharedSmokeRootSpritePresentation {
    let layer:SKNode,generation:UInt64,recipe:NativeSharedSmokeRecipe
    private let resources:SpriteResources,owner:NativeSharedSmokeRootOwner
    var disposed:Bool{owner.disposed}
    var activeRootCount:Int{owner.activeRootCount}
    var activeNodeCount:Int{resources.activeNodeCount}
    var onFinished:((Bool)->Void)? {get{owner.onFinished}set{owner.onFinished=newValue}}
    var onParityFailure:((String)->Void)? {get{owner.onParityFailure}set{owner.onParityFailure=newValue}}
    init(recipe:NativeSharedSmokeRecipe,generation:UInt64,sequence:UInt64,sourceOwnerID:String,
         canvas:SKNode,tile:SKNode,origin:CGPoint,renderScale:CGFloat,
         pool:NativeSharedSmokeSpritePool,scheduler:any NativeSharedSmokeRootScheduler,
         sourceClockNowMilliseconds:()->Double,isCurrent:@escaping(UInt64)->Bool,
         random:@escaping()->Double,consumeHotFactor:()->Double,
         acquireActivity:(NativeSharedFxReceipt)->(()->Void)?)throws {
        // Validate before source resources/clock/hot/RNG. The owner repeats
        // this admission so direct consumers receive the same closed behavior.
        guard !recipe.deferFutureBursts else{throw NativeSharedSmokeRootOwner.AdmissionError.deferredNotProven}
        guard recipe.ttl>0,recipe.ttl.isFinite else{throw NativeSharedSmokeRootOwner.AdmissionError.unboundedLifetime}
        guard isCurrent(generation),NativeSharedSmokeSpritePresentation.opaqueAncestors(canvas) else{throw NativeSharedSmokeRootOwner.AdmissionError.staleResources}
        self.recipe=recipe;self.generation=generation
        resources=SpriteResources(recipe:recipe,canvas:canvas,tile:tile,origin:origin,renderScale:renderScale,pool:pool)
        layer=resources.layer
        owner=try NativeSharedSmokeRootOwner(recipe:recipe,generation:generation,sequence:sequence,sourceOwnerID:sourceOwnerID,
            resources:resources,scheduler:scheduler,sourceClockNow:sourceClockNowMilliseconds,current:{isCurrent(generation)},random:random,
            consumeHot:consumeHotFactor,acquireActivity:acquireActivity)
    }
    func dispose(){owner.dispose()}

    /// Resource identities are captured per call, including old pool leases;
    /// no old animation callback can resolve a newly reused node by index.
    @MainActor private final class SpriteResources:NativeSharedSmokeRootResources {
        let layer=SKNode(),recipe:NativeSharedSmokeRecipe,pool:NativeSharedSmokeSpritePool
        private weak var canvas:SKNode?,tile:SKNode?
        private var puffs:[Int:NativeSharedSmokeSpritePool.Lease]=[:],halo:NativeSharedSmokeSpritePool.Lease?
        private var retired=false
        var isAdmitted:Bool {guard !retired,let canvas,(layer.parent == nil || layer.parent === canvas) else{return false};return NativeSharedSmokeSpritePresentation.opaqueAncestors(canvas)}
        var activeNodeCount:Int{puffs.count+(halo==nil ? 0:1)}
        init(recipe:NativeSharedSmokeRecipe,canvas:SKNode,tile:SKNode,origin:CGPoint,renderScale:CGFloat,pool:NativeSharedSmokeSpritePool){
            self.recipe=recipe;self.canvas=canvas;self.tile=tile;self.pool=pool
            layer.position=origin;layer.setScale(renderScale);layer.zPosition=recipe.behind ? recipe.tileDepth-0.001:recipe.zIndex
        }
        func mountLayer(){
            guard let canvas,let tile else{return}
            if recipe.behind,tile.parent === canvas,let index=canvas.children.firstIndex(where:{$0===tile}){canvas.insertChild(layer,at:index)}else{canvas.addChild(layer)}
        }
        func acquirePuff(id:Int){puffs[id]=pool.acquire()}
        func configurePuff(_ puff:NativeSharedSmokeRootValues.Puff){
            guard let lease=puffs[puff.id],pool.isCurrent(lease) else{return}
            let node=lease.node
            node.path=CGPath(ellipseIn:CGRect(x:-puff.radiusX,y:-puff.radiusY,width:puff.radiusX*2,height:puff.radiusY*2),transform:nil)
            node.fillColor=Self.color(puff.color);node.strokeColor = .clear
            node.blendMode=recipe.blendMode=="add" ? .add:.alpha
            node.setScale(puff.scale);node.zRotation = -puff.rotation
            node.position=CGPoint(x:puff.sx,y:-puff.sy);node.alpha=0;layer.addChild(node)
        }
        func paintPuff(id:Int,x:Double,y:Double,alpha:Double){guard let lease=puffs[id],pool.isCurrent(lease) else{return};lease.node.position=CGPoint(x:x,y:-y);lease.node.alpha=NativeSharedSmokeSpritePresentation.sourcePackedAlpha(alpha)}
        func releasePuff(id:Int){if let lease=puffs.removeValue(forKey:id){pool.release(lease)}}
        func acquireHalo(radius:Double,color:UInt32,fillAlpha:Double){
            let lease=pool.acquire();halo=lease
            lease.node.path=CGPath(ellipseIn:CGRect(x:-radius,y:-radius,width:radius*2,height:radius*2),transform:nil)
            lease.node.fillColor=Self.color(color);lease.node.strokeColor = .clear;lease.node.alpha=0
            layer.insertChild(lease.node,at:0)
        }
        func paintHalo(alpha:Double){if let halo,pool.isCurrent(halo){halo.node.alpha=NativeSharedSmokeSpritePresentation.sourcePackedAlpha(alpha)}}
        func releaseHalo(){if let halo{pool.release(halo)};halo=nil}
        func retireLayer(){guard !retired else{return};retired=true;layer.removeFromParent()}
        isolated deinit {
            if let halo{pool.release(halo)}
            for id in puffs.keys.sorted(){if let lease=puffs[id]{pool.release(lease)}}
            layer.removeFromParent()
        }
        private static func color(_ rgb:UInt32)->UIColor{UIColor(red:CGFloat((rgb>>16)&255)/255,green:CGFloat((rgb>>8)&255)/255,blue:CGFloat(rgb&255)/255,alpha:1)}
    }
}
