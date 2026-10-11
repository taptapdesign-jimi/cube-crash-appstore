import SpriteKit
import StackToSixGameplay

/// PRIVATE literal Source contact companions, injected into one Scene. Existing
/// APP session supplies the same visual random stream to click, impact, recoil
/// and smoke. Existing canonical Source drivers supply all finite roots.
@MainActor final class NativeRegularContactSceneCompanions {
    @MainActor private final class Target:NativeRegularContactTarget {
        weak var node:SKNode?,tile:NativeDiceNode?,parent:SKNode?
        let contactTileID:String,contactGeneration:UInt64,contactIdentity:ObjectIdentifier
        init(node:SKNode,tile:NativeDiceNode,generation:UInt64){self.node=node;self.tile=tile;parent=node.parent;contactTileID=tile.tileID;contactGeneration=generation;contactIdentity=ObjectIdentifier(node)}
        var contactAlive:Bool {node != nil && node?.parent === parent && parent != nil && tile?.sourceContactNodeAlive==true && tile?.sourceGeneration==contactGeneration}
        var contactRotation:CGFloat {get{-(node?.zRotation ?? 0)}set{if contactAlive{node?.zRotation = -newValue}}}
        var contactPosition:CGPoint {
            get {let p=node === tile?.visual ? tile?.sourceInnerPosition:node?.position;return CGPoint(x:p?.x ?? 0,y:-(p?.y ?? 0))}
            set {guard contactAlive else{return};let p=CGPoint(x:newValue.x,y:-newValue.y);if node === tile?.visual {tile?.sourceInnerPosition=p}else{node?.position=p}}
        }
    }
    private let session:NativeSharedSmokeRootSession,smoke:NativeSharedSmokeRootRenderer
    private let motion:NativeRegularContactPresentationOwner,now:()->Double
    private var disposed=false
    var activeMotionCount:Int {motion.activeCount}
    init(session:NativeSharedSmokeRootSession,smoke:NativeSharedSmokeRootRenderer,tween:NativeDragTweenDriver,timeline:NativeTileOuterTimelineDriver,monotonicMillisecondsNow:@escaping()->Double){self.session=session;self.smoke=smoke;motion=NativeRegularContactPresentationOwner(tween:tween,timeline:timeline);now=monotonicMillisecondsNow}
    func nextVisualRandom()->Double {session.nextVisualRandom()}
    func ready(canvas:SKNode,target:NativeDiceNode,generation:UInt64)->Bool {
        !disposed && target.sourceContactNodeAlive && target.sourceGeneration==generation && target.parent === canvas && NativeSharedSmokeSpritePresentation.opaqueAncestors(canvas)
    }
    @discardableResult func prefix(destination:NativeDiceNode,generation:UInt64)->Bool {
        guard !disposed,destination.sourceContactNodeAlive,destination.sourceGeneration==generation else{return false}
        guard let layer=destination.sourceContactLastStackLayer else{return true} // literal no layer: zero click draws
        return motion.click(target:Target(node:layer,tile:destination,generation:generation),random:{[session] in session.nextVisualRandom()})
    }
    @discardableResult func suffix(source:NativeDiceNode,destination:NativeDiceNode,tiles:[NativeTile],nodes:[String:NativeDiceNode],destroyedTileIDs:Set<String>=[],canvas:SKNode,generation:UInt64,tileSize:CGFloat,renderScale:CGFloat,reduced:Bool,current:@escaping(UInt64)->Bool)->Bool {
        guard ready(canvas:canvas,target:destination,generation:generation),current(generation) else{return false}
        let candidates=tiles.enumerated().map{index,tile -> NativeRegularContactCandidate in
            let node=nodes[tile.id]
            return .init(id:tile.id,index:index,position:node?.position ?? CGPoint(x:CGFloat(tile.cell.column)*tileSize,y:-CGFloat(tile.cell.row)*tileSize),destroyed:destroyedTileIDs.contains(tile.id) || node?.sourceContactNodeAlive==false,locked:tile.locked,special:tile.isWild || tile.variant != nil,visualPresent:node != nil)
        }
        let selected=NativeRegularContactCandidate.selected(candidates,destination:destination.position,destinationID:destination.tileID,sourceID:source.tileID,tileSize:tileSize,reduced:reduced)
        for candidate in selected {
            guard let node=nodes[candidate.id],ready(canvas:canvas,target:destination,generation:generation),current(generation) else{return false}
            let offset=CGPoint(x:(node.position.x-destination.position.x)/renderScale,y:-(node.position.y-destination.position.y)/renderScale)
            guard motion.neighbor(target:Target(node:node.visual,tile:node,generation:generation),offset:offset,renderScale:1,random:{[session] in session.nextVisualRandom()},killOtherVisualTweens:{[weak node] in node?.sourceKillInnerContactTweens()}) else{return false}
        }
        // Actual target center/depth on canvas, captured before synchronous hot
        // and puff allocations. regularStack is unlabelled in Source.
        let origin=canvas.convert(CGPoint.zero,from:destination),depth=Double(destination.zPosition)
        return smoke.admit(recipe:NativeSharedSmokeRecipes.regularStack(tileDepth:depth,reduced:reduced),canvas:canvas,tile:destination,generation:generation,origin:origin,renderScale:renderScale,monotonicMilliseconds:now(),reduced:reduced,current:{[weak self] generation in self?.disposed==false && current(generation)},acquireActivity:{_ in nil}) != nil
    }
    func pointerDown(_ node:NativeDiceNode){if node.variant != "spaceship" {motion.interruptTarget(ObjectIdentifier(node.visual))}}
    func retire(generation:UInt64){motion.retire(generation:generation);smoke.retire(generation:generation)}
    func dispose(){guard !disposed else{return};disposed=true;motion.dispose();smoke.dispose()}
    isolated deinit {dispose()}
}
