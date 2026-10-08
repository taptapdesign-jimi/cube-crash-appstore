import Foundation

/// Private app-lived vector resource pool. Graphics are not bitmap assets.
/// A real SKShapeNode adapter must clear geometry, fill, stroke, position,
/// rotation, x/y scale, pivot, skew, alpha, tint and interaction on reuse.
/// Source reset does not reset blendMode; halo inherits it from prior pooled work.
/// No adapter is admitted into production by this value proof.
final class NativeSharedFxResourcePool {
    final class Resource {
        let id: UInt64
        var destroyed = false, reusable = true
        var x=0.0,y=0.0,scaleX=1.0,scaleY=1.0,alpha=1.0,rotation=0.0
        var geometry: [Double] = [], visible=true, tint:UInt32=0xffffff
        var blendMode="normal", resetCount=0
        init(id:UInt64){self.id=id}
        func reset(){geometry=[];x=0;y=0;scaleX=1;scaleY=1;alpha=1;rotation=0;visible=true;tint=0xffffff;resetCount += 1}
    }
    private var available:[Resource]=[], inPool=Set<UInt64>(), sequence:UInt64=0
    private let stopAnimations:(Resource)->Void
    init(stopAnimations:@escaping(Resource)->Void = {_ in}){self.stopAnimations=stopAnimations}
    private(set) var created=0,reused=0
    var poolSize:Int{available.count}
    var resourcesInPool:[Resource]{available}
    func acquire()->Resource {
        var candidate:Resource?, attempts=0
        while !available.isEmpty,attempts<10 {
            let item=available.removeLast();attempts += 1;inPool.remove(item.id)
            if !item.destroyed,item.reusable {candidate=item;reused += 1;break}
        }
        if candidate == nil {sequence += 1;created += 1;candidate=Resource(id:sequence)}else{stopAnimations(candidate!)}
        candidate!.reset();return candidate!
    }
    func release(_ resource:Resource){
        guard !resource.destroyed,resource.reusable,!inPool.contains(resource.id) else{return}
        stopAnimations(resource);resource.visible=false;resource.alpha=0
        stopAnimations(resource);resource.reset()
        if available.count<150 {available.append(resource);inPool.insert(resource.id)}else{resource.destroyed=true}
    }
    @discardableResult func prewarm(to target:Int)->Int {
        let missing=max(0,min(150,max(0,target))-available.count)
        for _ in 0..<missing {sequence += 1;created += 1;let item=Resource(id:sequence);item.reset();available.append(item);inPool.insert(item.id)}
        return available.count
    }
}

/// Distinct wall-clock cleanup from source regularMerge6ShardsTemplated's
/// setTimeout. The existing scene lifecycle supplies wallNowMs; this object
/// installs no clock. Generation cancellation can retire a captured receipt
/// even when its corresponding gameplay mutation is no longer valid.
final class NativeSharedShardCleanup {
    let receipt: NativeSharedFxReceipt
    private let deadlineMs:Double, release:()->Void
    private(set) var retired=false
    init(generation:UInt64,sequence:UInt64,label:String,wallNowMs:Double,ttlSeconds:Double,acquire:(NativeSharedFxReceipt)->()->Void){
        let captured=NativeSharedFxReceipt(kind:.shards,generation:generation,sequence:sequence,label:label,tailMilliseconds:100)
        receipt=captured;deadlineMs=wallNowMs+ttlSeconds*1000;release=acquire(captured)
    }
    func advance(wallNowMs:Double){if wallNowMs>=deadlineMs{retire()}}
    func retire(){guard !retired else{return};retired=true;release()}
}
