import Foundation

/// PRIVATE source-GSAP delivery model. No timer, UI object, render activity or
/// gameplay state. Driver integration remains gated by original-root admission.
@MainActor
protocol NativeSourceAnimationParticipant:AnyObject {
    func advanceSourceAnimation(seconds:Double)
}
@MainActor
final class NativeSourceAnimationRuntime {
    enum RootFamily:String {case timeline,eagerTween,defaultLazyTween}
    @MainActor final class Lease {
        fileprivate weak var runtime:NativeSourceAnimationRuntime?
        fileprivate let id:UInt64
        fileprivate init(_ runtime:NativeSourceAnimationRuntime,_ id:UInt64){self.runtime=runtime;self.id=id}
        func cancel(success:Bool=false){runtime?.cancel(id:id,success:success)}
        func setSuspended(_ value:Bool){runtime?.setSuspended(id:id,value:value)}
        var receiptID:UInt64{id}
        var active:Bool{runtime?.entries[id]?.active==true}
    }
    @MainActor private final class Entry {
        let id:UInt64,family:RootFamily,duration:Double
        weak var participant:(any NativeSourceAnimationParticipant)?
        weak var previous:Entry?
        var next:Entry?
        var birth:Double,active=true,initialized=false,suspended=false,suspendedAt=0.0
        var lastDelivered:Double?
        var cleanup:((Bool)->Void)?
        init(id:UInt64,family:RootFamily,duration:Double,birth:Double,participant:any NativeSourceAnimationParticipant,cleanup:@escaping(Bool)->Void){self.id=id;self.family=family;self.duration=duration;self.birth=birth;self.participant=participant;self.cleanup=cleanup}
    }
    private var entries:[UInt64:Entry]=[:],first:Entry?,last:Entry?,sequence:UInt64=0,disposed=false
    private var startWall:Double,lastWall:Double,animationOffset=0.0,lastRendered:Double?,partialPausedPass=false
    private(set) var tickerSeconds=0.0,animationSeconds=0.0,globallyPaused=false
    var onVisit:((UInt64)->Void)? // Proof observer; no clock or activity.
    var onDemandChanged:(()->Void)?
    var onWillChangeSuspension:((Bool)->Void)?
    var activeCount:Int{entries.count}
    var hasSourceTickerDemand:Bool{entries.values.contains{$0.active && !$0.suspended && $0.participant != nil}}
    var hasRunnableParticipants:Bool{!globallyPaused && hasSourceTickerDemand}
    init(wallOriginMilliseconds:Double){startWall=floor(wallOriginMilliseconds);lastWall=floor(wallOriginMilliseconds)}
    func attach(participant:any NativeSourceAnimationParticipant,family:RootFamily,duration:Double,delay:Double=0,initiallySuspended:Bool=false,cleanup:@escaping(Bool)->Void)->Lease? {
        guard !disposed else{return nil}
        precondition(duration.isFinite && duration>=0 && delay>=0)
        sequence += 1
        let entry=Entry(id:sequence,family:family,duration:round7(duration),birth:round7(animationSeconds+delay),participant:participant,cleanup:cleanup)
        // Source creates paused linked roots before entry/cloud siblings.
        // Atomic suspension must precede demand publication, not wake+pause.
        entry.suspended=initiallySuspended;entry.suspendedAt=animationSeconds
        if let last{entry.previous=last;last.next=entry}else{first=entry}
        last=entry;entries[entry.id]=entry;onDemandChanged?();return Lease(self,entry.id)
    }
    func setGlobalPaused(_ value:Bool){
        guard !disposed,value != globallyPaused else{return}
        globallyPaused=value
        if !value{animationOffset=tickerSeconds-animationSeconds;if partialPausedPass{partialPausedPass=false;lastRendered=nil;deliver(wallMilliseconds:lastWall)}}
        onDemandChanged?()
    }
    /// Supplied by the single existing/consolidated source animation delivery;
    /// renderer15 callbacks are not an authorized input to this API.
    func deliver(wallMilliseconds:Double){
        guard !disposed else{return}
        // Source GSAP reads Date.now(), integer milliseconds; nativeRaw frame
        // timestamps and performance.now hot history remain separate domains.
        let wallMilliseconds=floor(wallMilliseconds)
        let elapsed=wallMilliseconds-lastWall
        if elapsed>500 || elapsed<0 {startWall += elapsed-33}
        lastWall=wallMilliseconds;tickerSeconds=(lastWall-startWall)/1000
        renderReceivedTicker()
    }
    /// Literal Source _tick has already applied overlap/lag and decided dispatch.
    /// Its supplied ticker.time, not nativeRaw time, is authoritative here.
    func deliverSourceTicker(seconds:Double,wallMilliseconds:Double){
        guard !disposed else{return}
        lastWall=floor(wallMilliseconds);tickerSeconds=seconds;startWall=lastWall-seconds*1000
        renderReceivedTicker()
    }
    private func renderReceivedTicker(){
        guard !globallyPaused else{return}
        animationSeconds=round7(tickerSeconds-animationOffset)
        guard animationSeconds != lastRendered else{return} // Same-tick reentry.
        lastRendered=animationSeconds
        var child=first,lazy:[Entry]=[]
        while let entry=child {
            let capturedNext=entry.next // Exact root traversal, not Array snapshot.
            if !entry.active {
                // GSAP retries this already-rendered root time and returns;
                // remaining siblings wait until next actual source delivery.
                break
            }
            if entry.participant==nil {cancel(id:entry.id,success:false)}
            else if !entry.suspended && animationSeconds>=entry.birth {
                onVisit?(entry.id)
                if entry.family == .defaultLazyTween && !entry.initialized && animationSeconds>entry.birth {
                    entry.initialized=true;lazy.append(entry)
                } else {
                    // Grouped timeline onUpdate flushes preceding lazy roots.
                    if entry.family == .timeline {flushLazy(&lazy)}
                    render(entry)
                }
                if globallyPaused {if capturedNext != nil{partialPausedPass=true};break}
            }
            child=capturedNext
        }
        // Already captured original lazy renders still flush if an earlier
        // lazy callback pauses the global timeline; canceled roots are skipped.
        flushLazy(&lazy)
        onDemandChanged?()
    }
    private func flushLazy(_ lazy:inout[Entry]) {
        let queue=lazy;lazy.removeAll()
        for entry in queue where entry.active && entry.participant != nil {
            onVisit?(entry.id);render(entry)
        }
    }
    private func render(_ entry:Entry){
        guard entry.active,let participant=entry.participant else{return}
        let local=round7(max(0,animationSeconds-entry.birth)),clamped=min(local,entry.duration)
        // New grouped root can be visited at0 without onUpdate. No eager copy
        // of the currently painted carrier and no fabricated callback.
        let emits=local>0 || entry.family == .eagerTween || entry.duration==0
        if emits && (entry.lastDelivered != clamped || !entry.initialized) {
            entry.initialized=true;entry.lastDelivered=clamped
            participant.advanceSourceAnimation(seconds:clamped)
        }
        if entry.active && local>=entry.duration {cancel(id:entry.id,success:true)}
    }
    private func cancel(id:UInt64,success:Bool){
        guard let entry=entries.removeValue(forKey:id),entry.active else{return}
        entry.active=false
        if let previous=entry.previous{previous.next=entry.next}else{first=entry.next}
        if let next=entry.next{next.previous=entry.previous}else{last=entry.previous}
        entry.previous=nil;entry.next=nil
        let cleanup=entry.cleanup;entry.cleanup=nil
        // Captured cleanup executes even after participant deallocation or
        // generation replacement. It never looks up a latest same-label owner.
        cleanup?(success);onDemandChanged?()
    }
    private func setSuspended(id:UInt64,value:Bool){
        guard let entry=entries[id],entry.suspended != value else{return}
        onWillChangeSuspension?(value)
        guard !disposed,entries[id] === entry,entry.active,entry.suspended != value else{return}
        entry.suspended=value
        if value{entry.suspendedAt=animationSeconds}else{entry.birth=round7(entry.birth+animationSeconds-entry.suspendedAt)}
        onDemandChanged?()
    }
    func dispose(){
        guard !disposed else{return};disposed=true
        // Close BEFORE captured callbacks. A cleanup may attempt registration;
        // rejected attachment has no callback and cannot extend this teardown.
        for id in entries.keys.sorted(){cancel(id:id,success:false)}
    }
    private func round7(_ x:Double)->Double{(x*1e7).rounded()/1e7}
}
