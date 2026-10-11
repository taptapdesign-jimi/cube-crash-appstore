import Foundation

/// PRIVATE app-session exact writer capture. Retired A never clears current C's
/// shared Core retry/progress flags, including same-generation replacement.
@MainActor final class NativeMeterQueueSignals {
    struct Snapshot:Equatable {
        let generation:UInt64
        let inProgress,retryPending:Bool
    }
    @MainActor final class Capture {
        let id=UUID(),generation:UInt64
        fileprivate weak var registry:NativeMeterQueueSignals?
        fileprivate let current:()->Bool,changed:(Bool,Bool)->Void,retire:()->Void
        fileprivate var progress=false,retry=false,closed=false
        fileprivate init(generation:UInt64,registry:NativeMeterQueueSignals,current:@escaping()->Bool,changed:@escaping(Bool,Bool)->Void,retire:@escaping()->Void){self.generation=generation;self.registry=registry;self.current=current;self.changed=changed;self.retire=retire}
        var isCurrent:Bool {
            guard !closed,registry?.active === self else{return false}
            let ok=current();return ok && !closed && registry?.active === self
        }
        func captureSnapshot()->Snapshot? {
            guard isCurrent else{return nil}
            let value=Snapshot(generation:generation,inProgress:progress,retryPending:retry)
            guard isCurrent,value.inProgress==progress,value.retryPending==retry else{return nil}
            return value
        }
        func setProgress(_ value:Bool){guard isCurrent else{return};progress=value;changed(progress,retry)}
        func setRetry(_ value:Bool){guard isCurrent else{return};retry=value;changed(progress,retry)}
        func release(){registry?.release(self)}
        fileprivate func sealAndStop(){guard !closed else{return};closed=true;progress=false;retry=false;changed(false,false)}
    }
    fileprivate var active:Capture?
    private var sequence:UInt64=0,closed=false
    func begin(generation:UInt64,current:@escaping()->Bool,changed:@escaping(Bool,Bool)->Void,retire:@escaping()->Void)->Capture? {
        guard !closed else{return nil};sequence &+= 1
        let receipt=sequence,old=active;active=nil
        // Seal BEFORE both external Core publisher and old-owner teardown.
        old?.sealAndStop();old?.retire()
        guard !closed,sequence==receipt,active==nil else{return nil}
        let capture=Capture(generation:generation,registry:self,current:current,changed:changed,retire:retire)
        active=capture
        guard capture.isCurrent else{release(capture);return nil}
        return capture
    }
    fileprivate func release(_ capture:Capture){
        guard active === capture else{return}
        active=nil;capture.sealAndStop()
    }
    func dispose(){guard !closed else{return};closed=true;sequence &+= 1
        let old=active;active=nil;old?.sealAndStop();old?.retire()
    }
    isolated deinit {dispose()}
}
