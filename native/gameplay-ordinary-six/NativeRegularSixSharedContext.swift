import UIKit
import SpriteKit

/// The source shard helper uses independent setTimeout, NOT trackAppTimeout
/// merged into a gameplay coroutine owner and NOT GSAP.delayedCall.
@MainActor
final class NativeRegularSixAppWallScheduler:NativeRegularSixWallScheduling {
    private let timers:NativeSourceAppTimeoutOwner
    init(timers:NativeSourceAppTimeoutOwner){self.timers=timers}
    func schedule(generation:UInt64,id:String,delayMilliseconds:Int,elapsed:@escaping()->Void)->NativeSharedSmokeRootCancellation {
        let receipt=timers.schedule(sourceID:id,generation:generation,delayMilliseconds:delayMilliseconds,elapsed:elapsed)
        return NativeSharedSmokeRootCancellation{[timers] _ in _=timers.cancel(receipt)}
    }
}

/// PRIVATE APP-lived pattern pools; each Source wooden-template pattern uses
/// its own GraphicsPool150. Common smoke retains its existing different pool,
/// shared Math draw stream, app hot history and global regular pattern cursor.
@MainActor
final class NativeRegularSixSharedResources {
    let smoke:NativeSharedSmokeRootSession
    private var patternPools:[Int:NativeSharedSmokeSpritePool]=[:]
    init(smoke:NativeSharedSmokeRootSession){self.smoke=smoke}
    func pool(for pattern:Int)->NativeSharedSmokeSpritePool{
        if let pool=patternPools[pattern]{return pool}
        let pool=NativeSharedSmokeSpritePool();patternPools[pattern]=pool;return pool
    }
    var activeShards:Int{patternPools.values.reduce(0){$0+$1.activeCount}}
    var cachedPatterns:Int{patternPools.count}
}

/// Scoped to one Scene, whose parent injects actual admitted Source lifecycle.
/// Creates no clock/cadence, reuses one app animation service + wall scheduler.
@MainActor
final class NativeRegularSixSharedContext {
    let resources:NativeRegularSixSharedResources
    let scheduler:any NativeSharedSmokeRootScheduler,wall:any NativeRegularSixWallScheduling
    let smokeRenderer:NativeSharedSmokeRootRenderer
    let sourceOwnerID=UUID().uuidString
    let monotonicNow:()->Double,current:(UInt64)->Bool,acquire:(NativeSharedFxReceipt)->(()->Void)?
    private(set) var sequence:UInt64=0
    private var owners:[UUID:NativeRegularSixSharedLayers]=[:],disposed=false
    var canAdmit:Bool{!disposed}
    init(resources:NativeRegularSixSharedResources,scheduler:any NativeSharedSmokeRootScheduler,
         wall:any NativeRegularSixWallScheduling,smokeRenderer:NativeSharedSmokeRootRenderer,
         monotonicNow:@escaping()->Double,current:@escaping(UInt64)->Bool,
         acquire:@escaping(NativeSharedFxReceipt)->(()->Void)?){
        self.resources=resources;self.scheduler=scheduler;self.wall=wall;self.smokeRenderer=smokeRenderer
        self.monotonicNow=monotonicNow;self.current=current;self.acquire=acquire
    }
    func nextSequence()->UInt64{sequence += 1;return sequence}
    @discardableResult func retain(_ owner:NativeRegularSixSharedLayers,id:UUID)->Bool{guard !disposed else{return false};owners[id]=owner;return true}
    func retire(id:UUID){owners.removeValue(forKey:id)}
    func dispose(){guard !disposed else{return};disposed=true;for owner in Array(owners.values){owner.dispose()};owners.removeAll()}
    var activeOwnerCount:Int{owners.count}
    isolated deinit {for owner in owners.values{owner.dispose()}}
}
