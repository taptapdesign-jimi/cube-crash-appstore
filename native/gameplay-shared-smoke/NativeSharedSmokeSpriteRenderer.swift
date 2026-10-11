import SpriteKit

/// PRIVATE app-lived selected source bridge. It consumes no independent hot
/// history and installs no tick. GSAP advancement and native paint are distinct.
@MainActor
final class NativeSharedSmokeSpriteRenderer {
    let pool:NativeSharedSmokeSpritePool
    private var owners:[NativeSharedSmokeSpritePresentation]=[],sequence:UInt64=0
    private let sourceOwnerID=UUID().uuidString
    var activeOwnerCount:Int{owners.count}
    init(pool:NativeSharedSmokeSpritePool){self.pool=pool}
    @discardableResult
    func admit(recipe:NativeSharedSmokeRecipe,board:SKNode?,tile:SKNode?,generation:UInt64,
               gsapNowMs:Double,sourceElapsedMs:Double,origin:CGPoint,renderScale:CGFloat,
               reducedBoardFx:Bool,isCurrent:@escaping(UInt64)->Bool,
               random:@escaping()->Double,
               consumeHotFactor:(Double,Bool)->Double,
               acquireActivity:(NativeSharedFxReceipt)->(()->Void)?)->NativeSharedSmokeSpritePresentation? {
        // Same source bailout boundary: no accepted board/tile => no thermal
        // hot-history update, draw, resource allocation or cadence acquisition.
        guard let board,let tile,isCurrent(generation),NativeSharedSmokeSpritePresentation.opaqueAncestors(board),
              !recipe.deferFutureBursts || recipe.groupedOwner else{return nil}
        sequence += 1
        let hot=consumeHotFactor(sourceElapsedMs,reducedBoardFx)
        guard let owner=try? NativeSharedSmokeSpritePresentation(recipe:recipe,hotFactor:hot,generation:generation,sequence:sequence,gsapNowMs:gsapNowMs,origin:origin,renderScale:renderScale,pool:pool,isCurrent:isCurrent,random:random,sourceOwnerID:sourceOwnerID,acquireActivity:acquireActivity) else{return nil}
        do{try owner.mount(in:board,before:tile)}catch{owner.dispose();return nil}
        owners.append(owner);return owner
    }
    func advance(gsapNowMs:Double){
        // Installed original GSAP global roots keep registration order. Do not
        // reorder simultaneous overdue callbacks by owner deadline/cell/depth.
        for owner in owners{owner.advance(gsapNowMs:gsapNowMs)}
        owners.removeAll{$0.disposed}
    }
    func paint(gsapNowMs:Double){for owner in owners{owner.paint(gsapNowMs:gsapNowMs)};owners.removeAll{$0.disposed}}
    func cleanup(tag:String){for owner in owners where owner.recipe.fxTag==tag{owner.dispose()};owners.removeAll{$0.disposed}}
    func retireGeneration(_ generation:UInt64){for owner in owners where owner.generation==generation{owner.dispose()};owners.removeAll{$0.disposed}}
    func dispose(){owners.forEach{$0.dispose()};owners.removeAll()}
}
