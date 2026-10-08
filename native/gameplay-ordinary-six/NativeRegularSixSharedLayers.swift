import UIKit
import SpriteKit

/// PRIVATE replacement for ONLY the old shard+smoke constructor slot.
/// Multiplier/shake remain the existing separately disclosed nativeRaw owners;
/// this candidate does not claim their source root/callback admission. Shader
/// roots and common smoke independently use the injected canonical Source
/// union; the shard one-second wall timeout ignores GSAP pause as in v9.
@MainActor
final class NativeRegularSixSharedLayers {
    enum AdmissionError:Error{case stale,smokeRejected}
    let id=UUID(),generation:UInt64
    let shardLayer:SKNode
    private weak var context:NativeRegularSixSharedContext?
    private let shardResources:ShardResources
    private var shards:NativeRegularSixSharedShardOwner?,smoke:NativeSharedSmokeRootSpritePresentation?
    private var shardsDone=false,smokeDone=false,disposed=false
    var onFinished:((Bool)->Void)?
    var shardCount:Int{shardResources.activeCount}
    var activeRootCount:Int{(shards?.activeRootCount ?? 0)+(smoke?.activeRootCount ?? 0)}
    init(context:NativeRegularSixSharedContext,canvas:SKNode,tile:SKNode,origin:CGPoint,tileSize:CGFloat,
         destinationDepth:CGFloat,generation:UInt64,reduced:Bool)throws{
        guard context.canAdmit,context.current(generation),NativeSharedSmokeSpritePresentation.opaqueAncestors(canvas) else{throw AdmissionError.stale}
        self.context=context;self.generation=generation
        let pattern=context.resources.smoke.nextRegularSixPattern()
        shardResources=ShardResources(canvas:canvas,origin:origin,scale:tileSize/128,depth:destinationDepth,pool:context.resources.pool(for:pattern))
        shardLayer=shardResources.layer
        do{
            shards=try NativeRegularSixSharedShardOwner(patternIndex:pattern,reduced:reduced,generation:generation,sequence:context.nextSequence(),sourceOwnerID:context.sourceOwnerID,
                resources:shardResources,scheduler:context.scheduler,wall:context.wall,current:{[weak context] in context?.canAdmit==true && context?.current(generation)==true},
                random:{[session=context.resources.smoke] in session.nextVisualRandom()},acquireActivity:context.acquire)
            // EXACT Source callsite order: all streaming shard draws+roots,
            // then common smoke initial draws/root setup/hot, then caller shake.
            guard let smoke=context.smokeRenderer.admit(recipe:NativeSharedSmokeRecipes.regularSix(tileDepth:Double(destinationDepth),reduced:reduced),canvas:canvas,tile:tile,
                generation:generation,origin:origin,renderScale:tileSize/128,monotonicMilliseconds:context.monotonicNow(),reduced:reduced,current:{[weak context] generation in context?.canAdmit==true && context?.current(generation)==true},acquireActivity:context.acquire)else{throw AdmissionError.smokeRejected}
            self.smoke=smoke
            guard context.canAdmit,context.current(generation) else{throw AdmissionError.stale}
            shards?.onFinished={[weak self] success in self?.complete(shards:true,success:success)}
            // Preserve renderer's captured removal callback, not its dictionary
            // lifetime via a second global registry or completion replacement.
            let prior=smoke.onFinished
            smoke.onFinished={[weak self] success in prior?(success);self?.complete(shards:false,success:success)}
            guard context.retain(self,id:id) else{throw AdmissionError.stale}
        }catch{shards?.dispose();smoke?.disposeForRetirement();shardResources.releaseAll();shardResources.retireLayer();throw error}
    }
    private func complete(shards:Bool,success:Bool){
        guard !disposed else{return}
        if !success{dispose();return}
        if shards{shardsDone=true}else{smokeDone=true}
        guard shardsDone,smokeDone else{return}
        disposed=true;self.shards=nil;smoke=nil
        let callback=onFinished;onFinished=nil;context?.retire(id:id);callback?(true)
    }
    func dispose(){
        guard !disposed else{return};disposed=true
        let capturedShards=shards,capturedSmoke=smoke;shards=nil;smoke=nil
        capturedShards?.dispose();capturedSmoke?.disposeForRetirement()
        let callback=onFinished;onFinished=nil;context?.retire(id:id);callback?(false)
    }
    isolated deinit{shards?.dispose();smoke?.disposeForRetirement()}

    @MainActor private final class ShardResources:NativeRegularSixSharedShardResources{
        let layer=SKNode(),pool:NativeSharedSmokeSpritePool
        private weak var canvas:SKNode?
        private var leases:[Int:NativeSharedSmokeSpritePool.Lease]=[:],retired=false
        var activeCount:Int{leases.count}
        var admitted:Bool{!retired && canvas != nil}
        init(canvas:SKNode,origin:CGPoint,scale:CGFloat,depth:CGFloat,pool:NativeSharedSmokeSpritePool){
            self.canvas=canvas;self.pool=pool
            layer.position=origin;layer.setScale(scale);layer.zPosition=depth
        }
        func mount(){canvas?.addChild(layer)}
        func acquire(id:Int){guard !retired else{return};leases[id]=pool.acquire()}
        func configure(id:Int,points:[Double],rotation:Double,alpha:Double){
            guard let lease=leases[id],pool.isCurrent(lease)else{return}
            let path=CGMutablePath()
            for i in stride(from:0,to:points.count,by:2){let p=CGPoint(x:points[i],y:-points[i+1]);if i==0{path.move(to:p)}else{path.addLine(to:p)}}
            path.closeSubpath();lease.node.path=path
            lease.node.fillColor=UIColor(red:212/255,green:165/255,blue:132/255,alpha:1);lease.node.strokeColor = .clear
            lease.node.zRotation = -rotation;lease.node.alpha=NativeSharedSmokeSpritePresentation.sourcePackedAlpha(0.85*alpha)
            layer.addChild(lease.node)
        }
        func paintPosition(id:Int,x:Double,y:Double){guard let lease=leases[id],pool.isCurrent(lease)else{return};lease.node.position=CGPoint(x:x,y:-y)}
        func paintAlpha(id:Int,alpha:Double){guard let lease=leases[id],pool.isCurrent(lease)else{return};lease.node.alpha=NativeSharedSmokeSpritePresentation.sourcePackedAlpha(0.85*alpha)}
        func releaseAll(){for id in leases.keys.sorted(){if let lease=leases.removeValue(forKey:id){pool.release(lease)}}}
        func retireLayer(){retired=true;layer.removeFromParent()}
        isolated deinit{releaseAll();retireLayer()}
    }
}
