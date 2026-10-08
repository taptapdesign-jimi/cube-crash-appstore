import SpriteKit

/// PRIVATE app-lived source-FX session. Origin/hot/pool/pattern/random are
/// injected once at app boot and survive board routes. Clock lives elsewhere;
/// this owner never manufactures an activity label or recurring transport.
@MainActor
final class NativeSharedSmokeRootSession {
    let appOriginMilliseconds:Double,pool=NativeSharedSmokeSpritePool()
    private var hot=NativeSharedSmokeHotCadence(),pattern=0
    private let random:()->Double
    init(appOriginMilliseconds:Double,visualRandom:@escaping()->Double){self.appOriginMilliseconds=appOriginMilliseconds;random=visualRandom}
    func nextVisualRandom()->Double{random()}
    func consumeHot(monotonicMilliseconds:Double,reduced:Bool)->Double{hot.consume(nowMs:monotonicMilliseconds-appOriginMilliseconds,reduced:reduced)}
    func nextRegularSixPattern()->Int{let captured=pattern;pattern=(pattern+1)%3;return captured}
    func prewarm(){_=pool.prewarm(to:76)}
    func makeRenderer(service:NativeSourceAnimationClockService)->NativeSharedSmokeRootRenderer {
        NativeSharedSmokeRootRenderer(session:self,scheduler:NativeSharedSmokeClockRootScheduler(service:service),sourceClockNow:{service.sourceAnimationSeconds*1000})
    }
}

/// PRIVATE renderer scoped to one SceneUUID. Receipts use UUID+sequence so
/// old/new scenes both with core generation1 cannot collide. Paint/ticker are
/// not forwarded to an array; each authored root owns canonical advancement.
@MainActor
final class NativeSharedSmokeRootRenderer {
    private let session:NativeSharedSmokeRootSession,scheduler:any NativeSharedSmokeRootScheduler,sourceClockNow:()->Double
    private var owners:[UInt64:NativeSharedSmokeRootSpritePresentation]=[:],sequence:UInt64=0,disposed=false
    private let sceneID=UUID().uuidString
    var activeOwnerCount:Int{owners.count}
    init(session:NativeSharedSmokeRootSession,scheduler:any NativeSharedSmokeRootScheduler,sourceClockNow:@escaping()->Double){self.session=session;self.scheduler=scheduler;self.sourceClockNow=sourceClockNow}
    @discardableResult
    func admit(recipe:NativeSharedSmokeRecipe,canvas:SKNode?,tile:SKNode?,generation:UInt64,
               origin:CGPoint,renderScale:CGFloat,monotonicMilliseconds:Double,reduced:Bool,
               current:@escaping(UInt64)->Bool,acquireActivity:(NativeSharedFxReceipt)->(()->Void)?)->NativeSharedSmokeRootSpritePresentation? {
        // Bailouts and unsupported topology occur before hot/RNG/resource/lease
        // admission. Original deferred parent reinsertion is not substituted.
        guard !disposed,!recipe.deferFutureBursts,recipe.ttl>0,let canvas,let tile,current(generation),NativeSharedSmokeSpritePresentation.opaqueAncestors(canvas) else{return nil}
        sequence += 1;let captured=sequence
        guard let owner=try? NativeSharedSmokeRootSpritePresentation(recipe:recipe,generation:generation,sequence:captured,sourceOwnerID:sceneID,
            canvas:canvas,tile:tile,origin:origin,renderScale:renderScale,pool:session.pool,scheduler:scheduler,sourceClockNowMilliseconds:sourceClockNow,
            isCurrent:current,random:{[session] in session.nextVisualRandom()},consumeHotFactor:{[session] in session.consumeHot(monotonicMilliseconds:monotonicMilliseconds,reduced:reduced)},acquireActivity:acquireActivity) else{return nil}
        owners[captured]=owner
        owner.onFinished={[weak self,weak owner] _ in guard let self,let owner,self.owners[captured] === owner else{return};self.owners.removeValue(forKey:captured)}
        return owner
    }
    func cleanup(tag:String){for owner in owners.values.filter({$0.recipe.fxTag==tag}){owner.dispose()}}
    func retire(generation:UInt64){for owner in owners.values.filter({$0.generation==generation}){owner.dispose()}}
    func dispose(){guard !disposed else{return};disposed=true;for owner in Array(owners.values){owner.dispose()};owners.removeAll()}
    isolated deinit {for owner in owners.values{owner.dispose()}}
}
