import UIKit
import SpriteKit

/// PRIVATE selected vector resources; caller supplies the existing clock.
/// Each reuse gets a new captured lease identity even on the same SKShapeNode.
@MainActor
final class NativeSharedSmokeSpritePool {
    final class Lease {
        let resource:NativeSharedFxResourcePool.Resource
        let node:SKShapeNode
        let sequence:UInt64
        fileprivate var released=false
        fileprivate init(resource:NativeSharedFxResourcePool.Resource,node:SKShapeNode,sequence:UInt64){self.resource=resource;self.node=node;self.sequence=sequence}
    }
    private let values=NativeSharedFxResourcePool()
    private var nodes:[UInt64:SKShapeNode]=[:],active:[UInt64:Lease]=[:],sequence:UInt64=0
    var poolSize:Int{values.poolSize}
    var retainedNodeCount:Int{nodes.count}
    var activeCount:Int{active.count}
    var created:Int{values.created}
    var reused:Int{values.reused}
    func acquire()->Lease {
        let resource=values.acquire()
        let node=nodes[resource.id] ?? SKShapeNode()
        nodes[resource.id]=node
        // GraphicsPool clears actual geometry and transforms, preserving blend.
        node.removeAllActions();node.removeFromParent();node.path=nil
        node.fillColor = .clear;node.strokeColor = .clear;node.lineWidth=0
        node.position = .zero;node.zRotation=0;node.xScale=1;node.yScale=1
        node.alpha=1;node.isHidden=false;node.zPosition=0
        node.isUserInteractionEnabled=false;node.name=nil
        sequence += 1
        let lease=Lease(resource:resource,node:node,sequence:sequence)
        active[resource.id]=lease
        return lease
    }
    func isCurrent(_ lease:Lease)->Bool{!lease.released && active[lease.resource.id] === lease}
    func release(_ lease:Lease){
        guard isCurrent(lease) else{return}
        lease.released=true;active.removeValue(forKey:lease.resource.id)
        lease.node.removeAllActions();lease.node.isHidden=true;lease.node.removeFromParent()
        lease.node.path=nil;lease.node.fillColor = .clear;lease.node.strokeColor = .clear
        // The source pool does not reset blendMode. Remember actual selected
        // style so a later halo inherits its old resource's blend.
        lease.resource.blendMode=lease.node.blendMode == .add ? "add" : "normal"
        values.release(lease.resource)
        if lease.resource.destroyed {nodes.removeValue(forKey:lease.resource.id)}
    }
    @discardableResult func prewarm(to target:Int)->Int {
        values.prewarm(to:target)
        for resource in values.resourcesInPool where nodes[resource.id]==nil {
            let node=SKShapeNode();node.strokeColor = .clear;node.lineWidth=0
            nodes[resource.id]=node
        }
        return poolSize
    }
}
