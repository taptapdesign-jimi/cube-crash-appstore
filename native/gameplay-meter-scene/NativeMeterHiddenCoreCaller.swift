import Foundation
import StackToSixGameplay

/// Real hidden-node receipt -> Core first-cancellation-check -> selected warmup
/// BEFORE charge. Caller owns grid epochs; this owner never rebuilds from alpha.
@MainActor final class NativeMeterHiddenCoreCaller<Node:AnyObject,Asset> {
    typealias Hidden=NativeMeterHiddenOpenOwner<Node>
    typealias Warmup=NativeMeterSelectedFinaleWarmup<Asset>
    struct Captured {
        let request:NativeMeterOpenRequest,hidden:Hidden.Capture,warmup:Warmup.Capture,lease:Hidden.Lease
        let drop:NativeMeterDropReservation
    }
    @MainActor private final class Entry {
        let request:NativeMeterOpenRequest,hidden:Hidden.Capture,warmup:Warmup.Capture
        var lease:Hidden.Lease?,drop:NativeMeterDropReservation?,settled:Warmup.Outcome?
        var callbacks:[(Warmup.Outcome)->Void]=[]
        init(_ request:NativeMeterOpenRequest){
            self.request=request
            hidden = .init(id:request.id,generation:request.generation,spawnToken:request.spawnToken,column:request.tile.cell.column,row:request.tile.cell.row)
            warmup = .init(token:request.spawnToken,generation:request.generation,selection:request.tile.variant ?? request.tile.gameplayArchetype!.rawValue)
        }
        // Swift 6.3.3 EarlyPerfInliner crashes on this synthesized generic
        // destroyer in optimized builds. Keep only its ARC destruction out
        // of that pass; gameplay/animation code remains fully optimized.
        @_optimize(none) deinit {}
    }
    private let engine:NativeGameplayEngine,hiddenOwner:Hidden,warmupOwner:Warmup
    private let current:()->Bool,prepareAudio:(NativeTile,Warmup.Capture)->Void,texturesCurrent:()->Bool
    private var entries:[String:Entry]=[:],drops:[String:String]=[:],closed=false
    var onResult:((NativeMoveResult,NativeBoardState)->Void)?
    var onReserved:((Captured)->Void)?
    var onFault:((String)->Void)?
    init(engine:NativeGameplayEngine,hidden:Hidden,warmup:Warmup,current:@escaping()->Bool,
         texturesCurrent:@escaping()->Bool,prepareAudio:@escaping(NativeTile,Warmup.Capture)->Void){
        self.engine=engine;hiddenOwner=hidden;warmupOwner=warmup;self.current=current
        self.texturesCurrent=texturesCurrent;self.prepareAudio=prepareAudio
    }
    var retainedNodeIDs:Set<String>{hiddenOwner.retainedNodeIDs}
    @discardableResult func begin(_ request:NativeMeterOpenRequest)->Bool {
        guard valid(),engine.pendingMeterOpen==request,entries[request.id]==nil,
              let special=request.tile.gameplayArchetype?.rawValue,
              let plan=NativeMeterSelectedWarmupCatalog.plan(special:special,variant:request.tile.variant) else{return false}
        let entry=Entry(request);entries[request.id]=entry
        guard warmupOwner.beginBeforeOpen(plan:plan,capture:entry.warmup,isCurrent:{[weak self,weak entry] in
            guard let self,let entry else{return false};return self.valid(entry)
        }),valid(entry) else{retire(entry);return false}
        let started=hiddenOwner.open(capture:entry.hidden,selection:.init(special:special,variant:request.tile.variant)){[weak self,weak entry] outcome in
            guard let self,let entry,self.valid(entry) else{return}
            let receipt:NativeMeterOpenReceipt
            switch outcome {
            case .created(let lease,_):entry.lease=lease;receipt = .created(tileID:lease.id)
            case .refused:receipt = .refused
            case .creationFailed:receipt = .creationFailed
            case .retired:self.retire(entry);return
            }
            let previous=self.engine.state
            let result=self.engine.completeMeterOpen(id:request.id,generation:request.generation,receipt:receipt,prepareCommitted:{[weak self,weak entry] tile in
                guard let self,let entry,self.valid(entry),self.hiddenOwner.prepareCommitted(capture:entry.hidden,tileID:tile.id),self.valid(entry) else{return}
                // Actual audio preparation is fire-and-forget, before charge;
                // no carrier PNG or selected Promise is awaited here.
                self.prepareAudio(tile,entry.warmup)
                guard self.valid(entry) else{return}
                _=self.warmupOwner.committed(capture:entry.warmup,tileID:tile.id,texturesCurrent:{[weak self,weak entry] in
                    guard let self,let entry,self.valid(entry) else{return false}
                    let visible=self.texturesCurrent();return visible && self.valid(entry)
                })
            })
            guard self.valid(entry) else{return}
            if let id=result.events.first(where:{$0.kind == .meterDropReserved})?.reason,
               let drop=self.engine.meterDropReservations[id],let lease=entry.lease,lease.isOwned(),self.valid(entry){
                entry.drop=drop;self.drops[id]=request.id
                self.warmupOwner.whenSelectedSettled(capture:entry.warmup){[weak self,weak entry] outcome in
                    guard let self,let entry,self.valid(entry) else{return}
                    entry.settled=outcome;let callbacks=entry.callbacks;entry.callbacks=[]
                    for callback in callbacks {guard self.valid(entry) else{return};callback(outcome)}
                }
                guard self.valid(entry) else{return}
                // Captured node is known BEFORE Scene consumes Reserved and can
                // synchronize its model; hidden alpha alone never retains it.
                self.onReserved?(.init(request:request,hidden:entry.hidden,warmup:entry.warmup,lease:lease,drop:drop))
                guard self.valid(entry) else{return}
                self.onResult?(result,previous)
            } else {
                // Seal this request before delivering a retry/cancel packet;
                // that packet may synchronously create its replacement borrower.
                self.retire(entry)
                guard self.valid(),self.engine.state.generation==request.generation else{return}
                self.onResult?(result,previous)
            }
        }
        if !started {retire(entry)}
        return started
    }
    func whenWarmupSettled(dropID:String,_ callback:@escaping(Warmup.Outcome)->Void){
        guard let key=drops[dropID],let entry=entries[key],valid(entry) else{callback(.retired);return}
        if let settled=entry.settled {callback(settled)} else {entry.callbacks.append(callback)}
    }
    /// Both normal onLanded and the literal post-warmup Source finally fallback
    /// call here after the engine cancellation check, never texture/paint ready.
    @discardableResult func landed(dropID:String,allowsSourceIdle:Bool)->Bool {
        guard allowsSourceIdle,let key=drops[dropID],let entry=entries[key],valid(entry) else{return false}
        return hiddenOwner.landed(capture:entry.hidden,allowsSourceIdle:allowsSourceIdle)
    }
    /// Normal release preserves the actual node and its newly-admitted idle.
    @discardableResult func releaseToScene(dropID:String)->Bool {
        guard let key=drops[dropID],let entry=entries[key],valid(entry),hiddenOwner.releaseToScene(entry.hidden) else{return false}
        entries.removeValue(forKey:key);drops.removeValue(forKey:dropID)
        warmupOwner.release(entry.warmup);return true
    }
    func retire(dropID:String){guard let key=drops[dropID],let entry=entries[key] else{return};retire(entry)}
    private func valid()->Bool{guard !closed else{return false};let answer=current();return answer && !closed}
    private func valid(_ entry:Entry)->Bool{
        guard valid(),entries[entry.request.id] === entry,engine.state.generation==entry.request.generation else{return false}
        if let lease=entry.lease {let owned=lease.isOwned();return owned && !closed && entries[entry.request.id] === entry}
        return true
    }
    private func retire(_ entry:Entry){
        guard entries[entry.request.id] === entry else{return}
        entries.removeValue(forKey:entry.request.id)
        if let drop=entry.drop,drops[drop.id]==entry.request.id{drops.removeValue(forKey:drop.id)}
        hiddenOwner.retire(entry.hidden);warmupOwner.cancel(entry.warmup)
        let callbacks=entry.callbacks;entry.callbacks=[];callbacks.forEach{$0(.retired)}
    }
    func retireGeneration(_ generation:UInt64){for entry in Array(entries.values) where entry.request.generation==generation {retire(entry)}}
    func dispose(){guard !closed else{return};closed=true;let captured=Array(entries.values);for entry in captured{retire(entry)}
        onResult=nil;onReserved=nil;onFault=nil
    }
    // Same Swift6.3.3 generic ARC inliner defect as Entry; no gameplay code
    // loses optimization and automatic stored-property destruction is retained.
    @_optimize(none) deinit {}

}
