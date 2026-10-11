import SpriteKit
import UIKit

/// Actual captured old stack children; no Source clock/service construction.
@MainActor final class NativeRegularStackFeedbackNodeBridge {
    @MainActor private final class Target:NativeRegularStackFeedbackTarget {
        weak var object:SKNode?,stack:SKNode?,tile:NativeDiceNode?,bridge:NativeRegularStackFeedbackNodeBridge?
        let generation:UInt64,revision:UInt64
        init(object:SKNode,stack:SKNode,tile:NativeDiceNode,bridge:NativeRegularStackFeedbackNodeBridge) {
            self.object=object;self.stack=stack;self.tile=tile;self.bridge=bridge;generation=tile.sourceGeneration;revision=tile.sourceStackRevision
        }
        var sourceFeedbackAlive:Bool {
            guard let bridge,let tile,let object,let stack,!bridge.disposed,tile.sourceContactNodeAlive,tile.sourceGeneration==generation,tile.sourceStackRevision==revision,object.parent === stack,tile.sourceStackContainer === stack else{return false}
            let admitted=bridge.current()
            return admitted && !bridge.disposed && tile.sourceContactNodeAlive && tile.sourceGeneration==generation && tile.sourceStackRevision==revision && object.parent === stack && tile.sourceStackContainer === stack
        }
        var sourceFeedbackRotation:Double {get{Double(-(object?.zRotation ?? 0))}set{if sourceFeedbackAlive {object?.zRotation = -newValue}}}
        var sourceFeedbackAlpha:Double {get{Double(object?.alpha ?? 0)}set{if sourceFeedbackAlive {object?.alpha=CGFloat(newValue)}}}
    }
    private weak var tile:NativeDiceNode?
    private let owner:NativeRegularStackFeedbackOwner,current:()->Bool
    private var disposed=false
    var activeRootCount:Int {owner.activeCount}
    init(tile:NativeDiceNode,service:NativeSourceAnimationClockService,current:@escaping()->Bool){self.tile=tile;self.owner=NativeRegularStackFeedbackOwner(service:service);self.current=current}
    @discardableResult func play(sourceDepth:Int,random:()->Double)->Bool {
        guard !disposed,let tile,tile.sourceContactNodeAlive,current(),!disposed,tile.sourceContactNodeAlive else{return false}
        let generation=tile.sourceGeneration,revision=tile.sourceStackRevision,stack=tile.sourceStackContainer,children=stack.children
        // Snapshot BEFORE appending any overlays, just as Array.forEach does.
        let captures=children.enumerated().map {index,node in NativeRegularStackLayerCapture(id:String(index),x:Double(node.position.x),y:Double(-node.position.y),rotation:Double(-node.zRotation),scaleX:Double(node.xScale),scaleY:Double(node.yScale))}
        return owner.start(children:captures,sourceDepth:sourceDepth,random:random,layer:{[weak self,weak tile,weak stack] capture in
            guard let self,let tile,let stack,!self.disposed,tile.sourceContactNodeAlive,tile.sourceGeneration==generation,tile.sourceStackRevision==revision,tile.sourceStackContainer === stack,let index=Int(capture.id),children.indices.contains(index),children[index].parent === stack else{return nil}
            return Target(object:children[index],stack:stack,tile:tile,bridge:self)
        },appendOverlay:{[weak self,weak tile,weak stack] capture in
            guard let self,let tile,let stack,!self.disposed,tile.sourceContactNodeAlive,tile.sourceGeneration==generation,tile.sourceStackRevision==revision,tile.sourceStackContainer === stack else{return nil}
            let overlay=SKShapeNode(rect:CGRect(x:-64,y:-64,width:128,height:128))
            overlay.name="source-stack-contact-overlay";overlay.fillColor=UIColor(red:139.0/255,green:69.0/255,blue:19.0/255,alpha:0.4);overlay.strokeColor = .clear
            overlay.position=CGPoint(x:capture.x,y:-capture.y);overlay.zRotation = -capture.rotation;overlay.xScale=capture.scaleX;overlay.yScale=capture.scaleY;overlay.zPosition = -1
            stack.addChild(overlay)
            return Target(object:overlay,stack:stack,tile:tile,bridge:self)
        },removeOverlay:{target in
            // The captured old object may already be removed by face RAF. This
            // callback never looks up/removes a newer child by label or tile ID.
            (target as? Target)?.object?.removeFromParent()
        })
    }
    func dispose(){guard !disposed else{return};disposed=true;tile=nil;owner.dispose()}
    isolated deinit {dispose()}
}
